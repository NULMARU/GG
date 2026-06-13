import type { Mood, ThemeProfile, Track } from "../types";

export const themeProfiles: Record<Mood, ThemeProfile> = {
  serene: {
    name: "Serene",
    accent: "#5e8c96",
    accentStrong: "#2d6876",
    text: "#172124",
    muted: "#566469",
    surface: "#f6faf8",
    surfaceAlt: "#e6f0ec",
    background: "linear-gradient(135deg, #f7fbf8 0%, #dbece8 48%, #eef3f5 100%)",
    border: "rgba(45, 104, 118, 0.18)",
    meterA: "#5e8c96",
    meterB: "#c77d54",
    meterC: "#536f8e"
  },
  warm: {
    name: "Warm",
    accent: "#b56f45",
    accentStrong: "#8f4f2f",
    text: "#241a14",
    muted: "#695a50",
    surface: "#fff8f2",
    surfaceAlt: "#f0e3d7",
    background: "linear-gradient(135deg, #fff8f2 0%, #e9d8c4 52%, #d9e4de 100%)",
    border: "rgba(143, 79, 47, 0.2)",
    meterA: "#b56f45",
    meterB: "#6f8f81",
    meterC: "#7e6b9b"
  },
  focus: {
    name: "Focus",
    accent: "#447a65",
    accentStrong: "#245b4a",
    text: "#15211d",
    muted: "#53645e",
    surface: "#f7faf5",
    surfaceAlt: "#e2eadf",
    background: "linear-gradient(135deg, #f7faf5 0%, #dae8dc 46%, #e8edf2 100%)",
    border: "rgba(36, 91, 74, 0.2)",
    meterA: "#447a65",
    meterB: "#b38b4d",
    meterC: "#4d6f9d"
  },
  melancholy: {
    name: "Melancholy",
    accent: "#6f799d",
    accentStrong: "#4d587e",
    text: "#171b28",
    muted: "#5b6074",
    surface: "#f5f6fb",
    surfaceAlt: "#e2e4ef",
    background: "linear-gradient(135deg, #f5f6fb 0%, #dfe3ee 52%, #eadfd9 100%)",
    border: "rgba(77, 88, 126, 0.22)",
    meterA: "#6f799d",
    meterB: "#b58c79",
    meterC: "#658a82"
  },
  uplift: {
    name: "Uplift",
    accent: "#b5822f",
    accentStrong: "#7d601e",
    text: "#211c12",
    muted: "#655d4a",
    surface: "#fffaf0",
    surfaceAlt: "#eee5cb",
    background: "linear-gradient(135deg, #fffaf0 0%, #e7d7a7 45%, #d9e9e6 100%)",
    border: "rgba(125, 96, 30, 0.2)",
    meterA: "#b5822f",
    meterB: "#3d827b",
    meterC: "#a35f72"
  },
  nocturne: {
    name: "Nocturne",
    accent: "#8f86c8",
    accentStrong: "#665fa4",
    text: "#f4f0ff",
    muted: "#cbc5df",
    surface: "#15151e",
    surfaceAlt: "#242333",
    background: "linear-gradient(135deg, #11131c 0%, #29283a 52%, #253533 100%)",
    border: "rgba(203, 197, 223, 0.18)",
    meterA: "#8f86c8",
    meterB: "#c29370",
    meterC: "#77a99a"
  },
  cinematic: {
    name: "Cinematic",
    accent: "#a86d5a",
    accentStrong: "#80483c",
    text: "#1d1816",
    muted: "#675d58",
    surface: "#fbf7f4",
    surfaceAlt: "#e8ded8",
    background: "linear-gradient(135deg, #fbf7f4 0%, #dfd5ce 40%, #d9e0e8 100%)",
    border: "rgba(128, 72, 60, 0.22)",
    meterA: "#a86d5a",
    meterB: "#566f92",
    meterC: "#7f8a52"
  },
  earthy: {
    name: "Earthy",
    accent: "#71824a",
    accentStrong: "#4f6131",
    text: "#1d2015",
    muted: "#5d6550",
    surface: "#f7f8f0",
    surfaceAlt: "#e2e7d4",
    background: "linear-gradient(135deg, #f7f8f0 0%, #dce6cd 50%, #eadfd3 100%)",
    border: "rgba(79, 97, 49, 0.22)",
    meterA: "#71824a",
    meterB: "#a36b4f",
    meterC: "#5d8490"
  },
  dreamy: {
    name: "Dreamy",
    accent: "#8a72a4",
    accentStrong: "#664f82",
    text: "#1f1724",
    muted: "#665a6e",
    surface: "#faf6fb",
    surfaceAlt: "#e8dfec",
    background: "linear-gradient(135deg, #faf6fb 0%, #e8dfec 44%, #d8e7e4 100%)",
    border: "rgba(102, 79, 130, 0.2)",
    meterA: "#8a72a4",
    meterB: "#b57a5f",
    meterC: "#5c8b82"
  },
  vital: {
    name: "Vital",
    accent: "#bf6c3a",
    accentStrong: "#884b2a",
    text: "#241912",
    muted: "#6e5a4d",
    surface: "#fff7ef",
    surfaceAlt: "#f0dfcf",
    background: "linear-gradient(135deg, #fff7ef 0%, #e9d2bd 44%, #d7e6dd 100%)",
    border: "rgba(136, 75, 42, 0.22)",
    meterA: "#bf6c3a",
    meterB: "#4e867a",
    meterC: "#826ba1"
  }
};

export function getDominantMood(track?: Track): Mood {
  return track?.moods[0] ?? "serene";
}

export function getThemeForTrack(track?: Track): ThemeProfile {
  return themeProfiles[getDominantMood(track)];
}

export function themeToCssVars(theme: ThemeProfile): Record<string, string> {
  return {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--text": theme.text,
    "--muted": theme.muted,
    "--surface": theme.surface,
    "--surface-alt": theme.surfaceAlt,
    "--app-bg": theme.background,
    "--border": theme.border,
    "--meter-a": theme.meterA,
    "--meter-b": theme.meterB,
    "--meter-c": theme.meterC
  };
}
