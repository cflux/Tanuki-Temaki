/**
 * Post-build script to fix Firefox manifest
 * Removes Chrome-specific properties that Firefox doesn't recognize
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifestPath = join(__dirname, '../dist-firefox/manifest.json');

try {
  // Read manifest
  const manifestContent = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Remove use_dynamic_url from web_accessible_resources
  if (manifest.web_accessible_resources) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(resource => {
      const { use_dynamic_url, ...rest } = resource;
      return rest;
    });
  }

  // Write back
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✓ Fixed Firefox manifest (removed use_dynamic_url)');
} catch (error) {
  console.error('Error fixing Firefox manifest:', error);
  process.exit(1);
}
