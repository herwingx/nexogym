import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { logger } from './lib/logger';
import path from 'path';

const swaggerSourceGlobs = [
  path.resolve(__dirname, 'routes', '**', '*.{ts,js}'),
  path.resolve(__dirname, 'controllers', '**', '*.{ts,js}'),
  path.resolve(__dirname, '..', 'src', 'routes', '**', '*.{ts,js}'),
  path.resolve(__dirname, '..', 'src', 'controllers', '**', '*.{ts,js}'),
];

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
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: swaggerSourceGlobs,
};

const buildSwaggerSpec = async () => {
  const spec = (await (swaggerJsdoc(options) as unknown as Promise<Record<string, unknown>>)) || {};
  return {
    ...spec,
    openapi: spec.openapi || '3.0.0',
    paths: spec.paths || {},
  };
};

export const setupSwagger = (app: Express) => {
  app.get('/api-docs.json', async (_req, res) => {
    try {
      const normalizedSwaggerSpec = await buildSwaggerSpec();
      res.status(200).json(normalizedSwaggerSpec);
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate OpenAPI spec');
      res.status(500).json({ error: 'Failed to generate OpenAPI spec' });
    }
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: {
        url: '/api-docs.json',
      },
    }),
  );

  logger.info({ path: '/api-docs' }, 'Swagger UI available');
};
