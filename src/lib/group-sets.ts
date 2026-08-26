import type { Set as WorkoutSet } from '@/types';

export type SetGroup = { order: number; sets: WorkoutSet[] };

// Sets sharing an `order` are the same logical set (drop-set continuations), differentiated by `drop_index`.
export function groupSetsByOrder(sets: WorkoutSet[]): SetGroup[] {
  const groups = new Map<number, WorkoutSet[]>();
  for (const set of sets) {
    const list = groups.get(set.order) ?? [];
    list.push(set);
    groups.set(set.order, list);
  }
  return [...groups.entries()]
    .sort(([orderA], [orderB]) => orderA - orderB)
    .map(([order, groupSets]) => ({
      order,
      sets: [...groupSets].sort((a, b) => a.drop_index - b.drop_index),
    }));
}
