/**
 * Age as at 1 January of the given year (Australian dance-comp convention).
 * A child born 15 June 2018 is 7 on 1 January 2026.
 * A child born 1 January 2018 is 8 on 1 January 2026.
 */
export function ageAsAt1January(dob: string, year: number): number {
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return 0;
  let age = year - y;
  if (!(m === 1 && d === 1)) {
    age -= 1;
  }
  return Math.max(age, 0);
}

export function ageAsAtCompYear(dob: string, startDate: string): number {
  return ageAsAt1January(dob, Number(startDate.slice(0, 4)));
}

export function displayAge(dob: string, year = new Date().getFullYear()): string {
  const age = ageAsAt1January(dob, year);
  return `${age} (as at 1 Jan ${year})`;
}
