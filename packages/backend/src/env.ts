import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root (go up 3 levels: src -> backend -> packages -> root)
const envPath = resolve(__dirname, '../../../.env');
const result = config({ path: envPath });

if (result.error) {
  console.error('[ENV] Failed to load .env:', result.error);
} else {
  console.log('[ENV] Loaded .env from:', envPath);
  console.log('[ENV] HOST:', process.env.HOST);
}
