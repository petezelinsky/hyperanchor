/**
 * Each person's AI allowance for a day (UTC), in tokens: hearing what was said, sorting it into tasks and writing the
 * summary in Analytics all draw on it. The same for every account. Kept apart from budget.ts (which talks to the
 * database) so the page can show it too.
 */
export const DAILY_TOKENS = 15_000;
