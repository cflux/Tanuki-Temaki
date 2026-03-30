import { CORVID_CACHE_URL } from '../config/constants.js';
import { logger } from '../lib/logger.js';

interface SupportedService {
  name: string;
  display_name: string;
  url_pattern: string;
}

interface ServicesResponse {
  services: SupportedService[];
}

let cachedServices: SupportedService[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class CorvidCacheService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = CORVID_CACHE_URL;
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async getSupportedServices(): Promise<SupportedService[]> {
    if (!this.isConfigured()) return [];

    if (cachedServices && Date.now() < cacheExpiry) {
      return cachedServices;
    }

    try {
      const resp = await fetch(`${this.baseUrl}/api/services`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: ServicesResponse = await resp.json();
      cachedServices = data.services;
      cacheExpiry = Date.now() + CACHE_TTL;
      return cachedServices;
    } catch (error) {
      logger.warn('Failed to reach Corvid Cache', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async createRequest(params: {
    url: string;
    service: string;
    title?: string;
    image?: string;
  }): Promise<{ id: number }> {
    if (!this.isConfigured()) {
      throw new Error('Corvid Cache is not configured');
    }

    const resp = await fetch(`${this.baseUrl}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: params.url,
        service: params.service,
        title: params.title,
        image: params.image,
        requested_by: 'tanuki-temaki',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.detail || `Corvid Cache returned ${resp.status}`);
    }

    return resp.json();
  }
}

export const corvidCacheService = new CorvidCacheService();
