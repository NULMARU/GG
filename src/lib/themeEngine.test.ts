import { describe, expect, it } from "vitest";
import { seedTracks } from "../data/seedTracks";
import { getThemeForTrack, themeToCssVars } from "./themeEngine";

describe("theme engine", () => {
  it("turns a track mood into complete CSS variables", () => {
    const theme = getThemeForTrack(seedTracks[0]);
    const vars = themeToCssVars(theme);

    expect(vars["--accent"]).toMatch(/^#/);
    expect(vars["--app-bg"]).toContain("linear-gradient");
    expect(vars["--meter-a"]).toMatch(/^#/);
  });
});
