import { describe, expect, it } from "vitest";
import { buildYouTubeOembedUrl, normalizeYouTubeOembedMetadata } from "./youtubeOembed";

describe("YouTube oEmbed metadata", () => {
  it("builds an oEmbed URL without requiring an API key", () => {
    const url = new URL(
      buildYouTubeOembedUrl("https://www.youtube.com/watch?v=CvFH_6DNRCY")
    );

    expect(url.origin + url.pathname).toBe("https://www.youtube.com/oembed");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("url")).toBe(
      "https://www.youtube.com/watch?v=CvFH_6DNRCY"
    );
  });

  it("normalizes title, author and thumbnail", () => {
    expect(
      normalizeYouTubeOembedMetadata({
        title: "Song title",
        author_name: "Artist channel",
        thumbnail_url: "https://example.com/thumb.jpg"
      })
    ).toEqual({
      title: "Song title",
      authorName: "Artist channel",
      thumbnailUrl: "https://example.com/thumb.jpg"
    });
  });
});
