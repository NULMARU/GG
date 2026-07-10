import type { AppPreferences, LibraryBackup, Track } from "../types";

const STORAGE_KEY = "healing-music-playlist:v1";
const PREFS_KEY = "healing-music-playlist:prefs:v1";

const HIDDEN_SIGNAL_LABELS = new Set([
  "personal intent",
  "source provided",
  "local curation pending"
]);

export const defaultPreferences: AppPreferences = {
  continuousPlay: true,
  shuffle: false,
  libraryFilter: "all",
  selectedMood: "all",
  searchQuery: "",
  lastView: "list"
};

function sanitizeTrack(track: Track): Track {
  return {
    ...track,
    verification: {
      ...track.verification,
      signals: track.verification.signals.filter(
        (signal) => !HIDDEN_SIGNAL_LABELS.has(signal.label)
      )
    }
  };
}

export function loadUserTracks(): Track[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Track[]).map(sanitizeTrack) : [];
  } catch {
    return [];
  }
}

export function saveUserTracks(tracks: Track[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks.map(sanitizeTrack)));
}

export function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") return { ...defaultPreferences };
  const raw = window.localStorage.getItem(PREFS_KEY);
  if (!raw) return { ...defaultPreferences };

  try {
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      ...defaultPreferences,
      ...parsed,
      continuousPlay: parsed.continuousPlay ?? true,
      shuffle: Boolean(parsed.shuffle),
      libraryFilter: parsed.libraryFilter ?? "all",
      selectedMood: parsed.selectedMood ?? "all",
      searchQuery: parsed.searchQuery ?? "",
      lastView: parsed.lastView === "detail" ? "detail" : "list"
    };
  } catch {
    return { ...defaultPreferences };
  }
}

export function savePreferences(preferences: AppPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
}

export function createLibraryBackup(
  tracks: Track[],
  preferences: AppPreferences
): LibraryBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tracks: tracks.map(sanitizeTrack),
    preferences
  };
}

export function parseLibraryBackup(raw: string): LibraryBackup {
  const parsed = JSON.parse(raw) as Partial<LibraryBackup>;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tracks)) {
    throw new Error("지원하지 않는 백업 형식입니다.");
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    tracks: (parsed.tracks as Track[]).map(sanitizeTrack),
    preferences: {
      ...defaultPreferences,
      ...(parsed.preferences ?? {})
    }
  };
}

export function exportLibraryJson(
  tracks: Track[],
  preferences: AppPreferences
): string {
  return JSON.stringify(createLibraryBackup(tracks, preferences), null, 2);
}
