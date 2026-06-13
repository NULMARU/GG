import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Heart,
  Library,
  Link as LinkIcon,
  ListMusic,
  Music2,
  Plus,
  Search,
  Sparkles,
  Trash2
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { moodOptions, seedTracks } from "./data/seedTracks";
import { findCuratedMatches } from "./lib/discovery";
import { recommendTracks } from "./lib/recommendations";
import { analyzeSourceUrl, withAutoplay } from "./lib/source";
import { loadUserTracks, saveUserTracks } from "./lib/storage";
import { getTimeSegment, selectTrackForTime, timeSegmentLabels } from "./lib/timeSegments";
import { getThemeForTrack, themeToCssVars, themeProfiles } from "./lib/themeEngine";
import {
  isYouTubeDataConfigured,
  searchYouTubeMusic,
  type YouTubeSearchItem
} from "./lib/youtubeData";
import type { Mood, ThemeProfile, TimeSegment, Track, TrackDraft } from "./types";

const timeSegments: TimeSegment[] = ["morning", "midday", "evening", "night"];

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
    userAdded: true,
    addedAt: new Date().toISOString(),
    verification: {
      score: draft.sourceUrl ? 78 : 72,
      signals: [
        { label: "personal intent", weight: 28 },
        {
          label:
            source.sourceType === "music-generation"
              ? `${source.label} creative source`
              : draft.sourceUrl
                ? "source provided"
                : "search request",
          weight: 24
        },
        { label: "local curation pending", weight: 20 }
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

function App() {
  const [userTracks, setUserTracks] = useState<Track[]>(() => loadUserTracks());
  const [selectedId, setSelectedId] = useState(seedTracks[0].id);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedMood, setSelectedMood] = useState<Mood | "all">("all");
  const [addMode, setAddMode] = useState<"link" | "find">("link");
  const [draft, setDraft] = useState<TrackDraft>(defaultDraft);
  const [findQuery, setFindQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<YouTubeSearchItem[]>([]);
  const [youtubeStatus, setYoutubeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [youtubeError, setYoutubeError] = useState("");
  const [autoplayArmed, setAutoplayArmed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const tracks = useMemo(() => [...userTracks, ...seedTracks], [userTracks]);
  const selectedTrack = tracks.find((track) => track.id === selectedId) ?? tracks[0];
  const activeTheme = getThemeForTrack(selectedTrack);
  const currentSegment = getTimeSegment(now);
  const youtubeConfigured = isYouTubeDataConfigured();

  const visibleTracks = useMemo(() => {
    if (selectedMood === "all") return tracks;
    return tracks.filter((track) => track.moods.includes(selectedMood));
  }, [selectedMood, tracks]);

  const recommendations = useMemo(
    () =>
      recommendTracks(tracks, {
        currentMood: selectedTrack?.moods[0],
        currentSegment,
        limit: 6,
        likedTrackIds: userTracks.filter((track) => track.liked).map((track) => track.id)
      }),
    [currentSegment, selectedTrack, tracks, userTracks]
  );

  const curatedMatches = useMemo(
    () => findCuratedMatches(findQuery, seedTracks, 4),
    [findQuery]
  );

  useEffect(() => {
    saveUserTracks(userTracks);
  }, [userTracks]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoplayArmed) return;
    const timedTrack = selectTrackForTime(tracks, now);
    if (timedTrack) {
      setSelectedId(timedTrack.id);
      setView("detail");
    }
  }, [autoplayArmed, now, tracks]);

  function openTrack(track: Track) {
    setSelectedId(track.id);
    setView("detail");
  }

  function handleAddLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const track = createUserTrack(draft);
    setUserTracks((current) => [track, ...current]);
    setDraft(defaultDraft);
    openTrack(track);
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
    openTrack(track);
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
    openTrack(track);
  }

  function addCuratedMatch(track: Track) {
    const cloned = cloneCuratedTrack(track, findQuery || track.title);
    setUserTracks((current) => [cloned, ...current]);
    setFindQuery("");
    openTrack(cloned);
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
    if (!track.userAdded) {
      const likedClone = cloneCuratedTrack(track, "liked seed");
      likedClone.liked = true;
      setUserTracks((current) => [likedClone, ...current]);
      setSelectedId(likedClone.id);
      return;
    }

    setUserTracks((current) =>
      current.map((item) =>
        item.id === track.id ? { ...item, liked: !item.liked } : item
      )
    );
  }

  function removeUserTrack(track: Track) {
    if (!track.userAdded) return;
    setUserTracks((current) => current.filter((item) => item.id !== track.id));
    setSelectedId(seedTracks[0].id);
    setView("list");
  }

  const cssVars = themeToCssVars(activeTheme) as CSSProperties;

  return (
    <main className="app-shell" style={cssVars}>
      <div className="app-pattern" aria-hidden="true" />
      <header className="topbar">
        <button
          className="brand-button"
          type="button"
          onClick={() => setView("list")}
          title="전체 목록"
        >
          <Library size={20} />
          <span>Healing Library</span>
        </button>

        <div className="top-actions">
          <div className="time-pill">
            <Clock3 size={16} />
            <span>{timeSegmentLabels[currentSegment]}</span>
          </div>
          <button
            className={autoplayArmed ? "icon-button active" : "icon-button"}
            type="button"
            onClick={() => setAutoplayArmed((value) => !value)}
            title="시간대 자동 선곡"
            aria-pressed={autoplayArmed}
          >
            <Clock3 size={18} />
          </button>
        </div>
      </header>

      {view === "list" ? (
        <ListView
          tracks={visibleTracks}
          allTracks={tracks}
          selectedMood={selectedMood}
          recommendations={recommendations.combined}
          addMode={addMode}
          draft={draft}
          findQuery={findQuery}
          curatedMatches={curatedMatches}
          youtubeConfigured={youtubeConfigured}
          youtubeResults={youtubeResults}
          youtubeStatus={youtubeStatus}
          youtubeError={youtubeError}
          onSelectMood={setSelectedMood}
          onOpenTrack={openTrack}
          onSetAddMode={setAddMode}
          onDraftChange={setDraft}
          onToggleMood={toggleMood}
          onToggleTimeFit={toggleTimeFit}
          onAddLink={handleAddLink}
          onFindQueryChange={setFindQuery}
          onAddSearchRequest={addSearchRequest}
          onAddCuratedMatch={addCuratedMatch}
          onRunYoutubeSearch={runYoutubeSearch}
          onAddYoutubeResult={addYoutubeResult}
        />
      ) : (
        <DetailView
          track={selectedTrack}
          recommendations={recommendations.combined}
          autoplayArmed={autoplayArmed}
          onBack={() => setView("list")}
          onOpenTrack={openTrack}
          onToggleLike={toggleLike}
          onRemoveTrack={removeUserTrack}
        />
      )}
    </main>
  );
}

interface ListViewProps {
  tracks: Track[];
  allTracks: Track[];
  selectedMood: Mood | "all";
  recommendations: Track[];
  addMode: "link" | "find";
  draft: TrackDraft;
  findQuery: string;
  curatedMatches: Track[];
  youtubeConfigured: boolean;
  youtubeResults: YouTubeSearchItem[];
  youtubeStatus: "idle" | "loading" | "success" | "error";
  youtubeError: string;
  onSelectMood: (mood: Mood | "all") => void;
  onOpenTrack: (track: Track) => void;
  onSetAddMode: (mode: "link" | "find") => void;
  onDraftChange: (draft: TrackDraft) => void;
  onToggleMood: (mood: Mood) => void;
  onToggleTimeFit: (segment: TimeSegment) => void;
  onAddLink: (event: FormEvent<HTMLFormElement>) => void;
  onFindQueryChange: (query: string) => void;
  onAddSearchRequest: () => void;
  onAddCuratedMatch: (track: Track) => void;
  onRunYoutubeSearch: () => void;
  onAddYoutubeResult: (result: YouTubeSearchItem) => void;
}

function ListView({
  tracks,
  allTracks,
  selectedMood,
  recommendations,
  addMode,
  draft,
  findQuery,
  curatedMatches,
  youtubeConfigured,
  youtubeResults,
  youtubeStatus,
  youtubeError,
  onSelectMood,
  onOpenTrack,
  onSetAddMode,
  onDraftChange,
  onToggleMood,
  onToggleTimeFit,
  onAddLink,
  onFindQueryChange,
  onAddSearchRequest,
  onAddCuratedMatch,
  onRunYoutubeSearch,
  onAddYoutubeResult
}: ListViewProps) {
  const personalCount = recommendations.filter((track) => track.catalogLane === "personal").length;
  const trendCount = recommendations.filter((track) => track.catalogLane === "trend").length;

  return (
    <div className="page-grid">
      <section className="library-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Local MVP</p>
            <h1>나만의 힐링 플레이리스트</h1>
          </div>
          <div className="stat-row">
            <span>{allTracks.length} tracks</span>
            <span>{personalCount}:{trendCount}</span>
          </div>
        </div>

        <div className="filter-row" aria-label="분위기 필터">
          <button
            className={selectedMood === "all" ? "chip selected" : "chip"}
            type="button"
            onClick={() => onSelectMood("all")}
          >
            전체
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

        <div className="track-grid">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} onOpenTrack={onOpenTrack} />
          ))}
        </div>
      </section>

      <aside className="side-panel">
        <section className="recommendation-panel">
          <div className="section-header compact">
            <div>
              <p className="eyebrow">50:50</p>
              <h2>추천</h2>
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
                  <small>{track.artist}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="add-panel">
          <div className="segmented">
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
              <label>
                제목
                <input
                  value={draft.title}
                  onChange={(event) =>
                    onDraftChange({ ...draft, title: event.currentTarget.value })
                  }
                  placeholder="Clair de Lune"
                />
              </label>
              <label>
                아티스트
                <input
                  value={draft.artist}
                  onChange={(event) =>
                    onDraftChange({ ...draft, artist: event.currentTarget.value })
                  }
                  placeholder="Claude Debussy"
                />
              </label>
              <label>
                링크
                <input
                  value={draft.sourceUrl}
                  onChange={(event) =>
                    onDraftChange({ ...draft, sourceUrl: event.currentTarget.value })
                  }
                  placeholder="YouTube, Suno, Udio, mp3..."
                  required
                />
              </label>
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

              <button className="primary-button" type="submit">
                <Plus size={18} />
                추가
              </button>
            </form>
          ) : (
            <div className="find-panel">
              <label>
                요청
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
                      ? "YouTube Data API 연결됨"
                      : "YouTube Data API 키 필요"}
                  </span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onRunYoutubeSearch}
                  disabled={!youtubeConfigured || findQuery.trim().length === 0 || youtubeStatus === "loading"}
                >
                  <Search size={18} />
                  {youtubeStatus === "loading" ? "검색 중" : "YouTube 검색"}
                </button>
                {youtubeStatus === "error" ? (
                  <p className="api-message">{youtubeError}</p>
                ) : null}
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
                요청 저장
              </button>
            </div>
          )}
        </section>
      </aside>
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
      </div>
      <div className="track-card-body">
        <div>
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>
        <div className="meta-line">
          <small>{track.genre}</small>
          <small>{track.verification.score}</small>
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
  onBack: () => void;
  onOpenTrack: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onRemoveTrack: (track: Track) => void;
}

