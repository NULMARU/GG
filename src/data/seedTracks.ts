import type { Track } from "../types";

export const seedTracks: Track[] = [
  {
    id: "debussy-clair-de-lune",
    title: "Clair de Lune",
    artist: "Claude Debussy",
    sourceUrl: "https://www.youtube.com/watch?v=CvFH_6DNRCY",
    genre: "Classical",
    year: 1905,
    catalogLane: "personal",
    moods: ["serene", "dreamy", "nocturne"],
    energy: 2,
    valence: 7,
    timeFit: ["evening", "night"],
    verification: {
      score: 97,
      signals: [
        { label: "classical canon", weight: 36 },
        { label: "long-term cultural influence", weight: 33 },
        { label: "cross-generation recognition", weight: 28 }
      ],
      note: "오랜 시간 연주와 녹음으로 검증된 인상주의 피아노 레퍼토리."
    }
  },
  {
    id: "satie-gymnopedie-1",
    title: "Gymnopedie No. 1",
    artist: "Erik Satie",
    sourceUrl: "https://www.youtube.com/watch?v=S-Xm7s9eGxU",
    genre: "Classical",
    year: 1888,
    catalogLane: "personal",
    moods: ["serene", "melancholy", "focus"],
    energy: 1,
    valence: 6,
    timeFit: ["morning", "night"],
    verification: {
      score: 95,
      signals: [
        { label: "classical canon", weight: 34 },
        { label: "minimal healing fit", weight: 32 },
        { label: "durable listener recognition", weight: 29 }
      ],
      note: "절제된 반복과 여백이 명상적 청취에 잘 맞는 표준 레퍼토리."
    }
  },
  {
    id: "miles-davis-so-what",
    title: "So What",
    artist: "Miles Davis",
    sourceUrl: "https://www.youtube.com/watch?v=ylXk1LBvIqU",
    genre: "Jazz",
    year: 1959,
    catalogLane: "trend",
    moods: ["focus", "earthy", "vital"],
    energy: 4,
    valence: 7,
    timeFit: ["midday", "evening"],
    verification: {
      score: 98,
      signals: [
        { label: "landmark album context", weight: 35 },
        { label: "jazz canon", weight: 35 },
        { label: "critical consensus", weight: 28 }
      ],
      note: "모달 재즈의 대표적 기준점으로, 집중과 여유를 동시에 만든다."
    }
  },
  {
    id: "bill-evans-peace-piece",
    title: "Peace Piece",
    artist: "Bill Evans",
    sourceUrl: "https://www.youtube.com/watch?v=Nv2GgV34qIg",
    genre: "Jazz",
    year: 1958,
    catalogLane: "personal",
    moods: ["serene", "focus", "dreamy"],
    energy: 2,
    valence: 7,
    timeFit: ["morning", "night"],
    verification: {
      score: 93,
      signals: [
        { label: "jazz piano canon", weight: 32 },
        { label: "meditative structure", weight: 31 },
        { label: "long-term influence", weight: 30 }
      ],
      note: "반복되는 왼손 패턴과 즉흥 선율이 차분한 집중감을 만든다."
    }
  },
  {
    id: "brian-eno-an-ending",
    title: "An Ending (Ascent)",
    artist: "Brian Eno",
    sourceUrl: "https://www.youtube.com/watch?v=OlaTeXX3uH8",
    genre: "Ambient",
    year: 1983,
    catalogLane: "trend",
    moods: ["dreamy", "serene", "cinematic"],
    energy: 1,
    valence: 6,
    timeFit: ["night", "morning"],
    verification: {
      score: 94,
      signals: [
        { label: "ambient reference work", weight: 36 },
        { label: "film and media afterlife", weight: 28 },
        { label: "critical endurance", weight: 30 }
      ],
      note: "앰비언트 음악의 정서적 기준점으로 자주 언급되는 곡."
    }
  },
  {
    id: "max-richter-daylight",
    title: "On the Nature of Daylight",
    artist: "Max Richter",
    sourceUrl: "https://www.youtube.com/watch?v=rVN1B-tUpgs",
    genre: "Modern Classical",
    year: 2004,
    catalogLane: "trend",
    moods: ["cinematic", "melancholy", "serene"],
    energy: 3,
    valence: 5,
    timeFit: ["evening", "night"],
    verification: {
      score: 92,
      signals: [
        { label: "modern classical recognition", weight: 32 },
        { label: "film usage resonance", weight: 30 },
        { label: "listener longevity", weight: 30 }
      ],
      note: "현대 클래식과 영화적 감성 사이에서 널리 검증된 곡."
    }
  },
  {
    id: "sakamoto-merry-christmas",
    title: "Merry Christmas, Mr. Lawrence",
    artist: "Ryuichi Sakamoto",
    sourceUrl: "https://www.youtube.com/watch?v=LGs_vGt0MY8",
    genre: "Film Score",
    year: 1983,
    catalogLane: "trend",
    moods: ["cinematic", "melancholy", "warm"],
    energy: 3,
    valence: 6,
    timeFit: ["evening", "night"],
    verification: {
      score: 96,
      signals: [
        { label: "film score canon", weight: 34 },
        { label: "global recognition", weight: 32 },
        { label: "cross-genre influence", weight: 30 }
      ],
      note: "동서양 감각이 섞인 선율로 세계적으로 오래 사랑받은 영화음악."
    }
  },
  {
    id: "richter-sleep-dream-variant",
    title: "Sleep Sequence",
    artist: "Local Curation Placeholder",
    sourceUrl: "",
    genre: "Sleep / Ambient",
    catalogLane: "personal",
    moods: ["nocturne", "serene", "dreamy"],
    energy: 1,
    valence: 5,
    timeFit: ["night"],
    verification: {
      score: 74,
      signals: [
        { label: "manual curation slot", weight: 24 },
        { label: "sleep mood fit", weight: 26 },
        { label: "replaceable provider target", weight: 24 }
      ],
      note: "API 연결 전 야간 자동재생 흐름을 검증하기 위한 교체 가능 슬롯."
    }
  }
];

export const moodOptions = [
  { value: "serene", label: "고요" },
  { value: "warm", label: "따뜻" },
  { value: "focus", label: "집중" },
  { value: "melancholy", label: "쓸쓸" },
  { value: "uplift", label: "환기" },
  { value: "nocturne", label: "밤" },
  { value: "cinematic", label: "영화적" },
  { value: "earthy", label: "어스" },
  { value: "dreamy", label: "몽환" },
  { value: "vital", label: "생기" }
] as const;
