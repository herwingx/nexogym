import { Request, Response } from 'express';
import { prisma } from '../db';
import { classSchema, bookingSchema } from '../schemas/booking.schema';
import { BookingStatus, SubscriptionStatus } from '@prisma/client';
import { handleControllerError } from '../utils/http';

export const getClasses = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const { day } = req.query;

    if (!gymId) return res.status(401).json({ error: 'Unauthorized' });

    const classes = await prisma.gymClass.findMany({
      where: {
        gym_id: gymId,
        day_of_week: day ? parseInt(day as string) : undefined,
      },
      include: {
        instructor: { select: { name: true } },
      },
      orderBy: { start_time: 'asc' },
    });

    res.status(200).json({ data: classes });
  } catch (error) {
    handleControllerError(req, res, error, '[getClasses Error]', 'Failed to fetch classes');
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) return res.status(401).json({ error: 'Unauthorized' });

    const validation = classSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error.issues[0].message });

    const { instructorId, ...rest } = validation.data;

    const newClass = await prisma.gymClass.create({
      data: {
        ...rest,
        instructor_id: instructorId,
        gym_id: gymId,
      },
    });

    res.status(201).json({ data: newClass });
  } catch (error) {
    handleControllerError(req, res, error, '[createClass Error]', 'Failed to create class');
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    if (!gymId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const validation = bookingSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error.issues[0].message });

    const { classId, date } = validation.data;
    const bookingDate = new Date(date);

    // 1. Validate Active Subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: { gt: new Date() },
      },
    });

    if (!subscription) return res.status(403).json({ error: 'Membresía activa requerida para reservar.' });

    // 2. Validate Class Capacity
    const targetClass = await prisma.gymClass.findFirst({
      where: { id: classId, gym_id: gymId },
    });
    if (!targetClass) return res.status(404).json({ error: 'Clase no encontrada.' });

    const currentBookings = await prisma.classBooking.count({
      where: { class_id: classId, gym_id: gymId, booking_date: bookingDate },
    });

    if (currentBookings >= targetClass.capacity) {
      return res.status(400).json({ error: 'La clase está llena.' });
    }

    // 3. Prevent duplicate booking
    const existingBooking = await prisma.classBooking.findFirst({
      where: { user_id: userId, class_id: classId, gym_id: gymId, booking_date: bookingDate },
    });

    if (existingBooking) return res.status(400).json({ error: 'Ya tienes una reserva para esta clase en esta fecha.' });

    const booking = await prisma.classBooking.create({
      data: {
        gym_id: gymId,
        user_id: userId,
        class_id: classId,
        booking_date: bookingDate,
      },
    });

    res.status(201).json({ data: booking });
  } catch (error) {
    handleControllerError(req, res, error, '[createBooking Error]', 'Failed to create booking');
  }
};

// DELETE /bookings/:id — Cancel own booking
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    if (!gymId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;

    const booking = await prisma.classBooking.findFirst({
      where: { id, gym_id: gymId, user_id: userId },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    if (booking.status === BookingStatus.CANCELLED) {
      res.status(400).json({ error: 'Booking is already cancelled.' });
      return;
    }

    await prisma.classBooking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });

    res.status(200).json({ message: 'Booking cancelled successfully.' });
  } catch (error) {
    handleControllerError(req, res, error, '[cancelBooking Error]', 'Failed to cancel booking');
  }
};

// GET /bookings/me — List own upcoming bookings
export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    if (!gymId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const bookings = await prisma.classBooking.findMany({
      where: {
        gym_id: gymId,
        user_id: userId,
        status: { not: BookingStatus.CANCELLED },
        booking_date: { gte: new Date() },
      },
      include: {
        class: {
          select: { name: true, start_time: true, end_time: true, day_of_week: true },
        },
      },
      orderBy: { booking_date: 'asc' },
    });

    res.status(200).json({ data: bookings });
  } catch (error) {
    handleControllerError(req, res, error, '[getMyBookings Error]', 'Failed to fetch bookings');
  }
};

// PATCH /bookings/:id/attend — Admin/Instructor marks attendance
export const markAttendance = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;

    const booking = await prisma.classBooking.findFirst({
      where: { id, gym_id: gymId },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    if (booking.status !== BookingStatus.PENDING) {
      res.status(400).json({ error: `Cannot mark attendance on a booking with status: ${booking.status}.` });
      return;
    }

    const updated = await prisma.classBooking.update({
      where: { id },
      data: { status: BookingStatus.ATTENDED },
    });

    res.status(200).json({ message: 'Attendance marked.', booking: updated });
  } catch (error) {
    handleControllerError(req, res, error, '[markAttendance Error]', 'Failed to mark attendance');
  }
};

// PATCH /bookings/classes/:id — Update class details
export const updateClass = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const { name, description, capacity, day_of_week, start_time, end_time, instructorId } = req.body;

    const existing = await prisma.gymClass.findFirst({ where: { id, gym_id: gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    const updated = await prisma.gymClass.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(capacity !== undefined && { capacity }),
        ...(day_of_week !== undefined && { day_of_week }),
        ...(start_time !== undefined && { start_time }),
        ...(end_time !== undefined && { end_time }),
        ...(instructorId !== undefined && { instructor_id: instructorId }),
      },
    });

    res.status(200).json({ message: 'Class updated.', data: updated });
  } catch (error) {
    handleControllerError(req, res, error, '[updateClass Error]', 'Failed to update class');
  }
};

// DELETE /bookings/classes/:id — Delete a class (cascades bookings)
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;

    const existing = await prisma.gymClass.findFirst({ where: { id, gym_id: gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Class not found.' });
      return;
    }

    await prisma.gymClass.delete({ where: { id } });

    res.status(200).json({ message: `Class "${existing.name}" deleted.` });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteClass Error]', 'Failed to delete class');
  }
};
