import type { TimeSegment, Track } from "../types";

export const timeSegmentLabels: Record<TimeSegment, string> = {
  morning: "아침",
  midday: "점심",
  evening: "저녁",
  night: "밤"
};

export const timeSegmentHints: Record<TimeSegment, string> = {
  morning: "부드럽게 하루를 여는 곡",
  midday: "집중과 호흡을 위한 곡",
  evening: "긴장을 내려놓는 곡",
  night: "잠들기 전 고요한 곡"
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
  const playable = tracks.filter((track) => track.sourceUrl.trim().length > 0);
  const base = playable.length > 0 ? playable : tracks;
  const candidates = base.filter((track) => track.timeFit.includes(segment));
  const pool = candidates.length > 0 ? candidates : base;

  return [...pool].sort((a, b) => {
    const liked = (track: Track) => (track.liked ? 16 : 0);
    const recentPenalty = (track: Track) => {
      if (!track.lastPlayedAt) return 0;
      const hours = (Date.now() - Date.parse(track.lastPlayedAt)) / (1000 * 60 * 60);
      return hours < 6 ? 12 : 0;
    };
    const aScore =
      a.verification.score +
      liked(a) +
      (a.catalogLane === "personal" ? 4 : 0) -
      a.energy -
      recentPenalty(a);
    const bScore =
      b.verification.score +
      liked(b) +
      (b.catalogLane === "personal" ? 4 : 0) -
      b.energy -
      recentPenalty(b);
    return bScore - aScore;
  })[0];
}
