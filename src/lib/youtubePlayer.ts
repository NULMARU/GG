declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YouTubePlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayerInstance }) => void;
          };
        }
      ) => YouTubePlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerInstance {
  destroy: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
}

let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window unavailable"));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-yt-api="true"]');
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.ytApi = "true";
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube IFrame API load failed"));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export const YT_ENDED = 0;
