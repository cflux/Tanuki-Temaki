/**
 * Normalize streaming/reading service names to canonical versions
 */
export function normalizeServiceName(name: string): string {
  const lower = name.toLowerCase();

  // Amazon variations
  if (lower.includes('amazon') || lower === 'prime video') {
    return 'Amazon Prime Video';
  }
  // Crunchyroll variations
  if (lower.includes('crunchyroll') && !lower.includes('manga')) {
    return 'Crunchyroll';
  }
  if (lower.includes('crunchyroll') && lower.includes('manga')) {
    return 'Crunchyroll Manga';
  }
  // HBO variations
  if (lower.includes('hbo')) {
    return 'HBO Max';
  }
  // Return original if no normalization needed
  return name;
}
