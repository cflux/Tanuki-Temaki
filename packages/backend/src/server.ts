import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { HTTP_PORT, FRONTEND_URL, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from './config/constants.js';
import healthRouter from './routes/health.js';
import seriesRouter, { setDependencies as setSeriesDependencies } from './routes/series.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import recommendationsRouter, { setDependencies as setRecommendationsDependencies } from './routes/recommendations.js';
import tagsRouter from './routes/tags.js';
import testRouter from './routes/test.js';
import passport from './config/passport.js';
import { prisma } from './lib/prisma.js';
import {
  extensionBridge,
  seriesCache,
  relationshipTracer,
} from './index.js';
import { Scheduler } from './services/scheduler.js';

const app = express();

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting - 2000 requests per 15 minutes (generous for development and batch operations)
app.use('/api', rateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
}));

// Inject dependencies into routes
setSeriesDependencies(seriesCache, relationshipTracer);
setRecommendationsDependencies(relationshipTracer, seriesCache);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/series', seriesRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/test', testRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server
const server = app.listen(HTTP_PORT, () => {
  logger.info(`HTTP server listening on port ${HTTP_PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Extension connected: ${extensionBridge.isConnected()}`);

  // Start scheduled tasks
  Scheduler.start();
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  // Stop scheduled tasks
  Scheduler.stop();

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
