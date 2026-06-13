export type Mood =
  | "serene"
  | "warm"
  | "focus"
  | "melancholy"
  | "uplift"
  | "nocturne"
  | "cinematic"
  | "earthy"
  | "dreamy"
  | "vital";

export type TimeSegment = "morning" | "midday" | "evening" | "night";

export type Provider =
  | "youtube"
  | "vimeo"
  | "soundcloud"
  | "spotify"
  | "suno"
  | "udio"
  | "stable-audio"
  | "audio-file"
  | "generic";

export type CatalogLane = "personal" | "trend";

export interface VerificationSignal {
  label: string;
  weight: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  sourceUrl: string;
  genre: string;
  year?: number;
  catalogLane: CatalogLane;
  moods: Mood[];
  energy: number;
  valence: number;
  timeFit: TimeSegment[];
  verification: {
    score: number;
    signals: VerificationSignal[];
    note: string;
  };
  imageUrl?: string;
  discoveryPrompt?: string;
  userAdded?: boolean;
  addedAt?: string;
  playCount?: number;
  liked?: boolean;
}

export interface SourceAnalysis {
  provider: Provider;
  sourceUrl: string;
  embedUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  externalUrl: string;
  canEmbed: boolean;
  label: string;
  sourceType: "video" | "audio" | "music-generation" | "external" | "unknown";
}

export interface ThemeProfile {
  name: string;
  accent: string;
  accentStrong: string;
  text: string;
  muted: string;
  surface: string;
  surfaceAlt: string;
  background: string;
  border: string;
  meterA: string;
  meterB: string;
  meterC: string;
}

export interface RecommendationResult {
  personal: Track[];
  trend: Track[];
  combined: Track[];
}

export interface TrackDraft {
  title: string;
  artist: string;
  sourceUrl: string;
  genre: string;
  moods: Mood[];
  energy: number;
  valence: number;
  timeFit: TimeSegment[];
  discoveryPrompt?: string;
  imageUrl?: string;
}
