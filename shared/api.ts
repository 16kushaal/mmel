/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Music search and trend analysis types
 */
export interface MusicSearchRequest {
  query: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  releaseYear?: number;
  genre?: string[];
  popularity: number;
}

export interface MusicSearchResponse {
  tracks: MusicTrack[];
  total: number;
}

export interface TrendDataPoint {
  date: string;
  susceptible: number;
  exposed?: number;
  infected: number;
  recovered?: number;
  totalPopulation: number;
}

export interface ModelParameters {
  beta: number; // Transmission rate (discovery/spread rate)
  gamma: number; // Recovery rate (loss of interest rate)
  sigma?: number; // Incubation rate (exposure to active listening rate) - SEIR only
  initialInfected: number; // Initial fans
  totalPopulation: number;
}

export interface TrendAnalysisRequest {
  trackId: string;
  modelType: "SIS" | "SEIR";
  timeRange: {
    start: string; // ISO date
    end: string; // ISO date
  };
  predictionDays: number;
}

export interface TrendAnalysisResponse {
  track: MusicTrack;
  modelType: "SIS" | "SEIR";
  parameters: ModelParameters;
  historicalData: TrendDataPoint[];
  predictions: TrendDataPoint[];
  insights: {
    peakDate: string;
    peakListeners: number;
    currentTrend: "rising" | "declining" | "stable";
    futureOutlook:
      | "viral_potential"
      | "steady_decline"
      | "comeback_likely"
      | "stable_niche";
  };
}
