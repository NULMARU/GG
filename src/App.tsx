import {
  ArrowLeft,
  Clock3,
  Download,
  ExternalLink,
  Heart,
  Library,
  Link as LinkIcon,
  ListMusic,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { moodOptions, seedTracks } from "./data/seedTracks";
import { findCuratedMatches } from "./lib/discovery";
import {
  filterLibrary,
  greetingForSegment,
  recordPlay,
  selectAdjacentTrack,
  selectQuickStartTrack
} from "./lib/playback";
import { recommendTracks } from "./lib/recommendations";
import { analyzeSourceUrl, withAutoplay } from "./lib/source";
import { analyzeSourceMetadata, applySourceMetadataPatch } from "./lib/sourceMetadata";
import {
  exportLibraryJson,
  loadPreferences,
  loadUserTracks,
  parseLibraryBackup,
  savePreferences,
  saveUserTracks
} from "./lib/storage";
import {
  getTimeSegment,
  selectTrackForTime,
  timeSegmentHints,
  timeSegmentLabels
} from "./lib/timeSegments";
import { getThemeForTrack, themeToCssVars, themeProfiles } from "./lib/themeEngine";
import {
  isYouTubeDataConfigured,
  searchYouTubeMusic,
  type YouTubeSearchItem
} from "./lib/youtubeData";
import type {
  AppPreferences,
  AppView,
  LibraryFilter,
  Mood,
  ThemeProfile,
  TimeSegment,
  Track,
  TrackDraft
} from "./types";

const timeSegments: TimeSegment[] = ["morning", "midday", "evening", "night"];
const historyAppMarker = "healing-music-playlist";
type AddMode = "link" | "find";
type SourceInputKind = "youtube" | "generated" | "audio" | "web";

interface AppHistoryState {
  app: typeof historyAppMarker;
  view: AppView;
  selectedId?: string;
}

const sourceInputOptions: Array<{
  value: SourceInputKind;
  label: string;
  detail: string;
  placeholder: string;
}> = [
  {
    value: "youtube",
    label: "YouTube",
    detail: "영상/뮤직 링크",
    placeholder: "https://www.youtube.com/watch?v=..."
  },
  {
    value: "generated",
    label: "Suno/Udio",
    detail: "내가 만든 음악",
    placeholder: "https://suno.com/song/... 또는 생성앱 공유 링크"
  },
  {
    value: "audio",
    label: "Audio URL",
    detail: "mp3, wav 등",
    placeholder: "https://example.com/my-track.mp3"
  },
  {
    value: "web",
    label: "기타 링크",
    detail: "웹 소스 보관",
    placeholder: "https://..."
  }
];

const libraryFilterOptions: Array<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "now", label: "지금" },
  { value: "liked", label: "좋아요" },
  { value: "mine", label: "내 곡" },
  { value: "recent", label: "최근" }
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const defaultDraft: TrackDraft = {
  title: "",
  artist: "",
  sourceUrl: "",
  genre: "Personal",
  moods: ["serene"],
  energy: 3,
  valence: 7,
  timeFit: ["morning", "evening"]
};

function createId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return `${slug || "track"}-${Date.now().toString(36)}`;
}

function isAppHistoryState(state: unknown): state is AppHistoryState {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as AppHistoryState).app === historyAppMarker
  );
}

function replaceListHistoryState(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(
    { app: historyAppMarker, view: "list" } satisfies AppHistoryState,
    "",
    window.location.href
  );
}

function pushDetailHistoryState(trackId: string): void {
  if (typeof window === "undefined") return;

  const state = {
    app: historyAppMarker,
    view: "detail",
    selectedId: trackId
  } satisfies AppHistoryState;
  const currentState = window.history.state;

  if (isAppHistoryState(currentState) && currentState.view === "detail") {
    window.history.replaceState(state, "", window.location.href);
    return;
  }

  window.history.pushState(state, "", window.location.href);
}

function createUserTrack(draft: TrackDraft): Track {
  const source = analyzeSourceUrl(draft.sourceUrl);
  return {
    id: createId(`${draft.artist}-${draft.title}-${draft.discoveryPrompt ?? ""}`),
    title: draft.title.trim() || draft.discoveryPrompt?.trim() || "Untitled Source",
    artist: draft.artist.trim() || "Unknown Artist",
    sourceUrl: draft.sourceUrl.trim(),
    genre: draft.genre.trim() || "Personal",
    catalogLane: "personal",
    moods: draft.moods.length > 0 ? draft.moods : ["serene"],
    energy: draft.energy,
    valence: draft.valence,
    timeFit: draft.timeFit.length > 0 ? draft.timeFit : ["evening"],
    discoveryPrompt: draft.discoveryPrompt,
    imageUrl: draft.imageUrl || source.thumbnailUrl,
    lyrics: draft.lyrics?.trim() || undefined,
    userAdded: true,
    addedAt: new Date().toISOString(),
    verification: {
      score: draft.sourceUrl ? 78 : 72,
      signals: [
        {
          label:
            source.sourceType === "music-generation"
              ? `${source.label} 생성 소스`
              : draft.sourceUrl
                ? source.label
                : "검색 요청",
          weight: 28
        },
        { label: "개인 보관", weight: 24 },
        { label: "수동 검토", weight: 20 }
      ],
      note: draft.sourceUrl
        ? source.sourceType === "music-generation"
          ? `${source.label} 등 음악생성앱에서 만든 개인 음악 소스.`
          : "사용자가 직접 추가한 개인용 소스."
        : "검색 API 연결 전까지 로컬 탐색 요청으로 보관."
    }
  };
}

