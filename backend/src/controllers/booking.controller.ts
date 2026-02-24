import { Request, Response } from 'express';
import { prisma } from '../db';
import { classSchema, bookingSchema } from '../schemas/booking.schema';
import { SubscriptionStatus } from '@prisma/client';
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