function DetailView({
  track,
  recommendations,
  autoplayArmed,
  onBack,
  onOpenTrack,
  onToggleLike,
  onRemoveTrack
}: DetailViewProps) {
  const source = analyzeSourceUrl(track.sourceUrl);
  const iframeSrc = source.embedUrl
    ? withAutoplay(
        source.embedUrl,
        autoplayArmed,
        typeof window === "undefined" ? undefined : window.location.origin
      )
    : undefined;
  const artUrl = track.imageUrl || source.thumbnailUrl;

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
              <audio controls src={source.audioUrl} />
            </div>
          ) : (
            <div className="empty-player">
              <ListMusic size={44} />
              <span>
                {source.sourceType === "music-generation"
                  ? "생성앱 소스 저장됨"
                  : "소스 대기"}
              </span>
            </div>
          )}
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
          <span>{track.catalogLane === "trend" ? "Trend" : "Personal"}</span>
          <span>{source.sourceType}</span>
        </div>

        <div className="mood-row">
          {track.moods.map((mood) => (
            <span key={mood}>{getMoodLabel(mood)}</span>
          ))}
        </div>

        <div className="verification-block">
          <div className="score-ring">
            <strong>{track.verification.score}</strong>
            <span>score</span>
          </div>
          <p>{track.verification.note}</p>
        </div>

        <div className="signal-list">
          {track.verification.signals.map((signal) => (
            <div key={signal.label}>
              <span>{signal.label}</span>
              <meter min="0" max="40" value={signal.weight} />
            </div>
          ))}
        </div>

        <section className="lyrics-panel">
          <h2>가사</h2>
          <p>API 연결 예정</p>
        </section>

        {source.sourceType === "music-generation" ? (
          <section className="source-note">
            <h2>생성앱 소스</h2>
            <p>
              {source.label} 링크를 개인 음악으로 저장했습니다. 해당 서비스가
              외부 임베드를 막는 경우 앱 안에서는 링크 보관과 외부 열기를
              제공합니다.
            </p>
          </section>
        ) : null}

        <div className="detail-footer">
          {source.externalUrl ? (
            <a className="secondary-button" href={source.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              소스
            </a>
          ) : null}
        </div>

        <section className="next-list">
          <h2>다음 추천</h2>
          {recommendations
            .filter((item) => item.id !== track.id)
            .slice(0, 4)
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
