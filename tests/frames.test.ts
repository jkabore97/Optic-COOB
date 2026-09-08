import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_FRAMES as FRAMES } from "../src/lib/frames";

describe("catalogue", () => {
  it("a des slugs uniques et un visuel pour chaque monture", () => {
    const slugs = new Set(FRAMES.map((f) => f.slug));
    expect(slugs.size).toBe(FRAMES.length);
    for (const f of FRAMES) {
      expect(existsSync(path.resolve(__dirname, `../public/frames/${f.slug}.svg`)), f.slug).toBe(true);
    }
  });
});
