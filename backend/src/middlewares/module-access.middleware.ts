import { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';
import { ModuleKey, resolveModulesConfig } from '../utils/modules-config';

type ModuleAccessOptions = {
  hardwareResponse?: boolean;
};

export const requireModuleEnabled = (moduleKey: ModuleKey, options: ModuleAccessOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gymId = req.gymId;
      if (!gymId) {
        if (options.hardwareResponse) {
          res.status(401).json({ openDoor: false, error: 'Unauthorized: Gym context missing' });
          return;
        }
        res.status(401).json({ error: 'Unauthorized: Gym context missing' });
        return;
      }

      const gym = await prisma.gym.findUnique({
        where: { id: gymId },
        select: {
          subscription_tier: true,
          modules_config: true,
        },
      });

      if (!gym) {
        if (options.hardwareResponse) {
          res.status(404).json({ openDoor: false, error: 'Gym not found.' });
          return;
        }
        res.status(404).json({ error: 'Gym not found.' });
        return;
      }

      const modules = resolveModulesConfig(gym.modules_config, gym.subscription_tier);

      if (!modules[moduleKey]) {
        if (options.hardwareResponse) {
          res.status(403).json({ openDoor: false, error: `Feature disabled for current subscription: ${moduleKey}` });
          return;
        }

        res.status(403).json({ error: `Feature disabled for current subscription: ${moduleKey}` });
        return;
      }

      next();
    } catch (error) {
      req.log?.error({ err: error, moduleKey }, '[requireModuleEnabled Error]');
      if (options.hardwareResponse) {
        res.status(500).json({ openDoor: false, error: 'Internal Server Error' });
        return;
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};