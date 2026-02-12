import { Router, type Router as RouterType } from 'express';
import { prisma } from '../lib/prisma.js';

const router: RouterType = Router();

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      uptime: process.uptime(),
    });
  }
});

export default router;
