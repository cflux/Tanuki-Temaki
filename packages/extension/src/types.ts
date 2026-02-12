/**
 * Extension-specific types
 */

export interface ExtractedSeriesData {
  id: string;
  externalId: string;
  url: string;
  title: string;
  titleImage?: string;
  description?: string;
  rating?: number;
  ageRating?: string;
  languages?: string[];
  genres?: { name: string }[];
  contentAdvisory?: string[];
  [key: string]: any; // Allow additional fields
}

export interface ExtractedRelatedSeries {
  urls: string[];
}

export interface BackgroundMessage {
  requestId: string;
  action: 'FETCH_SERIES' | 'FETCH_RELATED';
  provider: string;
  seriesId?: string;
  url?: string;
}

export interface ContentResponse {
  requestId: string;
  data?: any;
  error?: string;
}
