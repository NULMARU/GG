import { describe, expect, it } from "vitest";
import {
  buildYouTubeVideoUrl,
  buildYouTubeSearchUrl,
  normalizeYouTubeVideoMetadata,
  normalizeYouTubeSearchItems,
  type YouTubeDataConfig
} from "./youtubeData";

const config: YouTubeDataConfig = {
  apiKey: "test-key"
};

describe("YouTube Data API adapter", () => {
  it("builds a YouTube Data API search URL for music videos", () => {
    const url = new URL(buildYouTubeSearchUrl(config, "ambient piano", 5));

    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("part")).toBe("snippet");
    expect(url.searchParams.get("q")).toBe("ambient piano");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("videoCategoryId")).toBe("10");
    expect(url.searchParams.get("maxResults")).toBe("5");
  });

  it("normalizes YouTube search results into playable track candidates", () => {
    const results = normalizeYouTubeSearchItems([
      {
        id: { videoId: "abc123" },
        snippet: {
          title: "A gentle song",
          description: "A calm piece",
          channelTitle: "Artist Channel",
          thumbnails: {
            high: { url: "https://example.com/high.jpg" }
          }
        }
      }
    ]);

    expect(results).toEqual([
      {
        videoId: "abc123",
        title: "A gentle song",
        link: "https://www.youtube.com/watch?v=abc123",
        snippet: "A calm piece",
        channelTitle: "Artist Channel",
        thumbnailUrl: "https://example.com/high.jpg"
      }
    ]);
  });

  it("builds and normalizes video metadata requests", () => {
    const url = new URL(buildYouTubeVideoUrl(config, "abc123"));
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/videos");
    expect(url.searchParams.get("part")).toBe("snippet");
    expect(url.searchParams.get("id")).toBe("abc123");

    expect(
      normalizeYouTubeVideoMetadata({
        snippet: {
          title: "A video title",
          description: "A description",
          channelTitle: "A channel",
          publishedAt: "2026-06-13T00:00:00Z",
          thumbnails: {
            maxres: { url: "https://example.com/max.jpg" }
          }
        }
      })
    ).toEqual({
      title: "A video title",
      description: "A description",
      channelTitle: "A channel",
      publishedAt: "2026-06-13T00:00:00Z",
      thumbnailUrl: "https://example.com/max.jpg"
    });
  });
});
