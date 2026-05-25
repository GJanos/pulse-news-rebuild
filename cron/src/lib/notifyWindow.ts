/** Returns UTC HH:MM:SS boundaries for the 30-minute window ending at now. */
export function notifyWindow(): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
  return {
    start: fmt(new Date(now.getTime() - 30 * 60 * 1000)),
    end: fmt(now),
  };
}
