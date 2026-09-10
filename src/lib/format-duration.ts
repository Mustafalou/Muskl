/** Seconds as a compact "1:30" / "45 s" reading — the way a stopwatch shows a set, not a clock. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Parses what someone types into a duration field: "90" is 90 seconds, "1:30" is a minute and a
 * half. Returns null when it isn't a usable duration, so callers can refuse to save.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const [minutePart, secondPart] = trimmed.split(':');
    const minutes = parseInt(minutePart, 10);
    const seconds = parseInt(secondPart, 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  const seconds = parseInt(trimmed, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
