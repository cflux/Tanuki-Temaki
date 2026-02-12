import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import healthRouter from './routes/health.js';
import seriesRouter, { setDependencies } from './routes/series.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import passport from './config/passport.js';
import { prisma } from './lib/prisma.js';
import {
  extensionBridge,
  seriesCache,
  relationshipTracer,
} from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting - 100 requests per 15 minutes
app.use('/api', rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
}));

// Inject dependencies into routes
setDependencies(seriesCache, relationshipTracer);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/series', seriesRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server
const server = app.listen(PORT, () => {
  logger.info(`HTTP server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Extension connected: ${extensionBridge.isConnected()}`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  extensionBridge.close();
  logger.info('Extension bridge closed');

  await prisma.$disconnect();
  logger.info('Database connection closed');

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  shutdown();
});
