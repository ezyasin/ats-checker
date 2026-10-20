const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

// One date: "Jan 2020", "January, 2020", "01/2020", "2020-01", "2020".
const DATE = `(?:(?:${MONTH_NAMES})\\.?,?\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4}[/.-](?:0?[1-9]|1[0-2])(?!\\d)|\\d{4})`;
const OPEN_END = "present|current|now|today|ongoing|date";
const RANGE = new RegExp(
  `(?<![\\d/.])(${DATE})\\s*(?:-|–|—|to|until|till)\\s*(${DATE}|${OPEN_END})(?![\\d/])`,
  "gi"
);

export interface DateRange {
  /** Months since year 0, so ranges can be compared and merged. */
  start: number;
  end: number;
  text: string;
}

function parseDate(value: string): { month: number; yearOnly: boolean } | null {
  const text = value.toLowerCase().replace(/,/g, " ").trim();

  const named = text.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (named && named[1] in MONTHS) {
    return { month: Number(named[2]) * 12 + MONTHS[named[1]], yearOnly: false };
  }
  const monthFirst = text.match(/^(\d{1,2})[/.](\d{4})$/);
  if (monthFirst) {
    const month = Number(monthFirst[1]);
    if (month < 1 || month > 12) return null;
    return { month: Number(monthFirst[2]) * 12 + month - 1, yearOnly: false };
  }
  const yearFirst = text.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (yearFirst) {
    return { month: Number(yearFirst[1]) * 12 + Number(yearFirst[2]) - 1, yearOnly: false };
  }
  const year = text.match(/^(\d{4})$/);
  if (year) {
    return { month: Number(year[1]) * 12, yearOnly: true };
  }
  return null;
}

/** Every plausible "start – end" date range in the text. */
export function findDateRanges(text: string, now: Date = new Date()): DateRange[] {
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const earliest = 1960 * 12;
  const ranges: DateRange[] = [];

  for (const match of text.matchAll(RANGE)) {
    const start = parseDate(match[1]);
    if (!start) continue;

    let end: number;
    if (new RegExp(`^(${OPEN_END})$`, "i").test(match[2])) {
      end = nowMonth + 1;
    } else {
      const parsed = parseDate(match[2]);
      if (!parsed) continue;
      // "Jan 2020 – Dec 2020" is 12 months, so month-precise ends are inclusive.
      // "2019 – 2022" counts as three years, not four: year-only ends stay at January.
      end = parsed.yearOnly ? parsed.month : parsed.month + 1;
    }

    end = Math.min(end, nowMonth + 1);
    if (start.month < earliest || start.month > nowMonth || end < start.month) continue;
    ranges.push({ start: start.month, end, text: match[0] });
  }
  return ranges;
}

/** Total years covered by the ranges, counting overlapping jobs once. */
export function totalYears(ranges: DateRange[]): number {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let months = 0;
  let currentStart = -1;
  let currentEnd = -1;

  for (const range of sorted) {
    if (range.start > currentEnd) {
      if (currentEnd >= 0) months += currentEnd - currentStart;
      currentStart = range.start;
      currentEnd = range.end;
    } else {
      currentEnd = Math.max(currentEnd, range.end);
    }
  }
  if (currentEnd >= 0) months += currentEnd - currentStart;

  return Math.round((months / 12) * 10) / 10;
}