function createYoutubeResultTrack(
  result: YouTubeSearchItem,
  prompt: string,
  currentSegment: TimeSegment
): Track {
  const source = analyzeSourceUrl(result.link);

  return {
    id: createId(`${result.channelTitle}-${result.title}`),
    title: result.title,
    artist: result.channelTitle || "YouTube Result",
    sourceUrl: result.link,
    genre: "YouTube Music",
    catalogLane: "personal",
    moods: ["serene", "focus"],
    energy: 3,
    valence: 7,
    timeFit: [currentSegment],
    discoveryPrompt: prompt,
    imageUrl: result.thumbnailUrl || source.thumbnailUrl,
    userAdded: true,
    addedAt: new Date().toISOString(),
    verification: {
      score: 76,
      signals: [
        { label: "youtube data api", weight: 30 },
        { label: source.label, weight: 24 },
        { label: "manual review recommended", weight: 24 }
      ],
      note:
        result.snippet ||
        "YouTube Data API 검색 결과에서 추가된 개인용 음악 소스."
    }
  };
}

function cloneCuratedTrack(track: Track, prompt: string): Track {
  return {
    ...track,
    id: createId(`${track.artist}-${track.title}`),
    catalogLane: "personal",
    userAdded: true,
    addedAt: new Date().toISOString(),
    discoveryPrompt: prompt,
    verification: {
      ...track.verification,
      score: Math.max(76, track.verification.score - 4),
      note: `${track.verification.note} 로컬 탐색 요청에서 개인 목록으로 복사됨.`
    }
  };
}

function getMoodLabel(mood: Mood): string {
  return moodOptions.find((option) => option.value === mood)?.label ?? mood;
}

function getTrackTheme(track: Track): ThemeProfile {
  return themeProfiles[track.moods[0]] ?? themeProfiles.serene;
}

function mergePlayableCatalog(userTracks: Track[]): Track[] {
  const userIds = new Set(userTracks.map((track) => track.id));
  return [...userTracks, ...seedTracks.filter((track) => !userIds.has(track.id))];
}

function touchTrackInCatalog(
  userTracks: Track[],
  track: Track,
  patch: Partial<Track>
): { userTracks: Track[]; nextTrack: Track } {
  const nextTrack = { ...track, ...patch };

  if (track.userAdded || userTracks.some((item) => item.id === track.id)) {
    return {
      userTracks: userTracks.map((item) => (item.id === track.id ? nextTrack : item)),
      nextTrack
    };
  }

  return {
    userTracks: [{ ...nextTrack, userAdded: true, addedAt: nextTrack.addedAt ?? new Date().toISOString() }, ...userTracks],
    nextTrack: { ...nextTrack, userAdded: true, addedAt: nextTrack.addedAt ?? new Date().toISOString() }
  };
}

