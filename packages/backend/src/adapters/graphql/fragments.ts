/**
 * Reusable GraphQL fragments for AniList queries
 * Centralizes media field definitions to avoid duplication
 */

/**
 * Core media fields used across all AniList media queries
 * Includes all standard fields needed for series data
 */
export const MEDIA_FIELDS = `
  id
  type
  title {
    romaji
    english
    native
  }
  description
  genres
  tags {
    name
    rank
    isMediaSpoiler
  }
  averageScore
  popularity
  format
  status
  episodes
  chapters
  volumes
  duration
  season
  seasonYear
  coverImage {
    large
  }
  externalLinks {
    url
    site
    type
  }
`;

/**
 * Page info fields for paginated queries
 */
export const PAGE_INFO_FIELDS = `
  pageInfo {
    total
    perPage
  }
`;

/**
 * Build a genre search query
 * @param includeTypeFilter - Whether to include the $type parameter in the query
 */
export function buildGenreSearchQuery(includeTypeFilter: boolean): string {
  if (includeTypeFilter) {
    return `
      query ($genre_in: [String], $type: MediaType, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          ${PAGE_INFO_FIELDS}
          media(genre_in: $genre_in, type: $type, sort: [POPULARITY_DESC, SCORE_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
  } else {
    return `
      query ($genre_in: [String], $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          ${PAGE_INFO_FIELDS}
          media(genre_in: $genre_in, sort: [POPULARITY_DESC, SCORE_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
  }
}

/**
 * Build a tag search query
 * @param includeTypeFilter - Whether to include the $type parameter in the query
 */
export function buildTagSearchQuery(includeTypeFilter: boolean): string {
  if (includeTypeFilter) {
    return `
      query ($tag_in: [String], $type: MediaType, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          ${PAGE_INFO_FIELDS}
          media(tag_in: $tag_in, type: $type, sort: [POPULARITY_DESC, SCORE_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
  } else {
    return `
      query ($tag_in: [String], $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          ${PAGE_INFO_FIELDS}
          media(tag_in: $tag_in, sort: [POPULARITY_DESC, SCORE_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
  }
}
