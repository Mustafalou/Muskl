/**
 * Supersets: consecutive exercises sharing a `superset_id` are performed back to back — one set of
 * each, then rest. Each exercise keeps its own sets and history, so progression and 1RM stay per
 * lift; the group only changes how the workout is run and shown.
 *
 * Groups are always contiguous runs in `order`: exercises can't be reordered, and linking is only
 * ever offered between neighbours.
 */

type Linkable = { superset_id: string | null };

export function isLinkedToNext(items: readonly Linkable[], index: number): boolean {
  const current = items[index]?.superset_id;
  return current != null && current === items[index + 1]?.superset_id;
}

/** Indices of the contiguous group `index` belongs to — just itself when not in a superset. */
export function supersetMembers(items: readonly Linkable[], index: number): number[] {
  let start = index;
  while (start > 0 && isLinkedToNext(items, start - 1)) start -= 1;
  let end = index;
  while (isLinkedToNext(items, end)) end += 1;
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

/**
 * The superset ids after toggling the link between `index` and `index + 1`, aligned with `items`.
 * Linking merges the two neighbouring groups; unlinking splits one group in two, and a side left
 * with a single exercise stops being a superset.
 */
export function toggleSupersetLink(
  items: readonly Linkable[],
  index: number,
  makeId: () => string,
): (string | null)[] {
  const ids = items.map((item) => item.superset_id);
  if (index < 0 || index + 1 >= items.length) return ids;

  if (isLinkedToNext(items, index)) {
    const members = supersetMembers(items, index);
    const before = members.filter((member) => member <= index);
    const after = members.filter((member) => member > index);
    if (before.length < 2) for (const member of before) ids[member] = null;
    // The left side keeps the original id, so only the right side needs a fresh one.
    const afterId = after.length > 1 ? makeId() : null;
    for (const member of after) ids[member] = afterId;
    return ids;
  }

  const target = items[index].superset_id ?? items[index + 1].superset_id ?? makeId();
  for (const member of [...supersetMembers(items, index), ...supersetMembers(items, index + 1)]) {
    ids[member] = target;
  }
  return ids;
}

/**
 * Where a Live session goes once set `setIndex` of exercise `index` is done, when that exercise is
 * part of a superset: the next exercise of the round follows straight away, and the rest only
 * comes once every exercise has done its set for this round. `plannedSets[i]` is how many planned
 * sets exercise `i` has — members with fewer sets simply drop out of the later rounds.
 *
 * Returns null outside a superset, so the caller keeps its regular one-exercise flow.
 */
export function nextSupersetStep(
  items: readonly Linkable[],
  plannedSets: readonly number[],
  index: number,
  setIndex: number,
): { index: number; setIndex: number; rest: boolean } | null {
  const members = supersetMembers(items, index);
  if (members.length < 2) return null;

  for (const member of members) {
    if (member > index && plannedSets[member] > setIndex) {
      return { index: member, setIndex, rest: false };
    }
  }

  for (const member of members) {
    if (plannedSets[member] > setIndex + 1) {
      return { index: member, setIndex: setIndex + 1, rest: true };
    }
  }

  // Every member has done all its planned sets: stay put, past the plan, like a lone exercise.
  return { index, setIndex: setIndex + 1, rest: true };
}

/** Display blocks: each superset is one block of consecutive indices, every other exercise its own. */
export function supersetBlocks(items: readonly Linkable[]): number[][] {
  const blocks: number[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    if (index > 0 && isLinkedToNext(items, index - 1)) blocks[blocks.length - 1].push(index);
    else blocks.push([index]);
  }
  return blocks;
}

/**
 * Toggles the link between `index` and `index + 1` and returns only what changed: the new id per
 * exercise, and the writes that persist it — one per resulting group id, null included — so each
 * screen doesn't have to re-derive them.
 */
export function supersetLinkChanges(
  items: readonly (Linkable & { id: string })[],
  index: number,
  makeId: () => string,
): { nextById: Map<string, string | null>; writes: { supersetId: string | null; ids: string[] }[] } {
  const nextIds = toggleSupersetLink(items, index, makeId);
  const nextById = new Map<string, string | null>();
  const idsByValue = new Map<string | null, string[]>();

  items.forEach((item, position) => {
    const next = nextIds[position];
    if (item.superset_id === next) return;
    nextById.set(item.id, next);
    idsByValue.set(next, [...(idsByValue.get(next) ?? []), item.id]);
  });

  return {
    nextById,
    writes: [...idsByValue].map(([supersetId, ids]) => ({ supersetId, ids })),
  };
}
