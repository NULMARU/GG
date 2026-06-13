import { describe, expect, it } from "vitest";
import { analyzeSourceUrl, extractYouTubeId, withAutoplay } from "./source";

describe("source analysis", () => {
  it("extracts YouTube ids from common URL shapes", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=CvFH_6DNRCY")).toBe(
      "CvFH_6DNRCY"
    );
    expect(extractYouTubeId("https://youtu.be/CvFH_6DNRCY")).toBe("CvFH_6DNRCY");
    expect(extractYouTubeId("https://www.youtube.com/embed/CvFH_6DNRCY")).toBe(
      "CvFH_6DNRCY"
    );
  });

  it("creates embeddable YouTube metadata without external API calls", () => {
    const analysis = analyzeSourceUrl("https://www.youtube.com/watch?v=ylXk1LBvIqU");

    expect(analysis.provider).toBe("youtube");
    expect(analysis.canEmbed).toBe(true);
    expect(analysis.sourceType).toBe("video");
    expect(analysis.embedUrl).toContain("youtube-nocookie.com/embed/ylXk1LBvIqU");
    expect(analysis.thumbnailUrl).toContain("i.ytimg.com/vi/ylXk1LBvIqU");
  });

  it("stores Suno and other music generation links as external creative sources", () => {
    const analysis = analyzeSourceUrl("https://suno.com/song/example-id");

    expect(analysis.provider).toBe("suno");
    expect(analysis.label).toBe("Suno");
    expect(analysis.sourceType).toBe("music-generation");
    expect(analysis.canEmbed).toBe(false);
  });

  it("detects direct audio files for in-app playback", () => {
    const analysis = analyzeSourceUrl("https://example.com/my-song.mp3");

    expect(analysis.provider).toBe("audio-file");
    expect(analysis.audioUrl).toBe("https://example.com/my-song.mp3");
    expect(analysis.sourceType).toBe("audio");
    expect(analysis.canEmbed).toBe(true);
  });

  it("adds autoplay parameters only when armed", () => {
    expect(withAutoplay("https://example.com/embed/1", false)).toBe(
      "https://example.com/embed/1"
    );
    expect(withAutoplay("https://example.com/embed/1", true)).toBe(
      "https://example.com/embed/1?autoplay=1&rel=0"
    );
  });
});
