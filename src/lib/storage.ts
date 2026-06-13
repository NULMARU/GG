import type { Track } from "../types";

const STORAGE_KEY = "healing-music-playlist:v1";
const HIDDEN_SIGNAL_LABELS = new Set([
  "personal intent",
  "source provided",
  "local curation pending"
]);

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
