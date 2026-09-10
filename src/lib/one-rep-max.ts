/**
 * Estimated one-rep max (Epley). It's what makes two sessions comparable: 10 reps at 80 kg is more
 * strength than 1 rep at 100 kg, even though the raw load says the opposite.
 */

// Epley drifts high past roughly a dozen reps, so the estimate stops crediting them rather than
// turning an endurance set into an implausible record.
const MAX_CREDITED_REPS = 12;

export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  // A true single needs no extrapolation.
  if (reps === 1) return weightKg;
  return weightKg * (1 + Math.min(reps, MAX_CREDITED_REPS) / 30);
}
