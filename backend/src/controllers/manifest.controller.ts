import { Request, Response } from 'express';
import { prisma } from '../db';

const DEFAULT_MANIFEST = {
  name: 'NexoGym',
  short_name: 'NexoGym',
  description: 'Portal del socio — NexoGym ERP Multitenant',
  start_url: '/',
  display: 'standalone' as const,
  background_color: '#09090b',
  theme_color: '#09090b',
  orientation: 'portrait-primary' as const,
  icons: [{ src: '/vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  categories: ['fitness', 'health'],
  lang: 'es',
};

const COOKIE_NAME = 'nexogym_gym_id';
const COOKIE_MAX_AGE_DAYS = 7;

/**
 * GET /api/v1/manifest
 * PWA manifest dinámico: si hay cookie nexogym_gym_id (seteada al cargar contexto),
 * devuelve name/short_name y theme_color del gym (white-label). Si no, devuelve NexoGym.
 * Público (no requiere auth); el navegador pide el manifest al cargar la página.
 */
export const getManifest = async (req: Request, res: Response) => {
  try {
    const gymId = req.cookies?.[COOKIE_NAME] as string | undefined;

    if (!gymId || typeof gymId !== 'string') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/manifest+json');
      return res.status(200).json(DEFAULT_MANIFEST);
    }

    const gym = await prisma.gym.findFirst({
      where: { id: gymId, status: 'ACTIVE', deleted_at: null },
      select: { name: true, theme_colors: true, logo_url: true },
    });

    if (!gym) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/manifest+json');
      return res.status(200).json(DEFAULT_MANIFEST);
    }

    const themeColors = gym.theme_colors as { primary?: string } | null | undefined;
    const themeColor = themeColors?.primary ?? DEFAULT_MANIFEST.theme_color;
    const name = (gym.name || 'NexoGym').trim();
    const shortName = name.length > 12 ? name.slice(0, 12).trim() : name;

    const manifest = {
      ...DEFAULT_MANIFEST,
      name,
      short_name: shortName,
      theme_color: themeColor,
      description: `Portal del socio — ${name}`,
    };

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/manifest+json');
    res.status(200).json(manifest);
  } catch (err) {
    req.log?.warn({ err }, 'Manifest fallback to default');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/manifest+json');
    res.status(200).json(DEFAULT_MANIFEST);
  }
};

export const MANIFEST_COOKIE_OPTIONS = {
  cookieName: COOKIE_NAME,
  maxAgeDays: COOKIE_MAX_AGE_DAYS,
};
