import { describe, it, expect, vi } from 'vitest';
import { pollForFields } from '../src/background/poll';
import { FieldMeta } from '../src/shared/types';

const noSleep = () => Promise.resolve();
const sampleFields: FieldMeta[] = [
  { id: 'a', elementId: '', elementName: '', label: 'Name', type: 'text' },
];

describe('pollForFields', () => {
  it('returns fields on the first attempt when already available', async () => {
    const attempt = vi.fn().mockResolvedValue(sampleFields);
    const result = await pollForFields(attempt, { sleep: noSleep });
    expect(result).toBe(sampleFields);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries until the async-injected listener responds', async () => {
    // Simulates the content-script loader: its dynamic import hasn't registered
    // the message listener yet, so the first two attempts return null.
    const attempt = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(sampleFields);
    const result = await pollForFields(attempt, { sleep: noSleep });
    expect(result).toBe(sampleFields);
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('gives up and returns null after exhausting the retry budget', async () => {
    const attempt = vi.fn().mockResolvedValue(null);
    const result = await pollForFields(attempt, { tries: 4, sleep: noSleep });
    expect(result).toBeNull();
    expect(attempt).toHaveBeenCalledTimes(4);
  });
});
