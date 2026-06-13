import type { TimeSegment, Track } from "../types";

export const timeSegmentLabels: Record<TimeSegment, string> = {
  morning: "아침",
  midday: "점심",
  evening: "저녁",
  night: "밤"
};

export function getTimeSegment(date = new Date()): TimeSegment {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function selectTrackForTime(tracks: Track[], date = new Date()): Track | undefined {
  const segment = getTimeSegment(date);
  const candidates = tracks.filter((track) => track.timeFit.includes(segment));
  const pool = candidates.length > 0 ? candidates : tracks;

  return [...pool].sort((a, b) => {
    const aScore = a.verification.score + (a.catalogLane === "trend" ? 4 : 0) - a.energy;
    const bScore = b.verification.score + (b.catalogLane === "trend" ? 4 : 0) - b.energy;
    return bScore - aScore;
  })[0];
}
