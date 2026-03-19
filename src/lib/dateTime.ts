function isFiniteTimestamp(value: number): boolean {
  return Number.isFinite(value);
}

export function parseIsoDateToTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return isFiniteTimestamp(timestamp) ? timestamp : null;
}

export function parseReleaseYear(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})(?:-\d{2})?(?:-\d{2})?$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

export function getYearMonthKeyFromIso(value?: string | null): string | null {
  const timestamp = parseIsoDateToTimestamp(value);
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
