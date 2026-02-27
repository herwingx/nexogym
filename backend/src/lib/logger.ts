import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const shouldPrettyPrint = !isProduction && process.env.LOG_PRETTY !== 'false';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: shouldPrettyPrint
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'nexogym-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'jwt',
      'service_role_key',
      'anon_key',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});
