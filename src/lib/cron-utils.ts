import { CronExpressionParser } from 'cron-parser';

/**
 * Compute the next run time from a cron expression.
 * Returns an ISO string for storing in the `run_at` column.
 *
 * @param cronExpression - Standard 5-field cron expression (min hour dom month dow)
 * @param from - Starting point (defaults to now)
 * @returns ISO timestamp of the next occurrence, or null if parsing fails
 */
export function getNextRunAt(cronExpression: string, from?: Date): string | null {
  try {
    const options: { currentDate?: Date; tz?: string } = {};
    if (from) options.currentDate = from;
    // Use Asia/Jakarta timezone since the app targets Indonesian users
    options.tz = 'Asia/Jakarta';

    const interval = CronExpressionParser.parse(cronExpression, options);
    const next = interval.next();
    return next.toDate().toISOString();
  } catch {
    return null;
  }
}

/**
 * Check if a cron expression is valid.
 */
export function isValidCron(cronExpression: string): boolean {
  try {
    CronExpressionParser.parse(cronExpression);
    return true;
  } catch {
    return false;
  }
}
