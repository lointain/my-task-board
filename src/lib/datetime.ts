import type { Locale } from "./i18n";

/**
 * 日期本地化：界面上的「月/日」按当前语言显示。
 * - zh-CN / zh-TW：11月16日
 * - en-US：Nov 16
 * - ja-JP：11/16
 */

const LOCALE_TAG: Record<Locale, string> = {
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  "en-US": "en-US",
  "ja-JP": "ja-JP",
};

function styleFor(locale: Locale): Intl.DateTimeFormatOptions {
  if (locale === "en-US") return { month: "short", day: "numeric" };
  if (locale === "ja-JP") return { month: "numeric", day: "numeric" };
  return { month: "long", day: "numeric" };
}

/** Date → 「11月16日」/「Nov 16」/「11/16」 */
export function formatMonthDay(date: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], styleFor(locale)).format(date);
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

/** `YYYY-MM-DD` 或 `MM-DD` → 本地化的月日 */
export function formatMonthDayKey(key: string, locale: Locale): string {
  const parts = key.split("-");
  const month = Number(parts[parts.length - 2]);
  const day = Number(parts[parts.length - 1]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return key;
  const date = new Date(2000, month - 1, day);
  return formatMonthDay(date, locale);
}
