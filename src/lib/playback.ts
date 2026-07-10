import type { LibraryFilter, Mood, TimeSegment, Track } from "../types";
import { getTimeSegment } from "./timeSegments";

export interface FilterLibraryOptions {
  query?: string;
  mood?: Mood | "all";
  filter?: LibraryFilter;
  now?: Date;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function matchesQuery(track: Track, query: string): boolean {
  if (!query) return true;
  const haystack = [
    track.title,
    track.artist,
    track.genre,
    track.moods.join(" "),
    track.discoveryPrompt ?? "",
    track.lyrics ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function filterLibrary(tracks: Track[], options: FilterLibraryOptions = {}): Track[] {
  const query = options.query?.trim() ?? "";
  const mood = options.mood ?? "all";
  const filter = options.filter ?? "all";
  const segment = getTimeSegment(options.now ?? new Date());

  let result = tracks.filter((track) => matchesQuery(track, query));

  if (mood !== "all") {
    result = result.filter((track) => track.moods.includes(mood));
  }

  switch (filter) {
    case "liked":
      result = result.filter((track) => track.liked);
      break;
    case "mine":
      result = result.filter((track) => track.userAdded);
      break;
    case "now":
      result = result.filter((track) => track.timeFit.includes(segment));
      break;
    case "recent":
      result = [...result]
        .filter((track) => track.lastPlayedAt)
        .sort((a, b) => {
          const aTime = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
          const bTime = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
          return bTime - aTime;
        });
      return result;
    default:
      break;
  }

  return result;
}

export function recordPlay(track: Track, playedAt = new Date()): Track {
  return {
    ...track,
    playCount: (track.playCount ?? 0) + 1,
    lastPlayedAt: playedAt.toISOString()
  };
}

function pickRandomIndex(length: number, exclude?: number): number {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  if (exclude !== undefined && index === exclude) {
    index = (index + 1) % length;
  }
  return index;
}

export function selectAdjacentTrack(
  tracks: Track[],
  currentId: string | undefined,
  direction: "next" | "prev",
  options: { shuffle?: boolean } = {}
): Track | undefined {
  if (tracks.length === 0) return undefined;

  const currentIndex = tracks.findIndex((track) => track.id === currentId);
  if (options.shuffle) {
    return tracks[pickRandomIndex(tracks.length, currentIndex >= 0 ? currentIndex : undefined)];
  }

  if (currentIndex < 0) return tracks[0];

  if (direction === "next") {
    return tracks[(currentIndex + 1) % tracks.length];
  }

  return tracks[(currentIndex - 1 + tracks.length) % tracks.length];
}

export function selectQuickStartTrack(
  tracks: Track[],
  options: {
    now?: Date;
    preferLiked?: boolean;
    shuffle?: boolean;
  } = {}
): Track | undefined {
  if (tracks.length === 0) return undefined;

  const segment = getTimeSegment(options.now ?? new Date());
  const playable = tracks.filter((track) => track.sourceUrl.trim().length > 0);
  const poolBase = playable.length > 0 ? playable : tracks;

  const timed = poolBase.filter((track) => track.timeFit.includes(segment));
  let pool = timed.length > 0 ? timed : poolBase;

  if (options.preferLiked) {
    const liked = pool.filter((track) => track.liked);
    if (liked.length > 0) pool = liked;
  }

  if (options.shuffle) {
    return pool[pickRandomIndex(pool.length)];
  }

  return [...pool].sort((a, b) => {
    const likedBoost = (track: Track) => (track.liked ? 20 : 0);
    const playPenalty = (track: Track) => Math.min(track.playCount ?? 0, 8);
    const timeBoost = (track: Track) => (track.timeFit.includes(segment) ? 12 : 0);
    const aScore =
      a.verification.score + likedBoost(a) + timeBoost(a) - playPenalty(a) * 2 - a.energy;
    const bScore =
      b.verification.score + likedBoost(b) + timeBoost(b) - playPenalty(b) * 2 - b.energy;
    return bScore - aScore;
  })[0];
}

export function greetingForSegment(segment: TimeSegment): string {
  switch (segment) {
    case "morning":
      return "좋은 아침";
    case "midday":
      return "집중 타임";
    case "evening":
      return "하루 정리";
    case "night":
      return "밤의 고요";
  }
}

export function sortTracksByRelevance(
  tracks: Track[],
  segment: TimeSegment,
  mood?: Mood | "all"
): Track[] {
  return [...tracks].sort((a, b) => {
    const score = (track: Track) => {
      const moodScore = mood && mood !== "all" && track.moods.includes(mood) ? 18 : 0;
      const timeScore = track.timeFit.includes(segment) ? 14 : 0;
      const likedScore = track.liked ? 16 : 0;
      const recentScore = track.lastPlayedAt
        ? Math.max(0, 10 - (Date.now() - Date.parse(track.lastPlayedAt)) / (1000 * 60 * 60 * 24))
        : 0;
      const playBoost = Math.min(track.playCount ?? 0, 6);
      return track.verification.score + moodScore + timeScore + likedScore + recentScore + playBoost;
    };
    return score(b) - score(a);
  });
}

export function searchableSnippet(track: Track): string {
  return normalize(`${track.title} ${track.artist} ${track.genre}`);
}
