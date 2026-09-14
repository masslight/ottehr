import { Practitioner } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { PHRASES_EXTENSION_URL } from '../types/constants';
import { applyPhraseChange, getPhrasesForPractitioner, Phrase } from './practitioners';

const practitionerWithPhrases = (raw: string): Practitioner => ({
  resourceType: 'Practitioner',
  extension: [
    { url: 'https://example.com/other-extension', valueString: 'untouched' },
    { url: PHRASES_EXTENSION_URL, valueString: raw },
  ],
});

describe('getPhrasesForPractitioner', () => {
  it('returns [] when there is no practitioner', () => {
    expect(getPhrasesForPractitioner(undefined)).toEqual([]);
  });

  it('returns [] when the practitioner has no phrases extension', () => {
    expect(getPhrasesForPractitioner({ resourceType: 'Practitioner' })).toEqual([]);
  });

  it('reads the phrases from the extension', () => {
    const phrases = [
      { key: '.hpi', value: 'History of present illness:' },
      { key: '.ros', value: 'Review of systems:' },
    ];
    expect(getPhrasesForPractitioner(practitionerWithPhrases(JSON.stringify(phrases)))).toEqual(phrases);
  });

  it('returns [] for malformed JSON without throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(getPhrasesForPractitioner(practitionerWithPhrases('{not json'))).toEqual([]);
    consoleError.mockRestore();
  });

  it('returns [] when the stored value is not an array', () => {
    expect(getPhrasesForPractitioner(practitionerWithPhrases('{"key":".hpi","value":"x"}'))).toEqual([]);
  });

  it('drops entries that are not well-formed phrases', () => {
    const raw = JSON.stringify([
      { key: '.hpi', value: 'kept' },
      { key: '', value: 'empty key' },
      { key: '.novalue' },
      { value: 'no key' },
      null,
      'a string',
    ]);
    expect(getPhrasesForPractitioner(practitionerWithPhrases(raw))).toEqual([{ key: '.hpi', value: 'kept' }]);
  });
});

describe('applyPhraseChange', () => {
  const hpi: Phrase = { key: '.hpi', value: 'History of present illness:' };
  const ros: Phrase = { key: '.ros', value: 'Review of systems:' };
  const existing: Phrase[] = [hpi, ros];

  const expectOk = (result: ReturnType<typeof applyPhraseChange>): Phrase[] => {
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
    return result.phrases;
  };

  it('appends a new phrase', () => {
    const added: Phrase = { key: '.plan', value: 'Plan:' };
    expect(expectOk(applyPhraseChange(existing, { type: 'upsert', phrase: added }))).toEqual([hpi, ros, added]);
  });

  it('does not mutate the phrases it is given', () => {
    applyPhraseChange(existing, { type: 'upsert', phrase: { key: '.plan', value: 'Plan:' } });
    expect(existing).toEqual([hpi, ros]);
  });

  it('overwrites in place when a new phrase collides with a key created elsewhere', () => {
    const added: Phrase = { key: '.ros', value: 'Mine wins' };
    expect(expectOk(applyPhraseChange(existing, { type: 'upsert', phrase: added }))).toEqual([hpi, added]);
  });

  it('replaces an edited phrase in its original position', () => {
    const edited: Phrase = { key: '.hpi', value: 'Updated text' };
    expect(expectOk(applyPhraseChange(existing, { type: 'upsert', phrase: edited, replacesKey: '.hpi' }))).toEqual([
      edited,
      ros,
    ]);
  });

  it('keeps the position when an edit also renames the key', () => {
    const renamed: Phrase = { key: '.history', value: 'Updated text' };
    expect(expectOk(applyPhraseChange(existing, { type: 'upsert', phrase: renamed, replacesKey: '.hpi' }))).toEqual([
      renamed,
      ros,
    ]);
  });

  it('reports "missing" when the edited phrase was deleted elsewhere', () => {
    const edit: Phrase = { key: '.gone', value: 'x' };
    expect(applyPhraseChange(existing, { type: 'upsert', phrase: edit, replacesKey: '.gone' })).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('reports "duplicate-key" when a rename collides with another phrase', () => {
    const renamed: Phrase = { key: '.ros', value: 'Updated text' };
    expect(applyPhraseChange(existing, { type: 'upsert', phrase: renamed, replacesKey: '.hpi' })).toEqual({
      ok: false,
      reason: 'duplicate-key',
    });
  });

  it('allows an edit that keeps its own key', () => {
    const edited: Phrase = { key: ' .HPI ', value: 'Updated text' };
    expect(expectOk(applyPhraseChange(existing, { type: 'upsert', phrase: edited, replacesKey: '.hpi' }))).toEqual([
      edited,
      ros,
    ]);
  });

  it('deletes by key', () => {
    expect(expectOk(applyPhraseChange(existing, { type: 'delete', key: '.hpi' }))).toEqual([ros]);
  });

  it('treats deleting an already-deleted phrase as a no-op', () => {
    expect(expectOk(applyPhraseChange(existing, { type: 'delete', key: '.gone' }))).toEqual(existing);
  });

  it('matches keys ignoring case and surrounding whitespace', () => {
    expect(expectOk(applyPhraseChange(existing, { type: 'delete', key: '  .HPI  ' }))).toEqual([ros]);
  });
});
