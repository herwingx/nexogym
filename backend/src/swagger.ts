import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';
import { env } from './config/env';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NexoGym API',
      version: '1.0.0',
      description: 'ERP multitenant de alto rendimiento para la gestión de gimnasios. Conecta al dueño, al staff y a los clientes.',
    },
    servers: [
      {
        url: env.PUBLIC_URL,
        description: env.NODE_ENV === 'production' ? 'Producción' : 'Servidor de desarrollo',
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

// swagger-jsdoc can be synchronous or asynchronous depending on the version and configuration.
// In this environment, it returns the specification object directly.
let swaggerSpec: any;
try {
  swaggerSpec = swaggerJsdoc(options);
} catch (err) {
  logger.error({ err }, 'Failed to build swagger spec');
  swaggerSpec = { openapi: '3.0.0', info: { title: 'NexoGym API', version: '1.0.0' }, paths: {} };
}

export const setupSwagger = (app: Express): void => {
  // Endpoint JSON — usado también por el UI
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
  });

  // Swagger UI — usa el spec resuelto directamente (no la URL dinámica)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
  );

  logger.info({ path: '/api-docs' }, 'Swagger UI available');
};
