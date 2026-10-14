import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { EASY_CHART_NARRATIVE_EXTENSION_URL, narrativeExtension, storedNarrativeOf } from './narrative';

const docWith = (valueString: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  status: 'current',
  content: [],
  extension: [{ url: EASY_CHART_NARRATIVE_EXTENSION_URL, valueString }],
});

describe('storedNarrativeOf', () => {
  it('reads back what narrativeExtension stored', () => {
    const lines = [
      { text: 'Sore throat for two days.', sources: ['sore throat for two days'] },
      { text: 'No fever.', sources: [], approximateSource: 'no fevers' },
    ];
    const doc: DocumentReference = { ...docWith(''), extension: [narrativeExtension(lines)] };
    expect(storedNarrativeOf(doc)).toEqual(lines);
  });

  it('is undefined when the extension is missing, not JSON, or another version', () => {
    expect(storedNarrativeOf({ resourceType: 'DocumentReference', status: 'current', content: [] })).toBeUndefined();
    expect(storedNarrativeOf(docWith('not json'))).toBeUndefined();
    expect(storedNarrativeOf(docWith(JSON.stringify({ version: 2, lines: [] })))).toBeUndefined();
  });

  it('drops a blank or malformed line and keeps the rest', () => {
    const valueString = JSON.stringify({
      version: 1,
      generatedAt: '2026-09-28T00:00:00.000Z',
      lines: [{ text: ' ', sources: [] }, { text: 'No cough.' }, 'stray', { text: 'No rash.', sources: [] }],
    });
    expect(storedNarrativeOf(docWith(valueString))).toEqual([{ text: 'No rash.', sources: [] }]);
  });
});
