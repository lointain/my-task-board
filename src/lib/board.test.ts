import { describe, expect, it } from "vitest";
import { boardDateKey, dateKey, parseDateKey, startOfWeek, weekDays } from "./board";

/** 用本地时区构造日期，避免 ISO 字符串在不同 TZ 下漂移。 */
function local(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

describe("startOfWeek", () => {
  it("returns the same Monday with the time zeroed", () => {
    const monday = new Date(2026, 10, 16, 13, 45, 30); // 2026-11-16 周一
    const start = startOfWeek(monday);
    expect(dateKey(start)).toBe("2026-11-16");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("walks back to Monday from mid-week days", () => {
    expect(dateKey(startOfWeek(local(2026, 11, 18)))).toBe("2026-11-16"); // 周三
    expect(dateKey(startOfWeek(local(2026, 11, 21)))).toBe("2026-11-16"); // 周六
  });

  it("keeps Sunday in the week that started the previous Monday (跨月)", () => {
    // 2026-11-01 是周日，属于 2026-10-26（周一）开始的那一周
    const start = startOfWeek(local(2026, 11, 1));
    expect(start.getDay()).toBe(1); // Monday
    expect(dateKey(start)).toBe("2026-10-26");
  });

  it("crosses a month boundary forward", () => {
    // 2026-12-01 是周二 → 2026-11-30（周一）
    expect(dateKey(startOfWeek(local(2026, 12, 1)))).toBe("2026-11-30");
  });
});

describe("dateKey / parseDateKey", () => {
  it("pads month and day", () => {
    expect(dateKey(local(2026, 1, 5))).toBe("2026-01-05");
    expect(dateKey(local(2026, 11, 16))).toBe("2026-11-16");
  });

  it("round-trips a date key", () => {
    const key = "2026-11-16";
    expect(dateKey(parseDateKey(key))).toBe(key);
  });
});

describe("boardDateKey", () => {
  it("returns null for the week board", () => {
    expect(boardDateKey("week", local(2026, 11, 16))).toBeNull();
  });

  it("maps each day board to the current week's date", () => {
    const now = local(2026, 11, 16); // 周一
    expect(boardDateKey("mon", now)).toBe("2026-11-16");
    expect(boardDateKey("fri", now)).toBe("2026-11-20");
    expect(boardDateKey("sun", now)).toBe("2026-11-22");
  });

  it("uses the enclosing week for Sunday input (周日 → 周一 边界)", () => {
    const sunday = local(2026, 11, 1); // 2026-11-01 周日
    expect(boardDateKey("mon", sunday)).toBe("2026-10-26"); // 上周一，跨月
    expect(boardDateKey("sun", sunday)).toBe("2026-11-01");
  });
});

describe("weekDays", () => {
  it("returns 7 day boards from Monday to Sunday", () => {
    const days = weekDays(local(2026, 11, 16));
    expect(days.map((d) => d.board)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(days[0].dateKey).toBe("2026-11-16");
    expect(days[6].dateKey).toBe("2026-11-22");
  });

  it("spans a month boundary and marks only the given day as today", () => {
    const days = weekDays(local(2026, 11, 1)); // 周日
    expect(days[0].dateKey).toBe("2026-10-26");
    expect(days[6].dateKey).toBe("2026-11-01");
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
    expect(days.find((d) => d.isToday)?.board).toBe("sun");
  });
});
