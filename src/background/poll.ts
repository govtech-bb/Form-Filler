import { FieldMeta } from '../shared/types';

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Repeatedly runs `attempt` until it yields fields or the retry budget is spent.
 *
 * The auto-injected content-script loader registers its message listener only
 * after an async dynamic import resolves, so the first attempt(s) right after
 * injection can return null before the listener exists. Polling bridges that gap.
 */
export async function pollForFields(
  attempt: () => Promise<FieldMeta[] | null>,
  opts: { tries?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<FieldMeta[] | null> {
  const { tries = 10, delayMs = 50, sleep = defaultSleep } = opts;
  for (let i = 0; i < tries; i++) {
    const fields = await attempt();
    if (fields) return fields;
    if (i < tries - 1) await sleep(delayMs);
  }
  return null;
}
