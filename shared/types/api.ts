import { Series, SeriesRelationship } from './series';

// API Request types
export interface FetchSeriesRequest {
  url: string;
  forceRefresh?: boolean;
}

export interface TraceRelationshipsRequest {
  maxDepth?: number;
}

// API Response types
export interface FetchSeriesResponse extends Series {}

export interface TraceRelationshipsResponse extends SeriesRelationship {}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected';
  extension: 'connected' | 'disconnected';
}

// Extension Communication types
export interface ExtensionRequest {
  requestId: string;
  action: 'FETCH_SERIES' | 'FETCH_RELATED';
  provider: string;
  seriesId?: string;
  url?: string;
}

export interface ExtensionResponse {
  requestId: string;
  data?: any;
  error?: string;
}