function App() {
  const initialPrefs = useMemo(() => loadPreferences(), []);
  const [userTracks, setUserTracks] = useState<Track[]>(() => loadUserTracks());
  const [selectedId, setSelectedId] = useState(() => {
    const tracks = mergePlayableCatalog(loadUserTracks());
    return initialPrefs.lastTrackId && tracks.some((track) => track.id === initialPrefs.lastTrackId)
      ? initialPrefs.lastTrackId
      : tracks[0]?.id ?? seedTracks[0].id;
  });
  const [view, setView] = useState<AppView>(() =>
    initialPrefs.lastView === "detail" && initialPrefs.lastTrackId ? "detail" : "list"
  );
  const [selectedMood, setSelectedMood] = useState<Mood | "all">(initialPrefs.selectedMood);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>(initialPrefs.libraryFilter);
  const [searchQuery, setSearchQuery] = useState(initialPrefs.searchQuery);
  const [continuousPlay, setContinuousPlay] = useState(initialPrefs.continuousPlay);
  const [shuffle, setShuffle] = useState(initialPrefs.shuffle);
  const [addMode, setAddMode] = useState<AddMode>("link");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<TrackDraft>(defaultDraft);
  const [findQuery, setFindQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<YouTubeSearchItem[]>([]);
  const [youtubeStatus, setYoutubeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [youtubeError, setYoutubeError] = useState("");
  const [metadataStatus, setMetadataStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [metadataMessage, setMetadataMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [autoplayArmed, setAutoplayArmed] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const continuousPlayRef = useRef(continuousPlay);
  const handleEndedRef = useRef<() => void>(() => undefined);

  const tracks = useMemo(() => mergePlayableCatalog(userTracks), [userTracks]);
  const selectedTrack = tracks.find((track) => track.id === selectedId) ?? tracks[0];
  const activeTheme = getThemeForTrack(selectedTrack);
  const currentSegment = getTimeSegment(now);
  const youtubeConfigured = isYouTubeDataConfigured();

  const visibleTracks = useMemo(
    () =>
      filterLibrary(tracks, {
        query: searchQuery,
        mood: selectedMood,
        filter: libraryFilter,
        now
      }),
    [libraryFilter, now, searchQuery, selectedMood, tracks]
  );

  const playQueue = useMemo(() => {
    const queue = visibleTracks.length > 0 ? visibleTracks : tracks;
    return queue.filter((track) => track.sourceUrl.trim().length > 0);
  }, [tracks, visibleTracks]);

  const recommendations = useMemo(
    () =>
      recommendTracks(tracks, {
        currentMood: selectedTrack?.moods[0],
        currentSegment,
        limit: 6,
        likedTrackIds: tracks.filter((track) => track.liked).map((track) => track.id)
      }),
    [currentSegment, selectedTrack, tracks]
  );

  const curatedMatches = useMemo(
    () => findCuratedMatches(findQuery, seedTracks, 4),
    [findQuery]
  );

  const quickTrack = useMemo(
    () =>
      selectQuickStartTrack(tracks, {
        now,
        preferLiked: true,
        shuffle
      }),
    [now, shuffle, tracks]
  );

  const preferences: AppPreferences = useMemo(
    () => ({
      lastTrackId: selectedId,
      lastView: view,
      continuousPlay,
      shuffle,
      libraryFilter,
      selectedMood,
      searchQuery
    }),
    [continuousPlay, libraryFilter, searchQuery, selectedId, selectedMood, shuffle, view]
  );

  useEffect(() => {
    continuousPlayRef.current = continuousPlay;
  }, [continuousPlay]);

  useEffect(() => {
    saveUserTracks(userTracks);
  }, [userTracks]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isAppHistoryState(window.history.state)) {
      if (view === "detail" && selectedId) {
        pushDetailHistoryState(selectedId);
      } else {
        replaceListHistoryState();
      }
    }

    const onPopState = (event: PopStateEvent) => {
      setIsAddModalOpen(false);
      setIsSettingsOpen(false);

      if (isAppHistoryState(event.state) && event.state.view === "detail") {
        const trackExists = tracks.some((track) => track.id === event.state.selectedId);
        if (trackExists && event.state.selectedId) {
          setSelectedId(event.state.selectedId);
          setView("detail");
          return;
        }
      }

      setAutoplayArmed(false);
      setView("list");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selectedId, tracks, view]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const openTrack = useCallback(
    (track: Track, options: { autoplay?: boolean; record?: boolean } = {}) => {
      const shouldRecord = options.record !== false;
      if (shouldRecord) {
        const played = recordPlay(track);
        setUserTracks((current) => {
          const result = touchTrackInCatalog(current, track, {
            playCount: played.playCount,
            lastPlayedAt: played.lastPlayedAt
          });
          return result.userTracks;
        });
      }

      pushDetailHistoryState(track.id);
      setSelectedId(track.id);
      setView("detail");
      if (options.autoplay) setAutoplayArmed(true);
    },
    []
  );

  const playAdjacent = useCallback(
    (direction: "next" | "prev") => {
      const next = selectAdjacentTrack(playQueue, selectedId, direction, { shuffle });
      if (next) openTrack(next, { autoplay: true });
    },
    [openTrack, playQueue, selectedId, shuffle]
  );

  useEffect(() => {
    handleEndedRef.current = () => {
      if (!continuousPlayRef.current) return;
      const next = selectAdjacentTrack(playQueue, selectedId, "next", { shuffle });
      if (next && next.id !== selectedId) {
        openTrack(next, { autoplay: true });
      }
    };
  }, [openTrack, playQueue, selectedId, shuffle]);

  useEffect(() => {
    if (!autoplayArmed) return;
    const timedTrack = selectTrackForTime(tracks, now);
    if (timedTrack && (view !== "detail" || selectedId !== timedTrack.id)) {
      openTrack(timedTrack, { autoplay: true, record: true });
    }
  }, [autoplayArmed, now]); // intentionally not depending on selectedId to avoid loops

  // YouTube embed posts state changes when enablejsapi=1 (no IFrame API DOM takeover).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.includes("youtube.com")) {
        return;
      }

      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (!data || typeof data !== "object") return;
      const payload = data as { event?: string; info?: number | { playerState?: number } };
      if (payload.event !== "onStateChange") return;

      const state =
        typeof payload.info === "number"
          ? payload.info
          : typeof payload.info === "object"
            ? payload.info?.playerState
            : undefined;

      // 0 = ENDED
      if (state === 0) {
        handleEndedRef.current();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function returnToList() {
    setIsAddModalOpen(false);
    setIsSettingsOpen(false);

    if (
      typeof window !== "undefined" &&
      isAppHistoryState(window.history.state) &&
      window.history.state.view === "detail"
    ) {
      window.history.back();
      return;
    }

    replaceListHistoryState();
    setView("list");
  }

  function toggleTimeAutoplay() {
    if (autoplayArmed) {
      setAutoplayArmed(false);
      return;
    }

    setAutoplayArmed(true);
    const timedTrack = selectTrackForTime(tracks, now);
    if (timedTrack) {
      openTrack(timedTrack, { autoplay: true });
    }
  }

  function startQuickListen(mode: "now" | "shuffle") {
    const track =
      mode === "shuffle"
        ? selectQuickStartTrack(tracks, { now, shuffle: true, preferLiked: true })
        : quickTrack ?? selectTrackForTime(tracks, now);
    if (!track) return;
    if (mode === "shuffle") setShuffle(true);
    setAutoplayArmed(true);
    openTrack(track, { autoplay: true });
  }

  function handleAddLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const track = createUserTrack(draft);
    setUserTracks((current) => [track, ...current]);
    setDraft(defaultDraft);
    setIsAddModalOpen(false);
    openTrack(track, { autoplay: true, record: false });
  }

  async function handleAnalyzeSource() {
    if (!draft.sourceUrl.trim()) {
      setMetadataStatus("error");
      setMetadataMessage("먼저 음악 소스 링크를 입력해 주세요.");
      return;
    }

    setMetadataStatus("loading");
    setMetadataMessage("");

    try {
      const metadata = await analyzeSourceMetadata(draft.sourceUrl);
      setDraft((current) => applySourceMetadataPatch(current, metadata));
      setMetadataStatus("success");
      setMetadataMessage(metadata.note);
    } catch (error) {
      setMetadataStatus("error");
      setMetadataMessage(
        error instanceof Error ? error.message : "소스 정보를 분석하지 못했습니다."
      );
    }
  }

  function addSearchRequest() {
    const track = createUserTrack({
      ...defaultDraft,
      title: findQuery,
      discoveryPrompt: findQuery,
      moods: [selectedTrack?.moods[0] ?? "serene"],
      timeFit: [currentSegment]
    });
    setUserTracks((current) => [track, ...current]);
    setFindQuery("");
    setIsAddModalOpen(false);
    openTrack(track, { record: false });
  }

  async function runYoutubeSearch() {
    if (!findQuery.trim()) return;

    setYoutubeStatus("loading");
    setYoutubeError("");
    try {
      const results = await searchYouTubeMusic(findQuery);
      setYoutubeResults(results);
      setYoutubeStatus("success");
    } catch (error) {
      setYoutubeResults([]);
      setYoutubeStatus("error");
      setYoutubeError(error instanceof Error ? error.message : "YouTube 검색에 실패했습니다.");
    }
  }

  function addYoutubeResult(result: YouTubeSearchItem) {
    const track = createYoutubeResultTrack(result, findQuery || result.title, currentSegment);
    setUserTracks((current) => [track, ...current]);
    setFindQuery("");
    setYoutubeResults([]);
    setYoutubeStatus("idle");
    setIsAddModalOpen(false);
    openTrack(track, { autoplay: true, record: false });
  }

  function addCuratedMatch(track: Track) {
    const cloned = cloneCuratedTrack(track, findQuery || track.title);
    setUserTracks((current) => [cloned, ...current]);
    setFindQuery("");
    setIsAddModalOpen(false);
    openTrack(cloned, { autoplay: true, record: false });
  }

  function toggleMood(mood: Mood) {
    setDraft((current) => {
      const exists = current.moods.includes(mood);
      const moods = exists
        ? current.moods.filter((item) => item !== mood)
        : [...current.moods, mood];
      return { ...current, moods };
    });
  }

  function toggleTimeFit(segment: TimeSegment) {
    setDraft((current) => {
      const exists = current.timeFit.includes(segment);
      const timeFit = exists
        ? current.timeFit.filter((item) => item !== segment)
        : [...current.timeFit, segment];
      return { ...current, timeFit };
    });
  }

  function toggleLike(track: Track) {
    const existing = userTracks.find((item) => item.id === track.id);
    if (existing) {
      setUserTracks((current) =>
        current.map((item) =>
          item.id === track.id ? { ...item, liked: !item.liked } : item
        )
      );
      return;
    }

    // Seed track: keep same id so session/play queue stay stable.
    const likedClone: Track = {
      ...track,
      liked: true,
      userAdded: true,
      catalogLane: "personal",
      addedAt: new Date().toISOString()
    };
    setUserTracks((current) => [likedClone, ...current.filter((item) => item.id !== track.id)]);
  }

  function removeUserTrack(track: Track) {
    if (!track.userAdded) return;
    setUserTracks((current) => current.filter((item) => item.id !== track.id));
    const remaining = mergePlayableCatalog(userTracks.filter((item) => item.id !== track.id));
    setSelectedId(remaining[0]?.id ?? seedTracks[0].id);
    replaceListHistoryState();
    setView("list");
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function exportLibrary() {
    const json = exportLibraryJson(userTracks, preferences);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `healing-library-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSettingsMessage("백업 파일을 내려받았습니다.");
  }

  async function importLibrary(file: File) {
    try {
      const text = await file.text();
      const backup = parseLibraryBackup(text);
      setUserTracks(backup.tracks);
      setContinuousPlay(backup.preferences.continuousPlay);
      setShuffle(backup.preferences.shuffle);
      setLibraryFilter(backup.preferences.libraryFilter);
      setSelectedMood(backup.preferences.selectedMood);
      setSearchQuery(backup.preferences.searchQuery);
      if (backup.preferences.lastTrackId) {
        setSelectedId(backup.preferences.lastTrackId);
      }
      setSettingsMessage(`${backup.tracks.length}곡을 복원했습니다.`);
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "백업 파일을 읽지 못했습니다."
      );
    }
  }

  const cssVars = themeToCssVars(activeTheme) as CSSProperties;
  const likedCount = tracks.filter((track) => track.liked).length;
  const mineCount = tracks.filter((track) => track.userAdded).length;

  return (
    <main className="app-shell" style={cssVars}>
      <div className="app-pattern" aria-hidden="true" />
      <header className="topbar">
        <button
          className="brand-button"
          type="button"
          onClick={returnToList}
          title="전체 목록"
        >
          <Library size={20} />
          <span>Healing Library</span>
        </button>

        <div className="top-actions">
          <button
            className="add-source-button"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={18} />
            추가
          </button>
          <div className="time-pill">
            <Clock3 size={16} />
            <span>{timeSegmentLabels[currentSegment]}</span>
          </div>
          <button
            className={autoplayArmed ? "autoplay-button active" : "autoplay-button"}
            type="button"
            onClick={toggleTimeAutoplay}
            title={autoplayArmed ? "시간대 자동 선곡 끄기" : "시간대 자동 선곡 켜기"}
            aria-pressed={autoplayArmed}
          >
            <Clock3 size={18} />
            <span className="button-label">{autoplayArmed ? "자동 중" : "자동"}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="설정"
          >
            <Settings2 size={18} />
          </button>
          {installPrompt ? (
            <button className="install-button" type="button" onClick={installApp}>
              <Download size={17} />
              설치
            </button>
          ) : null}
        </div>
      </header>

      {view === "list" ? (
        <ListView
          tracks={visibleTracks}
          allTracks={tracks}
          selectedMood={selectedMood}
          libraryFilter={libraryFilter}
          searchQuery={searchQuery}
          recommendations={recommendations.combined}
          currentSegment={currentSegment}
          greeting={greetingForSegment(currentSegment)}
          segmentHint={timeSegmentHints[currentSegment]}
          quickTrack={quickTrack}
          likedCount={likedCount}
          mineCount={mineCount}
          onSelectMood={setSelectedMood}
          onSelectFilter={setLibraryFilter}
          onSearchQueryChange={setSearchQuery}
          onOpenTrack={(track) => openTrack(track, { autoplay: true })}
          onQuickStart={startQuickListen}
        />
      ) : (
        <DetailView
          track={selectedTrack}
          recommendations={recommendations.combined}
          autoplayArmed={autoplayArmed}
          continuousPlay={continuousPlay}
          shuffle={shuffle}
          onBack={returnToList}
          onOpenTrack={(track) => openTrack(track, { autoplay: true })}
          onToggleLike={toggleLike}
          onRemoveTrack={removeUserTrack}
          onPrev={() => playAdjacent("prev")}
          onNext={() => playAdjacent("next")}
          onToggleContinuous={() => setContinuousPlay((value) => !value)}
          onToggleShuffle={() => setShuffle((value) => !value)}
          onAudioEnded={() => handleEndedRef.current()}
        />
      )}

      {view === "list" && selectedTrack ? (
        <MiniPlayer
          track={selectedTrack}
          continuousPlay={continuousPlay}
          shuffle={shuffle}
          onOpen={() => openTrack(selectedTrack, { record: false })}
          onPrev={() => playAdjacent("prev")}
          onNext={() => playAdjacent("next")}
          onToggleLike={() => toggleLike(selectedTrack)}
          onToggleContinuous={() => setContinuousPlay((value) => !value)}
          onToggleShuffle={() => setShuffle((value) => !value)}
        />
      ) : null}

      <AddSourceDialog
        open={isAddModalOpen}
        addMode={addMode}
        draft={draft}
        findQuery={findQuery}
        curatedMatches={curatedMatches}
        youtubeConfigured={youtubeConfigured}
        youtubeResults={youtubeResults}
        youtubeStatus={youtubeStatus}
        youtubeError={youtubeError}
        metadataStatus={metadataStatus}
        metadataMessage={metadataMessage}
        onClose={() => setIsAddModalOpen(false)}
        onSetAddMode={setAddMode}
        onDraftChange={(nextDraft) => {
          setDraft(nextDraft);
          setMetadataStatus("idle");
          setMetadataMessage("");
        }}
        onToggleMood={toggleMood}
        onToggleTimeFit={toggleTimeFit}
        onAddLink={handleAddLink}
        onAnalyzeSource={handleAnalyzeSource}
        onFindQueryChange={setFindQuery}
        onAddSearchRequest={addSearchRequest}
        onAddCuratedMatch={addCuratedMatch}
        onRunYoutubeSearch={runYoutubeSearch}
        onAddYoutubeResult={addYoutubeResult}
      />

      <SettingsDialog
        open={isSettingsOpen}
        continuousPlay={continuousPlay}
        shuffle={shuffle}
        message={settingsMessage}
        trackCount={tracks.length}
        userTrackCount={userTracks.length}
        onClose={() => {
          setIsSettingsOpen(false);
          setSettingsMessage("");
        }}
        onToggleContinuous={() => setContinuousPlay((value) => !value)}
        onToggleShuffle={() => setShuffle((value) => !value)}
        onExport={exportLibrary}
        onImport={importLibrary}
      />
    </main>
  );
}

interface ListViewProps {
  tracks: Track[];
  allTracks: Track[];
  selectedMood: Mood | "all";
  libraryFilter: LibraryFilter;
  searchQuery: string;
  recommendations: Track[];
  currentSegment: TimeSegment;
  greeting: string;
  segmentHint: string;
  quickTrack?: Track;
  likedCount: number;
  mineCount: number;
  onSelectMood: (mood: Mood | "all") => void;
  onSelectFilter: (filter: LibraryFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onOpenTrack: (track: Track) => void;
  onQuickStart: (mode: "now" | "shuffle") => void;
}

function ListView({
  tracks,
  allTracks,
  selectedMood,
  libraryFilter,
  searchQuery,
  recommendations,
  currentSegment,
  greeting,
  segmentHint,
  quickTrack,
  likedCount,
  mineCount,
  onSelectMood,
  onSelectFilter,
  onSearchQueryChange,
  onOpenTrack,
  onQuickStart
}: ListViewProps) {
  return (
    <div className="page-grid has-mini-player">
      <section className="library-panel">
        <div className="hero-card">
          <div>
            <p className="eyebrow">{greeting} · {timeSegmentLabels[currentSegment]}</p>
            <h1>지금 바로 듣기</h1>
            <p className="hero-copy">{segmentHint}</p>
            {quickTrack ? (
              <p className="hero-track-preview">
                추천: <strong>{quickTrack.title}</strong>
                <span> · {quickTrack.artist}</span>
              </p>
            ) : null}
          </div>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onQuickStart("now")}>
              <Play size={18} />
              지금 재생
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onQuickStart("shuffle")}
            >
              <Shuffle size={18} />
              셔플
            </button>
          </div>
        </div>

        <div className="section-header">
          <div>
            <p className="eyebrow">Library</p>
            <h2 className="section-title">내 플레이리스트</h2>
          </div>
          <div className="stat-row">
            <span>{allTracks.length}곡</span>
            <span>♥ {likedCount}</span>
            <span>내 곡 {mineCount}</span>
          </div>
        </div>

        <label className="search-field">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
            placeholder="제목, 아티스트, 장르 검색"
          />
          {searchQuery ? (
            <button
              className="clear-search"
              type="button"
              onClick={() => onSearchQueryChange("")}
              aria-label="검색 지우기"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>

        <div className="filter-row" aria-label="라이브러리 필터">
          {libraryFilterOptions.map((option) => (
            <button
              className={libraryFilter === option.value ? "chip selected" : "chip"}
              key={option.value}
              type="button"
              onClick={() => onSelectFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="filter-row mood-filter-row" aria-label="분위기 필터">
          <button
            className={selectedMood === "all" ? "chip selected" : "chip"}
            type="button"
            onClick={() => onSelectMood("all")}
          >
            전체 분위기
          </button>
          {moodOptions.map((option) => (
            <button
              className={selectedMood === option.value ? "chip selected" : "chip"}
              key={option.value}
              type="button"
              onClick={() => onSelectMood(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {tracks.length === 0 ? (
          <div className="empty-library">
            <Music2 size={28} />
            <p>조건에 맞는 곡이 없습니다. 필터를 바꾸거나 소스를 추가해 보세요.</p>
          </div>
        ) : (
          <div className="track-grid">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} onOpenTrack={onOpenTrack} />
            ))}
          </div>
        )}
      </section>

      <aside className="side-panel">
        <section className="recommendation-panel">
          <div className="section-header compact">
            <div>
              <p className="eyebrow">For you</p>
              <h2>지금 추천</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <div className="recommendation-list">
            {recommendations.map((track) => (
              <button
                className="recommendation-item"
                type="button"
                key={track.id}
                onClick={() => onOpenTrack(track)}
              >
                <span className={`lane-dot ${track.catalogLane}`} />
                <span>
                  <strong>{track.title}</strong>
                  <small>
                    {track.artist}
                    {track.liked ? " · ♥" : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

interface MiniPlayerProps {
  track: Track;
  continuousPlay: boolean;
  shuffle: boolean;
  onOpen: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleLike: () => void;
  onToggleContinuous: () => void;
  onToggleShuffle: () => void;
}

function MiniPlayer({
  track,
  continuousPlay,
  shuffle,
  onOpen,
  onPrev,
  onNext,
  onToggleLike,
  onToggleContinuous,
  onToggleShuffle
}: MiniPlayerProps) {
  const source = analyzeSourceUrl(track.sourceUrl);
  const artUrl = track.imageUrl || source.thumbnailUrl;

  return (
    <div className="mini-player">
      <button className="mini-player-main" type="button" onClick={onOpen}>
        <div className="mini-art" aria-hidden="true">
          {artUrl ? <img src={artUrl} alt="" /> : <Music2 size={18} />}
        </div>
        <span>
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </span>
      </button>
      <div className="mini-player-actions">
        <button
          className={shuffle ? "icon-button active" : "icon-button"}
          type="button"
          onClick={onToggleShuffle}
          title="셔플"
          aria-pressed={shuffle}
        >
          <Shuffle size={16} />
        </button>
        <button className="icon-button" type="button" onClick={onPrev} title="이전">
          <SkipBack size={16} />
        </button>
        <button className="icon-button primary-mini" type="button" onClick={onOpen} title="재생 화면">
          <Play size={16} />
        </button>
        <button className="icon-button" type="button" onClick={onNext} title="다음">
          <SkipForward size={16} />
        </button>
        <button
          className={continuousPlay ? "icon-button active" : "icon-button"}
          type="button"
          onClick={onToggleContinuous}
          title="연속 재생"
          aria-pressed={continuousPlay}
        >
          <Repeat size={16} />
        </button>
        <button
          className={track.liked ? "icon-button active" : "icon-button"}
          type="button"
          onClick={onToggleLike}
          title="좋아요"
          aria-pressed={Boolean(track.liked)}
        >
          <Heart size={16} />
        </button>
      </div>
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  continuousPlay: boolean;
  shuffle: boolean;
  message: string;
  trackCount: number;
  userTrackCount: number;
  onClose: () => void;
  onToggleContinuous: () => void;
  onToggleShuffle: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

function SettingsDialog({
  open,
  continuousPlay,
  shuffle,
  message,
  trackCount,
  userTrackCount,
  onClose,
  onToggleContinuous,
  onToggleShuffle,
  onExport,
  onImport
}: SettingsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="source-modal settings-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>설정 & 백업</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="settings-block">
          <p className="settings-summary">
            전체 {trackCount}곡 · 직접 추가 {userTrackCount}곡
          </p>
          <button
            className={continuousPlay ? "settings-toggle active" : "settings-toggle"}
            type="button"
            onClick={onToggleContinuous}
          >
            <Repeat size={18} />
            <span>
              <strong>연속 재생</strong>
              <small>곡이 끝나면 다음 곡으로</small>
            </span>
          </button>
          <button
            className={shuffle ? "settings-toggle active" : "settings-toggle"}
            type="button"
            onClick={onToggleShuffle}
          >
            <Shuffle size={18} />
            <span>
              <strong>셔플</strong>
              <small>다음 곡을 무작위로</small>
            </span>
          </button>
        </div>

        <div className="settings-block">
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={18} />
            라이브러리 내보내기
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            백업 가져오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
          />
          {message ? <p className="metadata-message">{message}</p> : null}
          <p className="settings-hint">
            데이터는 이 기기 브라우저에만 저장됩니다. 기기 변경 전에는 백업을 받아 두세요.
          </p>
        </div>
      </section>
    </div>
  );
}

interface AddSourceDialogProps {
  open: boolean;
  addMode: AddMode;
  draft: TrackDraft;
  findQuery: string;
  curatedMatches: Track[];
  youtubeConfigured: boolean;
  youtubeResults: YouTubeSearchItem[];
  youtubeStatus: "idle" | "loading" | "success" | "error";
  youtubeError: string;
  metadataStatus: "idle" | "loading" | "success" | "error";
  metadataMessage: string;
  onClose: () => void;
  onSetAddMode: (mode: AddMode) => void;
  onDraftChange: (draft: TrackDraft) => void;
  onToggleMood: (mood: Mood) => void;
  onToggleTimeFit: (segment: TimeSegment) => void;
  onAddLink: (event: FormEvent<HTMLFormElement>) => void;
  onAnalyzeSource: () => void;
  onFindQueryChange: (query: string) => void;
  onAddSearchRequest: () => void;
  onAddCuratedMatch: (track: Track) => void;
  onRunYoutubeSearch: () => void;
  onAddYoutubeResult: (result: YouTubeSearchItem) => void;
}

function AddSourceDialog({
  open,
  addMode,
  draft,
  findQuery,
  curatedMatches,
  youtubeConfigured,
  youtubeResults,
  youtubeStatus,
  youtubeError,
  metadataStatus,
  metadataMessage,
  onClose,
  onSetAddMode,
  onDraftChange,
  onToggleMood,
  onToggleTimeFit,
  onAddLink,
  onAnalyzeSource,
  onFindQueryChange,
  onAddSearchRequest,
  onAddCuratedMatch,
  onRunYoutubeSearch,
  onAddYoutubeResult
}: AddSourceDialogProps) {
  const [sourceInputKind, setSourceInputKind] = useState<SourceInputKind>("youtube");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeSourceOption =
    sourceInputOptions.find((option) => option.value === sourceInputKind) ??
    sourceInputOptions[0];

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  function chooseSourceKind(kind: SourceInputKind) {
    setSourceInputKind(kind);

    if (kind === "generated" && (draft.genre === "Personal" || draft.genre === "")) {
      onDraftChange({ ...draft, genre: "Generated Music" });
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="source-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-source-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Add</p>
            <h2 id="add-source-title">음악 추가</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="segmented modal-segmented">
          <button
            className={addMode === "link" ? "selected" : ""}
            type="button"
            onClick={() => onSetAddMode("link")}
          >
            <LinkIcon size={16} />
            링크
          </button>
          <button
            className={addMode === "find" ? "selected" : ""}
            type="button"
            onClick={() => onSetAddMode("find")}
          >
            <Search size={16} />
            찾아줘
          </button>
        </div>

        {addMode === "link" ? (
          <form className="add-form" onSubmit={onAddLink}>
            <fieldset>
              <legend>소스 종류</legend>
              <div className="source-input-menu">
                {sourceInputOptions.map((option) => (
                  <button
                    className={
                      sourceInputKind === option.value
                        ? "source-input-option selected"
                        : "source-input-option"
                    }
                    type="button"
                    key={option.value}
                    onClick={() => chooseSourceKind(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              소스 링크
              <input
                value={draft.sourceUrl}
                onChange={(event) =>
                  onDraftChange({ ...draft, sourceUrl: event.currentTarget.value })
                }
                placeholder={activeSourceOption.placeholder}
                required
              />
            </label>

            <div className="source-analyzer">
              <button
                className="secondary-button"
                type="button"
                onClick={onAnalyzeSource}
                disabled={draft.sourceUrl.trim().length === 0 || metadataStatus === "loading"}
              >
                <Sparkles size={18} />
                {metadataStatus === "loading" ? "분석 중" : "자동 채우기"}
              </button>
              {metadataMessage ? (
                <p className={metadataStatus === "error" ? "api-message" : "metadata-message"}>
                  {metadataMessage}
                </p>
              ) : null}
            </div>

            <div className="form-two-column">
              <label>
                제목
                <input
                  value={draft.title}
                  onChange={(event) =>
                    onDraftChange({ ...draft, title: event.currentTarget.value })
                  }
                  placeholder="자동 채우기 또는 직접 입력"
                />
              </label>
              <label>
                아티스트
                <input
                  value={draft.artist}
                  onChange={(event) =>
                    onDraftChange({ ...draft, artist: event.currentTarget.value })
                  }
                  placeholder="선택"
                />
              </label>
            </div>

            <fieldset>
              <legend>분위기</legend>
              <div className="chip-grid">
                {moodOptions.map((option) => (
                  <button
                    className={draft.moods.includes(option.value) ? "chip selected" : "chip"}
                    key={option.value}
                    type="button"
                    onClick={() => onToggleMood(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              className="text-toggle"
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "간단히" : "세부 설정 (시간대·에너지·가사)"}
            </button>

            {showAdvanced ? (
              <>
                <label>
                  장르
                  <input
                    value={draft.genre}
                    onChange={(event) =>
                      onDraftChange({ ...draft, genre: event.currentTarget.value })
                    }
                    placeholder="Ambient"
                  />
                </label>

                <label>
                  가사 직접 입력
                  <textarea
                    value={draft.lyrics ?? ""}
                    onChange={(event) =>
                      onDraftChange({ ...draft, lyrics: event.currentTarget.value })
                    }
                    placeholder="필요한 곡만 붙여 넣기"
                    rows={4}
                  />
                </label>

                <fieldset>
                  <legend>시간대</legend>
                  <div className="chip-grid">
                    {timeSegments.map((segment) => (
                      <button
                        className={draft.timeFit.includes(segment) ? "chip selected" : "chip"}
                        key={segment}
                        type="button"
                        onClick={() => onToggleTimeFit(segment)}
                      >
                        {timeSegmentLabels[segment]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="range-row">
                  <label>
                    에너지
                    <input
                      min="1"
                      max="10"
                      type="range"
                      value={draft.energy}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          energy: Number(event.currentTarget.value)
                        })
                      }
                    />
                  </label>
                  <label>
                    밝기
                    <input
                      min="1"
                      max="10"
                      type="range"
                      value={draft.valence}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          valence: Number(event.currentTarget.value)
                        })
                      }
                    />
                  </label>
                </div>
              </>
            ) : null}

            <button className="primary-button" type="submit">
              <Plus size={18} />
              추가하고 재생
            </button>
          </form>
        ) : (
          <div className="find-panel">
            <label>
              어떤 음악을 찾고 있나요?
              <input
                value={findQuery}
                onChange={(event) => onFindQueryChange(event.currentTarget.value)}
                placeholder="예: 조용한 밤의 현대 클래식"
              />
            </label>
            <div className="match-list">
              {curatedMatches.map((track) => (
                <button
                  className="match-item"
                  type="button"
                  key={track.id}
                  onClick={() => onAddCuratedMatch(track)}
                >
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
            <div className="google-search-block">
              <div className="api-status">
                <span className={youtubeConfigured ? "status-dot ready" : "status-dot"} />
                <span>
                  {youtubeConfigured
                    ? "YouTube 검색 사용 가능"
                    : "YouTube API 키 없으면 로컬 추천만"}
                </span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={onRunYoutubeSearch}
                disabled={
                  !youtubeConfigured ||
                  findQuery.trim().length === 0 ||
                  youtubeStatus === "loading"
                }
              >
                <Search size={18} />
                {youtubeStatus === "loading" ? "검색 중" : "YouTube 검색"}
              </button>
              {youtubeStatus === "error" ? <p className="api-message">{youtubeError}</p> : null}
              {youtubeResults.length > 0 ? (
                <div className="google-result-list">
                  {youtubeResults.map((result) => (
                    <button
                      className="google-result-item"
                      type="button"
                      key={result.link}
                      onClick={() => onAddYoutubeResult(result)}
                    >
                      {result.thumbnailUrl ? (
                        <img src={result.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="result-fallback">
                          <Music2 size={18} />
                        </span>
                      )}
                      <span>
                        <strong>{result.title}</strong>
                        <small>{result.channelTitle}</small>
                      </span>
                      <Plus size={16} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={onAddSearchRequest}
              disabled={findQuery.trim().length === 0}
            >
              <Search size={18} />
              요청만 저장
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function TrackCard({
  track,
  onOpenTrack
}: {
  track: Track;
  onOpenTrack: (track: Track) => void;
}) {
  const source = analyzeSourceUrl(track.sourceUrl);
  const theme = getTrackTheme(track);
  const style = {
    "--card-accent": theme.accent,
    "--card-surface": theme.surface,
    "--card-alt": theme.surfaceAlt
  } as CSSProperties;

  return (
    <button className="track-card" type="button" onClick={() => onOpenTrack(track)} style={style}>
      <div className="thumb" aria-hidden="true">
        {track.imageUrl || source.thumbnailUrl ? (
          <img src={track.imageUrl || source.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className="generated-cover">
            <Music2 size={28} />
          </div>
        )}
        {track.liked ? <span className="liked-badge">♥</span> : null}
      </div>
      <div className="track-card-body">
        <div>
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>
        <div className="meta-line">
          <small>{track.genre}</small>
          <small>
            {track.playCount ? `${track.playCount}회` : source.label}
          </small>
        </div>
        <div className="mini-moods">
          {track.moods.slice(0, 3).map((mood) => (
            <span key={mood}>{getMoodLabel(mood)}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

interface DetailViewProps {
  track: Track;
  recommendations: Track[];
  autoplayArmed: boolean;
  continuousPlay: boolean;
  shuffle: boolean;
  onBack: () => void;
  onOpenTrack: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onRemoveTrack: (track: Track) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleContinuous: () => void;
  onToggleShuffle: () => void;
  onAudioEnded: () => void;
}

function DetailView({
  track,
  recommendations,
  autoplayArmed,
  continuousPlay,
  shuffle,
  onBack,
  onOpenTrack,
  onToggleLike,
  onRemoveTrack,
  onPrev,
  onNext,
  onToggleContinuous,
  onToggleShuffle,
  onAudioEnded
}: DetailViewProps) {
  const source = analyzeSourceUrl(track.sourceUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = source.embedUrl
    ? withAutoplay(
        source.embedUrl,
        autoplayArmed,
        typeof window === "undefined" ? undefined : window.location.origin
      )
    : undefined;
  const artUrl = track.imageUrl || source.thumbnailUrl;

  // Tell the embed we want state events (needed for continuous play end detection).
  useEffect(() => {
    if (!iframeSrc || !iframeRef.current) return;

    const frame = iframeRef.current;
    const timer = window.setInterval(() => {
      try {
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: track.id }),
          "*"
        );
      } catch {
        // Cross-origin guard; ignore.
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [iframeSrc, track.id]);

  return (
    <div className="detail-layout">
      <section className="player-panel">
        <div className="detail-actions">
          <button className="secondary-button" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            목록
          </button>
          <button
            className={track.liked ? "icon-button active" : "icon-button"}
            type="button"
            onClick={() => onToggleLike(track)}
            title="좋아요"
            aria-pressed={Boolean(track.liked)}
          >
            <Heart size={18} />
          </button>
          {track.userAdded ? (
            <button
              className="icon-button danger"
              type="button"
              onClick={() => onRemoveTrack(track)}
              title="삭제"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>

        <div className="player-frame">
          {iframeSrc ? (
            <iframe
              key={track.id}
              ref={iframeRef}
              title={`${track.title} player`}
              src={iframeSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : source.audioUrl ? (
            <div className="audio-player-shell">
              <div className="audio-art">
                {artUrl ? <img src={artUrl} alt="" /> : <Music2 size={56} />}
              </div>
              <audio
                key={track.id}
                controls
                autoPlay={autoplayArmed}
                src={source.audioUrl}
                onEnded={onAudioEnded}
              />
            </div>
          ) : (
            <div className="empty-player">
              <ListMusic size={44} />
              <span>
                {source.sourceType === "music-generation"
                  ? "생성앱 소스 저장됨 · 외부에서 재생"
                  : "재생 가능한 소스가 없습니다"}
              </span>
            </div>
          )}
        </div>

        <div className="transport-bar">
          <button
            className={shuffle ? "icon-button active" : "icon-button"}
            type="button"
            onClick={onToggleShuffle}
            title="셔플"
            aria-pressed={shuffle}
          >
            <Shuffle size={18} />
          </button>
          <button className="icon-button" type="button" onClick={onPrev} title="이전 곡">
            <SkipBack size={18} />
          </button>
          <button className="transport-play" type="button" onClick={onNext} title="다음 곡">
            <SkipForward size={20} />
            다음
          </button>
          <button
            className={continuousPlay ? "icon-button active" : "icon-button"}
            type="button"
            onClick={onToggleContinuous}
            title="연속 재생"
            aria-pressed={continuousPlay}
          >
            <Repeat size={18} />
          </button>
          <button className="icon-button" type="button" disabled title="재생 중">
            {autoplayArmed ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>

        <div className="visualizer" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} style={{ animationDelay: `${index * 70}ms` }} />
          ))}
        </div>
      </section>

      <aside className="track-detail">
        <div className="cover-large" aria-hidden="true">
          {artUrl ? (
            <img src={artUrl} alt="" />
          ) : (
            <div className="cover-mark">
              <Music2 size={42} />
            </div>
          )}
        </div>

        <p className="eyebrow">{source.label}</p>
        <h1>{track.title}</h1>
        <p className="artist-line">{track.artist}</p>

        <div className="detail-metadata">
          <span>{track.genre}</span>
          {track.year ? <span>{track.year}</span> : null}
          {track.playCount ? <span>{track.playCount}회 재생</span> : null}
          {track.liked ? <span>좋아요</span> : null}
        </div>

        <div className="mood-row">
          {track.moods.map((mood) => (
            <span key={mood}>{getMoodLabel(mood)}</span>
          ))}
        </div>

        <div className="verification-block compact-note">
          <p>{track.verification.note}</p>
        </div>

        {track.lyrics ? (
          <section className="lyrics-panel">
            <h2>가사</h2>
            <pre className="lyrics-text">{track.lyrics}</pre>
          </section>
        ) : null}

        {source.sourceType === "music-generation" ? (
          <section className="source-note">
            <h2>생성앱 소스</h2>
            <p>
              {source.label} 링크를 저장했습니다. 외부 임베드가 막혀 있으면 아래 소스 버튼으로
              열어 주세요.
            </p>
          </section>
        ) : null}

        <div className="detail-footer">
          {source.externalUrl ? (
            <a className="secondary-button" href={source.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              소스 열기
            </a>
          ) : null}
        </div>

        <section className="next-list">
          <h2>이어서 듣기</h2>
          {recommendations
            .filter((item) => item.id !== track.id)
            .slice(0, 5)
            .map((item) => (
              <button
                className="recommendation-item"
                type="button"
                key={item.id}
                onClick={() => onOpenTrack(item)}
              >
                <span className={`lane-dot ${item.catalogLane}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.artist}</small>
                </span>
              </button>
            ))}
        </section>
      </aside>
    </div>
  );
}

export default App;
