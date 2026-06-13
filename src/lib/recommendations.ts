import type { Mood, RecommendationResult, TimeSegment, Track } from "../types";

interface RecommendationOptions {
  currentMood?: Mood;
  currentSegment?: TimeSegment;
  limit?: number;
  likedTrackIds?: string[];
}

function scoreTrack(track: Track, options: RecommendationOptions): number {
  const moodScore =
    options.currentMood && track.moods.includes(options.currentMood) ? 26 : 0;
  const timeScore =
    options.currentSegment && track.timeFit.includes(options.currentSegment) ? 14 : 0;
  const likedScore = options.likedTrackIds?.includes(track.id) ? 18 : 0;
  const healingFit = 20 - Math.abs(track.energy - 4) * 2 + track.valence;
  return track.verification.score + moodScore + timeScore + likedScore + healingFit;
}

function ranked(tracks: Track[], options: RecommendationOptions): Track[] {
  return [...tracks].sort((a, b) => scoreTrack(b, options) - scoreTrack(a, options));
}

export function recommendTracks(
  tracks: Track[],
  options: RecommendationOptions = {}
): RecommendationResult {
  const limit = options.limit ?? 8;
  const half = Math.ceil(limit / 2);
  const personalLimit = half;
  const trendLimit = limit - personalLimit;

  const eligible = tracks.filter((track) => track.verification.score >= 72);
  const personal = ranked(
    eligible.filter((track) => track.catalogLane === "personal"),
    options
  ).slice(0, personalLimit);
  const trend = ranked(
    eligible.filter((track) => track.catalogLane === "trend"),
    options
  ).slice(0, trendLimit);

  const combined: Track[] = [];
  const maxLength = Math.max(personal.length, trend.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (personal[index]) combined.push(personal[index]);
    if (trend[index]) combined.push(trend[index]);
  }

  return { personal, trend, combined: combined.slice(0, limit) };
}
