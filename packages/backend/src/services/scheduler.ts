import { logger } from '../lib/logger.js';
import { GenreCollectionService } from './genreCollection.js';
import { CACHE_EXPIRATION } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';

// ── DB settings keys ──────────────────────────────────────────────────────────
const EXPAND_ENABLED  = 'expand_database_enabled';
const EXPAND_TIME     = 'expand_database_time';      // "HH:MM" 24-hour
const EXPAND_LAST_RUN = 'expand_database_last_run';
const EXPAND_STATUS   = 'expand_database_status';    // 'running' | 'success' | 'failed'
const EXPAND_ERROR    = 'expand_database_error';     // error message, empty string when none

const REFRESH_ENABLED    = 'refresh_cache_enabled';
const REFRESH_TIME       = 'refresh_cache_time';       // "HH:MM" 24-hour
const REFRESH_LIMIT      = 'refresh_cache_limit';
const REFRESH_STALE_DAYS = 'refresh_cache_stale_days';
const REFRESH_LAST_RUN   = 'refresh_cache_last_run';
const REFRESH_STATUS     = 'refresh_cache_status';    // 'running' | 'success' | 'failed'
const REFRESH_ERROR      = 'refresh_cache_error';     // error message, empty string when none

// ── Public types ──────────────────────────────────────────────────────────────
export type JobStatus = 'running' | 'success' | 'failed' | null;

export interface ExpandJob {
  enabled: boolean;
  time: string;          // "HH:MM"
  lastRunAt: string | null;
  lastRunStatus: JobStatus;
  lastRunError: string | null;
}

export interface RefreshCacheJob {
  enabled: boolean;
  time: string;          // "HH:MM"
  limit: number;
  staleDays: number;
  lastRunAt: string | null;
  lastRunStatus: JobStatus;
  lastRunError: string | null;
}

