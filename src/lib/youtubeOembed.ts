export interface YouTubeOembedMetadata {
  title: string;
  authorName: string;
  thumbnailUrl?: string;
}

interface RawYouTubeOembedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

export function buildYouTubeOembedUrl(sourceUrl: string): string {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", sourceUrl);
  url.searchParams.set("format", "json");
  return url.toString();
}

export function normalizeYouTubeOembedMetadata(
  payload: RawYouTubeOembedResponse
): YouTubeOembedMetadata | undefined {
  if (!payload.title) return undefined;

  return {
    title: payload.title,
    authorName: payload.author_name ?? "YouTube",
    thumbnailUrl: payload.thumbnail_url
  };
}

export async function fetchYouTubeOembedMetadata(
  sourceUrl: string
): Promise<YouTubeOembedMetadata> {
  const response = await fetch(buildYouTubeOembedUrl(sourceUrl));
  const payload = (await response.json()) as RawYouTubeOembedResponse;

  if (!response.ok) {
    throw new Error("YouTube oEmbed 정보를 가져오지 못했습니다.");
  }

  const metadata = normalizeYouTubeOembedMetadata(payload);
  if (!metadata) {
    throw new Error("YouTube oEmbed 제목 정보를 찾지 못했습니다.");
  }

  return metadata;
}
