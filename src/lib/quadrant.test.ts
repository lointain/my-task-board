import { describe, expect, it } from "vitest";
import { quadrantOf } from "./quadrant";

describe("quadrantOf", () => {
  it("maps the four quadrants", () => {
    expect(quadrantOf(80, 90)).toBe("q1");
    expect(quadrantOf(20, 90)).toBe("q2");
    expect(quadrantOf(80, 20)).toBe("q3");
    expect(quadrantOf(20, 20)).toBe("q4");
  });

  it("treats the 50/50 lines as urgent/important", () => {
    expect(quadrantOf(50, 50)).toBe("q1");
    expect(quadrantOf(49, 50)).toBe("q2");
    expect(quadrantOf(50, 49)).toBe("q3");
  });
});
