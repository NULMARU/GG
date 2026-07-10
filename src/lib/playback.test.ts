import { describe, expect, it } from "vitest";
import type { Track } from "../types";
import {
  filterLibrary,
  recordPlay,
  selectAdjacentTrack,
  selectQuickStartTrack
} from "./playback";

function track(partial: Partial<Track> & Pick<Track, "id" | "title">): Track {
  return {
    artist: "Artist",
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    genre: "Ambient",
    catalogLane: "personal",
    moods: ["serene"],
    energy: 2,
    valence: 7,
    timeFit: ["night"],
    verification: { score: 90, signals: [], note: "note" },
    ...partial
  };
}

describe("playback", () => {
  const library = [
    track({ id: "a", title: "Night Calm", liked: true, timeFit: ["night"], moods: ["nocturne"] }),
    track({
      id: "b",
      title: "Morning Light",
      userAdded: true,
      timeFit: ["morning"],
      moods: ["warm"],
      lastPlayedAt: "2020-01-01T00:00:00.000Z"
    }),
    track({
      id: "c",
      title: "Focus Flow",
      timeFit: ["midday"],
      moods: ["focus"],
      lastPlayedAt: "2099-01-01T00:00:00.000Z"
    })
  ];

  it("filters by query, mood, and library facets", () => {
    expect(filterLibrary(library, { query: "focus" }).map((item) => item.id)).toEqual(["c"]);
    expect(filterLibrary(library, { filter: "liked" }).map((item) => item.id)).toEqual(["a"]);
    expect(filterLibrary(library, { filter: "mine" }).map((item) => item.id)).toEqual(["b"]);
    expect(filterLibrary(library, { mood: "warm" }).map((item) => item.id)).toEqual(["b"]);
    expect(filterLibrary(library, { filter: "recent" }).map((item) => item.id)).toEqual([
      "c",
      "b"
    ]);
  });

  it("records play counts and timestamps", () => {
    const played = recordPlay(library[0], new Date("2026-07-10T12:00:00.000Z"));
    expect(played.playCount).toBe(1);
    expect(played.lastPlayedAt).toBe("2026-07-10T12:00:00.000Z");
  });

  it("selects next and previous tracks, wrapping around", () => {
    expect(selectAdjacentTrack(library, "a", "next")?.id).toBe("b");
    expect(selectAdjacentTrack(library, "a", "prev")?.id).toBe("c");
    expect(selectAdjacentTrack(library, "missing", "next")?.id).toBe("a");
  });

  it("picks a quick-start track for the current time segment", () => {
    const night = new Date("2026-07-10T23:00:00");
    const selected = selectQuickStartTrack(library, { now: night });
    expect(selected?.id).toBe("a");
  });
});
