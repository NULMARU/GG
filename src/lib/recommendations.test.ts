import { describe, expect, it } from "vitest";
import { seedTracks } from "../data/seedTracks";
import { recommendTracks } from "./recommendations";

describe("recommendations", () => {
  it("keeps the local personal and trend lanes at a 50:50 ratio", () => {
    const result = recommendTracks(seedTracks, {
      currentMood: "serene",
      currentSegment: "night",
      limit: 6
    });

    expect(result.personal).toHaveLength(3);
    expect(result.trend).toHaveLength(3);
    expect(result.combined).toHaveLength(6);
    expect(result.combined.filter((track) => track.catalogLane === "personal")).toHaveLength(3);
    expect(result.combined.filter((track) => track.catalogLane === "trend")).toHaveLength(3);
  });

  it("filters out tracks below the objective verification threshold", () => {
    const weakened = seedTracks.map((track) =>
      track.id === "miles-davis-so-what"
        ? { ...track, verification: { ...track.verification, score: 20 } }
        : track
    );

    const result = recommendTracks(weakened, { limit: 8 });

    expect(result.combined.some((track) => track.id === "miles-davis-so-what")).toBe(false);
  });
});
