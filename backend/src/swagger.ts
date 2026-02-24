import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GymSaaS API',
      version: '1.0.0',
      description: 'API para la gestión de gimnasios con enfoque en gamificación y finanzas.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.resolve(__dirname, 'routes/**/*.ts'),
    path.resolve(__dirname, 'routes/**/*.js'),
    path.resolve(__dirname, 'controllers/**/*.ts'),
    path.resolve(__dirname, 'controllers/**/*.js'),
  ],
};

// swagger-jsdoc v7-rc returns a Promise — se construye una sola vez al cargar el módulo.
const specPromise: Promise<object> = (
  swaggerJsdoc(options) as unknown as Promise<object>
).catch((err) => {
  logger.error({ err }, 'Failed to build swagger spec');
  return { openapi: '3.0.0', info: { title: 'GymSaaS API', version: '1.0.0' }, paths: {} };
});

export const setupSwagger = (app: Express): void => {
  // Endpoint JSON — usado también por el UI
  app.get('/api-docs.json', async (_req: Request, res: Response) => {
    res.json(await specPromise);
  });

  // Swagger UI — usa el spec resuelto directamente (no la URL dinámica)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const spec = await specPromise;
        swaggerUi.setup(spec)(_req, res, next);
      } catch (err) {
        next(err);
      }
    },
  );

  logger.info({ path: '/api-docs' }, 'Swagger UI available');
};
