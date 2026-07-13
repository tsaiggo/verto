export function formatDate(dateStr: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    // Date-only values in frontmatter represent a calendar date, not midnight
    // in the viewer's local timezone. Formatting them in UTC prevents the date
    // from moving back one day in timezones west of UTC.
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  });
}
