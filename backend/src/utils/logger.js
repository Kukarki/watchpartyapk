import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'watchparty-backend' },
  transports: [
    new winston.transports.Console({
      format: config.isDev ? combine(colorize(), simple()) : json(),
    }),
  ],
});