export interface Schedule {
  expand: ExpandJob;
  refreshCache: RefreshCacheJob;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export class Scheduler {
  private static genreInterval: NodeJS.Timeout | null = null;
  private static checkTimeout: NodeJS.Timeout | null = null;
  private static checkInterval: NodeJS.Timeout | null = null;

  // In-memory config snapshot — avoids a DB read every minute
  private static expandConfig: ExpandJob = { enabled: false, time: '00:00', lastRunAt: null, lastRunStatus: null, lastRunError: null };
  private static refreshConfig: RefreshCacheJob = { enabled: false, time: '02:00', limit: 10, staleDays: 7, lastRunAt: null, lastRunStatus: null, lastRunError: null };

  // Injected dependencies
  private static relationshipTracer: { traceRelationships: (url: string, depth: number) => Promise<any> } | null = null;
  private static seriesCache: { refreshStale: (limit: number, staleDays: number) => Promise<{ refreshed: number; skipped: number }> } | null = null;

  static setRelationshipTracer(tracer: { traceRelationships: (url: string, depth: number) => Promise<any> }) {
    Scheduler.relationshipTracer = tracer;
  }

  static setSeriesCache(cache: { refreshStale: (limit: number) => Promise<{ refreshed: number; skipped: number }> }) {
    Scheduler.seriesCache = cache;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  static async start(): Promise<void> {
    logger.info('Starting scheduled tasks');

    // Genre refresh — interval-based, unchanged
    Scheduler.genreInterval = setInterval(async () => {
      try {
        await GenreCollectionService.refreshGenreCollection();
      } catch (error) {
        logger.error('Failed to refresh genre collection (scheduled)', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, CACHE_EXPIRATION.GENRE_COLLECTION);

    GenreCollectionService.getGenreCollection()
      .then(() => logger.info('Genre collection initialized on startup'))
      .catch((error) =>
        logger.error('Failed to initialize genre collection on startup', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );

    // Load job configs from DB into memory
    try {
      const schedule = await Scheduler.getSchedule();
      Scheduler.expandConfig = schedule.expand;
      Scheduler.refreshConfig = schedule.refreshCache;
      logger.info('Loaded job schedules from DB', { expand: schedule.expand, refreshCache: schedule.refreshCache });
    } catch (error) {
      logger.error('Failed to load schedules from DB — using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Run an immediate check so a server that starts within the scheduled minute
    // still catches the job (setInterval alone would skip the first 60s window).
    Scheduler._checkMinute().catch((err) =>
      logger.error('Scheduler startup check error', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    // Align to the next minute boundary, then run every 60s to prevent drift.
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    Scheduler.checkTimeout = setTimeout(() => {
      Scheduler.checkTimeout = null;
      Scheduler._checkMinute().catch((err) =>
        logger.error('Scheduler minute-check error', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
      Scheduler.checkInterval = setInterval(() => {
        Scheduler._checkMinute().catch((err) =>
          logger.error('Scheduler minute-check error', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
      }, 60 * 1000);
    }, msUntilNextMinute);

    logger.info('Scheduled tasks started');
  }

  static stop(): void {
    logger.info('Stopping scheduled tasks');
    if (Scheduler.genreInterval) { clearInterval(Scheduler.genreInterval); Scheduler.genreInterval = null; }
    if (Scheduler.checkTimeout) { clearTimeout(Scheduler.checkTimeout); Scheduler.checkTimeout = null; }
    if (Scheduler.checkInterval) { clearInterval(Scheduler.checkInterval); Scheduler.checkInterval = null; }
    logger.info('All scheduled tasks stopped');
  }

  // ── Config API ──────────────────────────────────────────────────────────────

  static async getSchedule(): Promise<Schedule> {
    const keys = [
      EXPAND_ENABLED, EXPAND_TIME, EXPAND_LAST_RUN, EXPAND_STATUS, EXPAND_ERROR,
      REFRESH_ENABLED, REFRESH_TIME, REFRESH_LIMIT, REFRESH_STALE_DAYS, REFRESH_LAST_RUN, REFRESH_STATUS, REFRESH_ERROR,
    ];
    const settings = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    return {
      expand: {
        enabled: map[EXPAND_ENABLED] === 'true',
        time: map[EXPAND_TIME] ?? '00:00',
        lastRunAt: map[EXPAND_LAST_RUN] ?? null,
        lastRunStatus: (map[EXPAND_STATUS] as JobStatus) ?? null,
        lastRunError: map[EXPAND_ERROR] || null,
      },
      refreshCache: {
        enabled: map[REFRESH_ENABLED] === 'true',
        time: map[REFRESH_TIME] ?? '02:00',
        limit: map[REFRESH_LIMIT] ? parseInt(map[REFRESH_LIMIT], 10) : 10,
        staleDays: map[REFRESH_STALE_DAYS] ? parseInt(map[REFRESH_STALE_DAYS], 10) : 7,
        lastRunAt: map[REFRESH_LAST_RUN] ?? null,
        lastRunStatus: (map[REFRESH_STATUS] as JobStatus) ?? null,
        lastRunError: map[REFRESH_ERROR] || null,
      },
    };
  }

  static async updateSchedule(
    expand: Omit<ExpandJob, 'lastRunAt'>,
    refreshCache: Omit<RefreshCacheJob, 'lastRunAt'>
  ): Promise<Schedule> {
    await Promise.all([
      prisma.systemSetting.upsert({ where: { key: EXPAND_ENABLED },    update: { value: String(expand.enabled) },           create: { key: EXPAND_ENABLED,    value: String(expand.enabled) } }),
      prisma.systemSetting.upsert({ where: { key: EXPAND_TIME },       update: { value: expand.time },                      create: { key: EXPAND_TIME,       value: expand.time } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_ENABLED },   update: { value: String(refreshCache.enabled) },     create: { key: REFRESH_ENABLED,   value: String(refreshCache.enabled) } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_TIME },      update: { value: refreshCache.time },                create: { key: REFRESH_TIME,      value: refreshCache.time } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_LIMIT },     update: { value: String(refreshCache.limit) },       create: { key: REFRESH_LIMIT,     value: String(refreshCache.limit) } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_STALE_DAYS }, update: { value: String(refreshCache.staleDays) }, create: { key: REFRESH_STALE_DAYS, value: String(refreshCache.staleDays) } }),
    ]);

    // Refresh in-memory snapshot
    const schedule = await Scheduler.getSchedule();
    Scheduler.expandConfig = schedule.expand;
    Scheduler.refreshConfig = schedule.refreshCache;

    logger.info('Schedule updated', { expand, refreshCache });
    return schedule;
  }

  // ── Run-now API ──────────────────────────────────────────────────────────────

  static async runExpandNow(): Promise<void> {
    logger.info('Manual trigger: expand job');
    await Scheduler._runExpandJob();
  }

  static async runRefreshNow(): Promise<void> {
    logger.info('Manual trigger: refresh cache job');
    await Scheduler._runRefreshCacheJob();
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private static async _checkMinute(): Promise<void> {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toDateString();

    // Expand database job
    if (Scheduler.expandConfig.enabled && Scheduler.expandConfig.time === hhmm) {
      const lastRun = Scheduler.expandConfig.lastRunAt;
      if (!lastRun || new Date(lastRun).toDateString() !== today) {
        logger.info('Time-triggered: expand job', { time: hhmm });
        await Scheduler._runExpandJob();
      }
    }

    // Refresh stale cache job
    if (Scheduler.refreshConfig.enabled && Scheduler.refreshConfig.time === hhmm) {
      const lastRun = Scheduler.refreshConfig.lastRunAt;
      if (!lastRun || new Date(lastRun).toDateString() !== today) {
        logger.info('Time-triggered: refresh cache job', { time: hhmm });
        await Scheduler._runRefreshCacheJob();
      }
    }
  }

  private static async _runExpandJob(): Promise<void> {
    if (!Scheduler.relationshipTracer) {
      logger.warn('Expand job skipped: relationshipTracer not injected');
      return;
    }

    logger.info('Running scheduled expand job');

    // Record that the job has started — so we know it ran even if it fails
    const startedAt = new Date().toISOString();
    await Promise.all([
      prisma.systemSetting.upsert({ where: { key: EXPAND_LAST_RUN }, update: { value: startedAt }, create: { key: EXPAND_LAST_RUN, value: startedAt } }),
      prisma.systemSetting.upsert({ where: { key: EXPAND_STATUS },   update: { value: 'running' }, create: { key: EXPAND_STATUS,   value: 'running' } }),
      prisma.systemSetting.upsert({ where: { key: EXPAND_ERROR },    update: { value: '' },        create: { key: EXPAND_ERROR,    value: '' } }),
    ]);
    Scheduler.expandConfig.lastRunAt = startedAt;
    Scheduler.expandConfig.lastRunStatus = 'running';
    Scheduler.expandConfig.lastRunError = null;

    try {
      const candidates = await prisma.series.findMany({
        where: { AND: [{ relatedFrom: { none: {} } }, { relatedTo: { none: {} } }] },
        take: 10,
        orderBy: { fetchedAt: 'asc' },
      });

      logger.info(`Expand job: ${candidates.length} series with no relationships`);
      for (const series of candidates) {
        try {
          await Scheduler.relationshipTracer.traceRelationships(series.url, 1);
          logger.info(`Expand job: traced ${series.title}`);
        } catch (err) {
          logger.error(`Expand job: failed to trace ${series.title}`, {
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      await Promise.all([
        prisma.systemSetting.upsert({ where: { key: EXPAND_STATUS }, update: { value: 'success' }, create: { key: EXPAND_STATUS, value: 'success' } }),
        prisma.systemSetting.upsert({ where: { key: EXPAND_ERROR },  update: { value: '' },        create: { key: EXPAND_ERROR,  value: '' } }),
      ]);
      Scheduler.expandConfig.lastRunStatus = 'success';
      Scheduler.expandConfig.lastRunError = null;
      logger.info('Scheduled expand job complete');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Scheduled expand job failed', { error: errMsg });
      await Promise.all([
        prisma.systemSetting.upsert({ where: { key: EXPAND_STATUS }, update: { value: 'failed' }, create: { key: EXPAND_STATUS, value: 'failed' } }),
        prisma.systemSetting.upsert({ where: { key: EXPAND_ERROR },  update: { value: errMsg },   create: { key: EXPAND_ERROR,  value: errMsg } }),
      ]);
      Scheduler.expandConfig.lastRunStatus = 'failed';
      Scheduler.expandConfig.lastRunError = errMsg;
    }
  }

  private static async _runRefreshCacheJob(): Promise<void> {
    if (!Scheduler.seriesCache) {
      logger.warn('Refresh cache job skipped: seriesCache not injected');
      return;
    }

    const { limit, staleDays } = Scheduler.refreshConfig;
    logger.info('Running scheduled refresh cache job', { limit, staleDays });

    // Record that the job has started — so we know it ran even if it fails
    const startedAt = new Date().toISOString();
    await Promise.all([
      prisma.systemSetting.upsert({ where: { key: REFRESH_LAST_RUN }, update: { value: startedAt }, create: { key: REFRESH_LAST_RUN, value: startedAt } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_STATUS },   update: { value: 'running' }, create: { key: REFRESH_STATUS,   value: 'running' } }),
      prisma.systemSetting.upsert({ where: { key: REFRESH_ERROR },    update: { value: '' },        create: { key: REFRESH_ERROR,    value: '' } }),
    ]);
    Scheduler.refreshConfig.lastRunAt = startedAt;
    Scheduler.refreshConfig.lastRunStatus = 'running';
    Scheduler.refreshConfig.lastRunError = null;

    try {
      const { refreshed, skipped } = await Scheduler.seriesCache.refreshStale(limit, staleDays);
      logger.info('Refresh cache job complete', { refreshed, skipped });

      await Promise.all([
        prisma.systemSetting.upsert({ where: { key: REFRESH_STATUS }, update: { value: 'success' }, create: { key: REFRESH_STATUS, value: 'success' } }),
        prisma.systemSetting.upsert({ where: { key: REFRESH_ERROR },  update: { value: '' },        create: { key: REFRESH_ERROR,  value: '' } }),
      ]);
      Scheduler.refreshConfig.lastRunStatus = 'success';
      Scheduler.refreshConfig.lastRunError = null;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Scheduled refresh cache job failed', { error: errMsg });
      await Promise.all([
        prisma.systemSetting.upsert({ where: { key: REFRESH_STATUS }, update: { value: 'failed' }, create: { key: REFRESH_STATUS, value: 'failed' } }),
        prisma.systemSetting.upsert({ where: { key: REFRESH_ERROR },  update: { value: errMsg },   create: { key: REFRESH_ERROR,  value: errMsg } }),
      ]);
      Scheduler.refreshConfig.lastRunStatus = 'failed';
      Scheduler.refreshConfig.lastRunError = errMsg;
    }
  }
}
