/**
 * The AI summary in Analytics, as both the server and the page see it: which periods have one, what unlocks it, and what
 * a summary that has been written looks like. Nothing here talks to a model or a database.
 */

export type SummaryPeriod = "day" | "week" | "month" | "year";

/**
 * Tasks done in a period before its summary can be written, and done again before it can be written anew (the count
 * starts over each time one is written): a summary has something to say, and the day's AI allowance goes further.
 */
export const UNLOCK: Record<SummaryPeriod, number> = { day: 2, week: 8, month: 32, year: 128 };

export type Summary = { headline: string; points: string[]; next: string };

/** A summary as it is kept: the period it is about, when it was written, and how many of its tasks were done then. */
export type SavedSummary = {
  id: string;
  period: SummaryPeriod;
  /** The period's first and last day (YYYY-MM-DD). */
  start: string;
  end: string;
  /** "Nov 9 – 15", "November 2026", … as the page named the period. */
  label: string;
  /** Tasks of the period done when it was written. */
  done: number;
  summary: Summary;
  tokens: number;
  createdAt: string;
};

/** The state of one period's summary: the latest one still kept, and the done count the next one has to beat. */
export type SummaryState = {
  current: SavedSummary | null;
  /** Done when the last summary of this period was written (deleted ones too); null: never written. */
  since: number | null;
  /** Summaries kept, across every period. */
  total: number;
};

/** How many more tasks have to be done in the period before a summary can be written (0: it can be now). */
export const toUnlock = (period: SummaryPeriod, done: number, since: number | null) => Math.max(0, (since ?? 0) + UNLOCK[period] - done);
