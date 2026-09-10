import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

/**
 * A durable outbox for the workout-logging path.
 *
 * Gyms are basements. Before this existed, a set validated without signal was simply lost: the
 * insert failed, an error toast appeared, and the rep was gone. Here every write is either applied
 * straight away or parked on disk and replayed later, so a whole session can be logged offline.
 *
 * What makes it simple is that `workouts`, `exercises` and `sets` all use `uuid` primary keys with
 * a `gen_random_uuid()` default: the app can pick the id itself, so a row created offline already
 * has its final identity. Nothing has to be renumbered at sync time, and children can reference
 * parents that haven't reached the server yet.
 */

const QUEUE_KEY = 'offline-queue:v1';
// A write the server actively rejects will never succeed by being retried unchanged; this bounds
// how long such an entry may block everything queued behind it.
const MAX_ATTEMPTS = 5;

export type PendingWrite =
  | { kind: 'insert'; table: string; rows: Record<string, unknown>[] }
  | { kind: 'update'; table: string; values: Record<string, unknown>; match: Record<string, unknown> }
  | { kind: 'delete'; table: string; match: Record<string, unknown> };

type QueueEntry = { write: PendingWrite; queuedAt: number; attempts: number };

type WriteError = { code?: string | null; message?: string | null } | null;

let queue: QueueEntry[] = [];
let isLoaded = false;
// The in-flight drain, so concurrent callers join it instead of returning while it's still running.
let flushPromise: Promise<void> | null = null;
const listeners = new Set<(count: number) => void>();

/** RFC 4122 v4 shape. Math.random isn't cryptographic, but these ids only need to not collide. */
export function newId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) out += '-';
    else if (index === 14) out += '4';
    else if (index === 19) out += hex[((Math.random() * 4) | 0) + 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

function notify() {
  for (const listener of listeners) listener(queue.length);
}

export function subscribePendingWrites(listener: (count: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pendingWriteCount() {
  return queue.length;
}

async function ensureLoaded() {
  if (isLoaded) return;
  isLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) queue = JSON.parse(raw) as QueueEntry[];
  } catch {
    // A corrupt queue is worth losing; refusing to start would be worse.
    queue = [];
  }
  notify();
}

async function persist() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Out of storage. The in-memory queue still drains this session.
  }
  notify();
}

/** PostgREST always sets a code; a bare transport failure doesn't. */
export function isNetworkError(error: WriteError): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  // Offline, a failed token refresh can surface as an auth error rather than a transport one; it's
  // still "no network", and treating it as permanent would throw the write away.
  const transportWords = ['network', 'fetch', 'timeout', 'connection', 'unreachable', 'offline', 'aborted', 'retryable'];
  if (transportWords.some((word) => message.includes(word))) return true;
  return !error.code;
}

/** The row is already there — a replay of a write that did land before the response was lost. */
function isDuplicate(error: WriteError): boolean {
  return error?.code === '23505';
}

function applyFilters<T extends { eq: (k: string, v: unknown) => T; in: (k: string, v: readonly unknown[]) => T }>(
  builder: T,
  match: Record<string, unknown>,
): T {
  let next = builder;
  for (const [column, value] of Object.entries(match)) {
    next = Array.isArray(value) ? next.in(column, value) : next.eq(column, value);
  }
  return next;
}

/**
 * Depending on how the connection drops, the client either resolves with an error or throws
 * outright. Unhandled, a throw rejects all the way up to a caller with no catch, which leaves the
 * button spinning and shows nothing at all — so both shapes are normalised into one error object.
 */
export function asTransportError(thrown: unknown): WriteError {
  return { code: null, message: thrown instanceof Error ? thrown.message : 'Network request failed' };
}

async function applyWrite(write: PendingWrite): Promise<WriteError> {
  try {
    if (write.kind === 'insert') {
      const { error } = await supabase.from(write.table).insert(write.rows);
      return error;
    }
    if (write.kind === 'update') {
      const { error } = await applyFilters(supabase.from(write.table).update(write.values), write.match);
      return error;
    }
    const { error } = await applyFilters(supabase.from(write.table).delete(), write.match);
    return error;
  } catch (thrown) {
    return asTransportError(thrown);
  }
}

async function enqueue(write: PendingWrite) {
  queue.push({ write, queuedAt: Date.now(), attempts: 0 });
  await persist();
}

/**
 * Applies a write now, or parks it for later if the device is offline.
 *
 * Callers update their own state optimistically either way — with client-side ids there is nothing
 * to wait for. `error` is only set when the server actively refused the write, which is a real
 * failure the user should see.
 */
export async function runWrite(write: PendingWrite): Promise<{ queued: boolean; error: string | null }> {
  await ensureLoaded();

  // Order is load-bearing: a set must not reach the server before the exercise it belongs to. Once
  // anything is waiting, everything behind it waits too.
  if (queue.length > 0) {
    await enqueue(write);
    void flushQueue();
    return { queued: true, error: null };
  }

  const error = await applyWrite(write);
  if (!error || isDuplicate(error)) return { queued: false, error: null };

  if (isNetworkError(error)) {
    await enqueue(write);
    return { queued: true, error: null };
  }

  return { queued: false, error: error.message ?? 'Write failed' };
}

/**
 * Replays parked writes oldest first, stopping at the first one that still can't go through.
 *
 * Awaiting this always means "the current drain has finished": a second caller joins the run
 * already in progress rather than being handed an immediate, misleading resolution.
 */
export function flushQueue(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = drain().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function drain(): Promise<void> {
  await ensureLoaded();

  try {
    // Entries appended while this runs are picked up by the same loop, which is why joining an
    // in-flight drain is enough for a caller to know its own write was attempted.
    while (queue.length > 0) {
      const entry = queue[0];
      const error = await applyWrite(entry.write);

      if (!error || isDuplicate(error)) {
        queue.shift();
        await persist();
        continue;
      }

      if (isNetworkError(error)) break;

      // Refused by the server. Keep it a few rounds in case the cause is transient (an expired
      // token being refreshed, say), then drop it rather than wedge the queue forever.
      entry.attempts += 1;
      if (entry.attempts >= MAX_ATTEMPTS) {
        console.warn(`[offline-queue] dropping ${entry.write.kind} on ${entry.write.table}: ${error.message}`);
        queue.shift();
      }
      await persist();
      break;
    }
  } finally {
    notify();
  }
}

/** Test seam: resets the module between cases. */
export async function resetQueueForTests() {
  queue = [];
  isLoaded = false;
  flushPromise = null;
  await AsyncStorage.removeItem(QUEUE_KEY);
}
