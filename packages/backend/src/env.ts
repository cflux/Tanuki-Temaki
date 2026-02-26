import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root (go up 3 levels: src -> backend -> packages -> root)
// In Docker, environment variables come from docker-compose.yml, so .env file is optional
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// Validate required and optional environment variables
const envSchema = z.object({
  // Required
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),
  FRONTEND_PORT: z.coerce.number().int().positive().default(5173),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Optional OAuth (validated only if provided)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Optional config
  ADMIN_USERNAMES: z.string().optional(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Environment validation failed:\n${formatted}`);
  process.exit(1);
}
