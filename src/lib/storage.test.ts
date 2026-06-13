import { afterEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";
import { loadUserTracks, saveUserTracks } from "./storage";

const storageKey = "healing-music-playlist:v1";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear()
  };
}

function createTrack(): Track {
  return {
    id: "test-track",
    title: "Test Track",
    artist: "Me",
    sourceUrl: "https://example.com/song.mp3",
    genre: "Personal",
    catalogLane: "personal",
    moods: ["serene"],
    energy: 3,
    valence: 7,
    timeFit: ["evening"],
    verification: {
      score: 78,
      signals: [
        { label: "personal intent", weight: 28 },
        { label: "source provided", weight: 24 },
        { label: "local curation pending", weight: 20 },
        { label: "개인 보관", weight: 24 }
      ],
      note: "사용자가 직접 추가한 개인용 소스."
    },
    lyrics: "line one\nline two"
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage", () => {
  it("removes hidden verification labels while preserving direct lyrics", () => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage });
    localStorage.setItem(storageKey, JSON.stringify([createTrack()]));

    expect(loadUserTracks()[0]).toMatchObject({
      lyrics: "line one\nline two",
      verification: {
        signals: [{ label: "개인 보관", weight: 24 }]
      }
    });

    saveUserTracks([createTrack()]);
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as Track[];
    expect(stored[0].verification.signals.map((signal) => signal.label)).toEqual([
      "개인 보관"
    ]);
  });
});
