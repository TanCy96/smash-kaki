import { describe, expect, it } from "vitest";
import { normalizePlayerNames } from "./players";

describe("normalizePlayerNames", () => {
  it("trims whitespace and drops blank entries", () => {
    expect(normalizePlayerNames(["  Ali ", "", "   ", "Siti"], { max: 10 })).toEqual([
      "Ali",
      "Siti",
    ]);
  });

  it("dedupes case-insensitively, keeping the first occurrence's casing", () => {
    expect(normalizePlayerNames(["Ali", "ali", "ALI"], { max: 10 })).toEqual(["Ali"]);
  });

  it("preserves input order", () => {
    expect(normalizePlayerNames(["Zoe", "Ali", "Bob"], { max: 10 })).toEqual([
      "Zoe",
      "Ali",
      "Bob",
    ]);
  });

  it("caps the result at max", () => {
    expect(normalizePlayerNames(["a", "b", "c", "d"], { max: 2 })).toEqual(["a", "b"]);
  });

  it("returns an empty array when nothing is valid", () => {
    expect(normalizePlayerNames(["", "  "], { max: 10 })).toEqual([]);
  });
});
