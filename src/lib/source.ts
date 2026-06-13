import type { SourceAnalysis } from "../types";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be"
]);

const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav|ogg|opus|flac)(\?.*)?$/i;

const MUSIC_GENERATION_PROVIDERS = [
  {
    provider: "suno" as const,
    label: "Suno",
    hosts: ["suno.com", "www.suno.com", "app.suno.ai", "suno.ai", "www.suno.ai"]
  },
  {
    provider: "udio" as const,
    label: "Udio",
    hosts: ["udio.com", "www.udio.com", "app.udio.com"]
  },
  {
    provider: "stable-audio" as const,
    label: "Stable Audio",
    hosts: ["stableaudio.com", "www.stableaudio.com", "stable-audio.com"]
  }
];

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

export function extractYouTubeId(value: string): string | undefined {
  const url = parseUrl(value);
  if (!url) return undefined;

  if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) return undefined;

  const watchId = url.searchParams.get("v");
  if (watchId) return watchId;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const embedIndex = pathParts.findIndex((part) => part === "embed" || part === "shorts");
  if (embedIndex >= 0) return pathParts[embedIndex + 1];

  return undefined;
}

export function analyzeSourceUrl(sourceUrl: string): SourceAnalysis {
  const trimmed = sourceUrl.trim();
  const url = parseUrl(trimmed);

  if (!url) {
    return {
      provider: "generic",
      sourceUrl: trimmed,
      externalUrl: trimmed,
      canEmbed: false,
      label: "직접 입력 소스",
      sourceType: "unknown"
    };
  }

  if (AUDIO_FILE_PATTERN.test(url.pathname)) {
    return {
      provider: "audio-file",
      sourceUrl: trimmed,
      externalUrl: trimmed,
      audioUrl: trimmed,
      canEmbed: true,
      label: "Audio File",
      sourceType: "audio"
    };
  }

  const generationProvider = MUSIC_GENERATION_PROVIDERS.find((candidate) =>
    candidate.hosts.includes(url.hostname)
  );
  if (generationProvider) {
    return {
      provider: generationProvider.provider,
      sourceUrl: trimmed,
      externalUrl: trimmed,
      canEmbed: false,
      label: generationProvider.label,
      sourceType: "music-generation"
    };
  }

  const youtubeId = extractYouTubeId(trimmed);
  if (youtubeId) {
    return {
      provider: "youtube",
      sourceUrl: trimmed,
      externalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      canEmbed: true,
      label: "YouTube",
      sourceType: "video"
    };
  }

  if (url.hostname.includes("vimeo.com")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return {
      provider: "vimeo",
      sourceUrl: trimmed,
      externalUrl: trimmed,
      embedUrl: id ? `https://player.vimeo.com/video/${id}` : undefined,
      canEmbed: Boolean(id),
      label: "Vimeo",
      sourceType: "video"
    };
  }

  if (url.hostname.includes("soundcloud.com")) {
    return {
      provider: "soundcloud",
      sourceUrl: trimmed,
      externalUrl: trimmed,
      canEmbed: false,
      label: "SoundCloud",
      sourceType: "external"
    };
  }

  if (url.hostname.includes("spotify.com")) {
    return {
      provider: "spotify",
      sourceUrl: trimmed,
      externalUrl: trimmed,
      canEmbed: false,
      label: "Spotify",
      sourceType: "external"
    };
  }

  return {
    provider: "generic",
    sourceUrl: trimmed,
    externalUrl: trimmed,
    canEmbed: false,
    label: url.hostname.replace(/^www\./, ""),
    sourceType: "external"
  };
}

export function withAutoplay(embedUrl: string, enabled: boolean): string {
  if (!enabled) return embedUrl;
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${embedUrl}${separator}autoplay=1&rel=0`;
}
