import { Location, Schedule } from 'fhir/r4b';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readExtensionJson, withExtensionJson } from './extensions';

const URL_A = 'https://example.org/ext/a';
const URL_B = 'https://example.org/ext/b';

describe('readExtensionJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads a blob back off any resource that carries extensions', () => {
    // Typed structurally, so a Schedule and a Location are equally acceptable without naming either.
    const schedule = { resourceType: 'Schedule', extension: [{ url: URL_A, valueString: '{"slotLength":15}' }] };
    const location = { resourceType: 'Location', extension: [{ url: URL_A, valueString: '{"slotLength":30}' }] };

    expect(readExtensionJson<{ slotLength: number }>(schedule as Schedule, URL_A)?.slotLength).toBe(15);
    expect(readExtensionJson<{ slotLength: number }>(location as Location, URL_A)?.slotLength).toBe(30);
  });

  it('reports nothing when the extension is absent', () => {
    expect(readExtensionJson({ extension: [{ url: URL_B, valueString: '{}' }] }, URL_A)).toBeUndefined();
    expect(readExtensionJson({}, URL_A)).toBeUndefined();
  });

  it('reports nothing rather than throwing when the stored JSON is malformed', () => {
    // The point of the helper. A resource whose blob will not parse has to stay readable enough to be
    // repaired or deleted; throwing would make the screen that shows it unreachable.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      readExtensionJson({ id: 'abc', extension: [{ url: URL_A, valueString: '{not json' }] }, URL_A)
    ).toBeUndefined();
  });

  it('hands a malformed blob to the caller’s reporter', () => {
    // `utils` is shared with the browser and has no Sentry client, so reporting is the caller's to supply.
    // Without this, malformed stored JSON is silent — and it is always a defect in whatever wrote it.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onError = vi.fn();

    readExtensionJson({ extension: [{ url: URL_A, valueString: 'nope' }] }, URL_A, onError);

    expect(onError).toHaveBeenCalledOnce();
  });

  it('does not call the reporter when there is simply nothing stored', () => {
    const onError = vi.fn();

    readExtensionJson({}, URL_A, onError);

    expect(onError).not.toHaveBeenCalled();
  });
});

describe('withExtensionJson', () => {
  it('replaces one blob and leaves every other extension untouched', () => {
    const resource = {
      extension: [
        { url: URL_B, valueString: 'keep me' },
        { url: URL_A, valueString: '{"old":true}' },
      ],
    };

    const next = withExtensionJson(resource, URL_A, { fresh: true });

    expect(next).toEqual([
      { url: URL_B, valueString: 'keep me' },
      { url: URL_A, valueString: '{"fresh":true}' },
    ]);
  });

  it('adds the blob when the resource has no extensions at all', () => {
    expect(withExtensionJson({}, URL_A, [1, 2])).toEqual([{ url: URL_A, valueString: '[1,2]' }]);
  });
});
