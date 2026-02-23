import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const requireHardwareKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ openDoor: false, error: 'Missing x-api-key header' });
      return;
    }

    // Look up the Gym by its unique hardware key
    const gym = await prisma.gym.findFirst({
      where: { api_key_hardware: apiKey },
      select: { id: true },
    });

    if (!gym) {
      res.status(401).json({ openDoor: false, error: 'Invalid API Key' });
      return;
    }

    // Attach to the request object so downstream controllers can strictly enforce Multitenancy
    req.gymId = gym.id;
    next();
  } catch (error) {
    console.error('[Hardware Middleware Error]:', error);
    res.status(500).json({ openDoor: false, error: 'Internal Server Error' });
  }
};
