import { describe, expect, it } from "vitest";
import { applySourceMetadataPatch, analyzeSourceMetadata } from "./sourceMetadata";
import type { TrackDraft } from "../types";
import { vi } from "vitest";

describe("source metadata", () => {
  it("fills YouTube metadata from oEmbed before requiring the Data API", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          title: "CLAUDE DEBUSSY: CLAIR DE LUNE",
          author_name: "CHANNEL 3 YOUTUBE",
          thumbnail_url: "https://example.com/thumb.jpg"
        })
      )
    );

    await expect(
      analyzeSourceMetadata("https://www.youtube.com/watch?v=CvFH_6DNRCY")
    ).resolves.toMatchObject({
      title: "CLAUDE DEBUSSY: CLAIR DE LUNE",
      artist: "CHANNEL 3 YOUTUBE",
      genre: "YouTube Music",
      imageUrl: "https://example.com/thumb.jpg"
    });

    vi.stubGlobal("fetch", originalFetch);
  });

  it("infers direct audio metadata from filenames", async () => {
    const metadata = await analyzeSourceMetadata("https://example.com/my-calm-song.mp3");

    expect(metadata.title).toBe("my calm song");
    expect(metadata.genre).toBe("Audio File");
  });

  it("detects music generation app sources", async () => {
    const metadata = await analyzeSourceMetadata("https://suno.com/song/my-healing-draft");

    expect(metadata.title).toBe("my healing draft");
    expect(metadata.artist).toBe("Me");
    expect(metadata.genre).toBe("Suno Generated Music");
  });

  it("applies metadata without erasing existing unavailable fields", () => {
    const draft: TrackDraft = {
      title: "",
      artist: "Existing Artist",
      sourceUrl: "https://example.com/song.mp3",
      genre: "Personal",
      moods: ["serene"],
      energy: 3,
      valence: 7,
      timeFit: ["morning"]
    };

    expect(
      applySourceMetadataPatch(draft, {
        title: "Source Title",
        genre: "Audio File",
        note: "ok"
      })
    ).toMatchObject({
      title: "Source Title",
      artist: "Existing Artist",
      genre: "Audio File"
    });
  });
});
