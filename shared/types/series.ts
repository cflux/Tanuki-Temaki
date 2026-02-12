export interface Series {
  id: string;
  provider: 'crunchyroll' | 'anilist' | string;
  mediaType: 'ANIME' | 'MANGA';
  externalId: string;
  url: string;

  title: string;
  titleImage?: string;
  description: string;
  rating?: number;
  ageRating?: string;
  languages: string[];
  genres: string[];
  contentAdvisory: string[];

  tags: Tag[];

  metadata: Record<string, any>;
  fetchedAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  value: string;
  source: 'genre' | 'content' | 'description' | 'manual';
  confidence: number;
  category?: string;
}

export interface SeriesRelationship {
  rootId: string;
  nodes: SeriesNode[];
  edges: RelationshipEdge[];
}

export interface SeriesNode {
  series: Series;
  depth: number;
  cluster?: string;
}

export interface RelationshipEdge {
  from: string;
  to: string;
  similarity: number;
  sharedTags: string[];
  relationType?: string;
}

// Raw data from providers (before normalization)
export interface RawSeriesData {
  provider: string;
  mediaType: 'ANIME' | 'MANGA';
  externalId: string;
  url: string;
  title: string;
  titleImage?: string;
  description: string;
  rating?: number;
  ageRating?: string;
  languages: string[];
  genres: string[];
  contentAdvisory: string[];
  metadata: Record<string, any>;
}
