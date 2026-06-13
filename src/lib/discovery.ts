import type { Track } from "../types";

function searchableText(track: Track): string {
  return [
    track.title,
    track.artist,
    track.genre,
    track.moods.join(" "),
    track.verification.note,
    track.verification.signals.map((signal) => signal.label).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

export function findCuratedMatches(query: string, tracks: Track[], limit = 4): Track[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [];

  return [...tracks]
    .map((track) => {
      const text = searchableText(track);
      const tokenScore = tokens.reduce(
        (score, token) => score + (text.includes(token) ? 16 : 0),
        0
      );
      const qualityBoost = track.verification.score / 10;
      const trendBoost = track.catalogLane === "trend" ? 4 : 0;
      return { track, score: tokenScore + qualityBoost + trendBoost };
    })
    .filter((item) => item.score > item.track.verification.score / 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.track);
}
