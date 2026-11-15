import { describe, expect, it } from "vitest";
import { cleanFlashcard, cleanTerm, searchTerms, sortTerms, splitByTerms } from "./cards.ts";

const t = (term: string, definition = "def", id = term) => ({ id, term, definition });

describe("flashcards and glossary rules", () => {
  it("trims and validates a card", () => {
    expect(cleanFlashcard({ id: null, front: "  Q ", back: " A  " })).toEqual({
      id: null,
      front: "Q",
      back: "A",
    });
    expect(() => cleanFlashcard({ id: null, front: " ", back: "A" })).toThrow("front");
    expect(() => cleanFlashcard({ id: null, front: "Q", back: "" })).toThrow("back");
    expect(() => cleanFlashcard({ id: null, front: "x".repeat(2001), back: "A" })).toThrow(
      "too long",
    );
  });

  it("trims and validates a term", () => {
    expect(cleanTerm({ id: null, term: " Systole ", definition: " d " })).toMatchObject({
      term: "Systole",
      definition: "d",
    });
    expect(() => cleanTerm({ id: null, term: "", definition: "d" })).toThrow("term");
    expect(() => cleanTerm({ id: null, term: "T", definition: "" })).toThrow("means");
  });

  it("sorts and searches terms ignoring case", () => {
    const list = [t("Systole"), t("apex"), t("Diastole", "Relaxation phase")];
    expect(sortTerms(list).map((x) => x.term)).toEqual(["apex", "Diastole", "Systole"]);
    expect(searchTerms(list, "RELAX").map((x) => x.term)).toEqual(["Diastole"]);
    expect(searchTerms(list, "  ")).toHaveLength(3);
  });

  it("finds whole-word terms in text, longest first", () => {
    const terms = [t("heart"), t("heart rate")];
    const parts = splitByTerms("The Heart rate and the heart; hearth is not.", terms);
    expect(parts.filter((p) => p.term).map((p) => [p.text, p.term!.term])).toEqual([
      ["Heart rate", "heart rate"],
      ["heart", "heart"],
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("The Heart rate and the heart; hearth is not.");
  });

  it("copes with special characters and no terms", () => {
    const parts = splitByTerms("a (b) c", [t("(b)")]);
    expect(parts.map((p) => p.text).join("")).toBe("a (b) c");
    expect(parts.some((p) => p.term?.term === "(b)")).toBe(true);
    expect(splitByTerms("plain", [])).toEqual([{ text: "plain" }]);
    expect(splitByTerms("a", [t("a")])).toEqual([{ text: "a" }]);
  });
});
