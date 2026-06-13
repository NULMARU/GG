import { describe, expect, it } from "vitest";
import { seedTracks } from "../data/seedTracks";
import { getTimeSegment, selectTrackForTime } from "./timeSegments";

describe("time segments", () => {
  it("maps local clock hours to listening segments", () => {
    expect(getTimeSegment(new Date("2026-06-13T06:00:00"))).toBe("morning");
    expect(getTimeSegment(new Date("2026-06-13T12:00:00"))).toBe("midday");
    expect(getTimeSegment(new Date("2026-06-13T19:00:00"))).toBe("evening");
    expect(getTimeSegment(new Date("2026-06-13T23:00:00"))).toBe("night");
  });

  it("selects a track that fits the current time lane", () => {
    const track = selectTrackForTime(seedTracks, new Date("2026-06-13T23:00:00"));

    expect(track?.timeFit).toContain("night");
  });
});
