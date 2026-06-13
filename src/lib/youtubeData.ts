export interface YouTubeDataConfig {
  apiKey: string;
}

export interface YouTubeSearchItem {
  title: string;
  link: string;
  snippet: string;
  channelTitle: string;
  videoId: string;
  thumbnailUrl?: string;
}

export interface YouTubeVideoMetadata {
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

interface RawYouTubeSearchItem {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface RawYouTubeSearchResponse {
  items?: RawYouTubeSearchItem[];
  error?: {
    message?: string;
  };
}

interface RawYouTubeVideoItem {
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
      maxres?: { url?: string };
    };
  };
}

interface RawYouTubeVideosResponse {
  items?: RawYouTubeVideoItem[];
  error?: {
    message?: string;
  };
}

export function getYouTubeDataConfig(): YouTubeDataConfig | undefined {
  const apiKey = import.meta.env.VITE_YOUTUBE_DATA_API_KEY;
  if (!apiKey) return undefined;
  return { apiKey };
}

export function isYouTubeDataConfigured(): boolean {
  return Boolean(getYouTubeDataConfig());
}

export function buildYouTubeSearchUrl(
  config: YouTubeDataConfig,
  query: string,
  resultCount = 5
): string {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", String(Math.min(Math.max(resultCount, 1), 10)));
  url.searchParams.set("safeSearch", "moderate");
  return url.toString();
}

export function buildYouTubeVideoUrl(
  config: YouTubeDataConfig,
  videoId: string
): string {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  return url.toString();
}

export function normalizeYouTubeSearchItems(
  items: RawYouTubeSearchItem[] = []
): YouTubeSearchItem[] {
  return items
    .filter((item) => item.id?.videoId && item.snippet?.title)
    .map((item) => {
      const videoId = item.id?.videoId ?? "";
      const snippet = item.snippet;

      return {
        videoId,
        title: snippet?.title ?? "Untitled video",
        link: `https://www.youtube.com/watch?v=${videoId}`,
        snippet: snippet?.description ?? "",
        channelTitle: snippet?.channelTitle ?? "YouTube",
        thumbnailUrl:
          snippet?.thumbnails?.high?.url ??
          snippet?.thumbnails?.medium?.url ??
          snippet?.thumbnails?.default?.url
      };
    });
}

export function normalizeYouTubeVideoMetadata(
  item?: RawYouTubeVideoItem
): YouTubeVideoMetadata | undefined {
  const snippet = item?.snippet;
  if (!snippet?.title) return undefined;

  return {
    title: snippet.title,
    channelTitle: snippet.channelTitle ?? "YouTube",
    description: snippet.description ?? "",
    publishedAt: snippet.publishedAt,
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ??
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url
  };
}

export async function searchYouTubeMusic(
  query: string,
  config = getYouTubeDataConfig()
): Promise<YouTubeSearchItem[]> {
  if (!config) {
    throw new Error(".env.local에 YouTube Data API 키가 없습니다.");
  }

  const enrichedQuery = `${query} official music`;
  const response = await fetch(buildYouTubeSearchUrl(config, enrichedQuery, 5));
  const payload = (await response.json()) as RawYouTubeSearchResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "YouTube 검색 요청에 실패했습니다.");
  }

  return normalizeYouTubeSearchItems(payload.items);
}

export async function fetchYouTubeVideoMetadata(
  videoId: string,
  config = getYouTubeDataConfig()
): Promise<YouTubeVideoMetadata> {
  if (!config) {
    throw new Error(".env.local 또는 GitHub Actions secret에 YouTube Data API 키가 없습니다.");
  }

  const response = await fetch(buildYouTubeVideoUrl(config, videoId));
  const payload = (await response.json()) as RawYouTubeVideosResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "YouTube 영상 정보를 가져오지 못했습니다.");
  }

  const metadata = normalizeYouTubeVideoMetadata(payload.items?.[0]);
  if (!metadata) {
    throw new Error("YouTube 영상 정보를 찾지 못했습니다.");
  }

  return metadata;
}
