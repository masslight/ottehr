import { describe, expect, it } from 'vitest';
import { parseModelJson } from './model';
import { cleanModelText, ModelActionSchema, ModelSuggestionSchema, NarrativeModelResponseSchema } from './model-output';

describe('parseModelJson', () => {
  const answer = { actions: [{ kind: 'reply', text: 'Done.' }] };

  it('parses plain JSON', () => {
    expect(parseModelJson(JSON.stringify(answer))).toEqual(answer);
  });

  it('strips a markdown fence, with or without a language tag', () => {
    expect(parseModelJson('```json\n' + JSON.stringify(answer) + '\n```')).toEqual(answer);
    expect(parseModelJson('```\n' + JSON.stringify(answer) + '\n```')).toEqual(answer);
  });

  it('ignores prose around the object', () => {
    expect(parseModelJson(`Here is the plan:\n${JSON.stringify(answer)}\nLet me know!`)).toEqual(answer);
  });

  it('unwraps an object the model encoded as a JSON string', () => {
    expect(parseModelJson(JSON.stringify(JSON.stringify(answer)))).toEqual(answer);
  });

  it('tolerates a byte-order mark and surrounding whitespace', () => {
    expect(parseModelJson(`\uFEFF  ${JSON.stringify(answer)}  `)).toEqual(answer);
  });

  it('throws when there is no JSON at all', () => {
    expect(() => parseModelJson('I could not chart that.')).toThrow();
    expect(() => parseModelJson('"just a sentence"')).toThrow();
  });
});

describe('cleanModelText', () => {
  it('drops one pair of wrapping quotes and the padding', () => {
    expect(cleanModelText('  "Penicillin" ')).toBe('Penicillin');
    expect(cleanModelText("'J02.0'")).toBe('J02.0');
    expect(cleanModelText('“Amoxicillin”')).toBe('Amoxicillin');
  });

  it('keeps quotes that are part of the value', () => {
    expect(cleanModelText('"Rest" and "fluids"')).toBe('"Rest" and "fluids"');
    expect(cleanModelText('5\'8"')).toBe('5\'8"');
    expect(cleanModelText('"')).toBe('"');
  });
});

describe('ModelActionSchema', () => {
  it('normalizes the kind and the loosely typed fields', () => {
    const parsed = ModelActionSchema.parse({
      kind: ' Add-Diagnosis ',
      isPrimary: 'false',
      searchTerms: ['strep', 3, ' '],
      followUpInDays: 7,
    });
    expect(parsed).toMatchObject({
      kind: 'add-diagnosis',
      isPrimary: false,
      searchTerms: ['strep'],
      followUpInDays: '7',
    });
  });

  it('drops a value it cannot use rather than failing the action', () => {
    const parsed = ModelActionSchema.parse({ kind: 'add-allergy', display: { name: 'Penicillin' } });
    expect(parsed.display).toBeUndefined();
  });

  it('keeps undeclared fields for the guards to inspect', () => {
    expect(ModelActionSchema.parse({ kind: 'add-diagnosis', updates: [{ value: 'S01.81XA' }] })).toHaveProperty(
      'updates'
    );
  });

  it('refuses an item with no kind', () => {
    expect(ModelActionSchema.safeParse({ display: 'x' }).success).toBe(false);
    expect(ModelActionSchema.safeParse('add-diagnosis').success).toBe(false);
  });
});

describe('ModelSuggestionSchema', () => {
  it('refuses a card with an unknown category or no question', () => {
    expect(ModelSuggestionSchema.safeParse({ category: 'billing', question: 'q?', actions: [] }).success).toBe(false);
    expect(ModelSuggestionSchema.safeParse({ category: 'diagnosis', question: ' ', actions: [] }).success).toBe(false);
  });

  it('treats a missing actions list as empty', () => {
    expect(ModelSuggestionSchema.parse({ category: 'diagnosis', question: 'More specific code?' }).actions).toEqual([]);
  });
});

describe('NarrativeModelResponseSchema', () => {
  it('coerces missing or malformed sources to an empty list', () => {
    const parsed = NarrativeModelResponseSchema.parse({
      lines: [{ text: 'Sore throat for two days.' }, { text: 'No fever.', sourceTexts: ['no fever', 7] }],
    });
    expect(parsed.lines.map((line) => line.sourceTexts)).toEqual([[], ['no fever']]);
  });

  it('cleans each source and drops blank ones', () => {
    const parsed = NarrativeModelResponseSchema.parse({
      lines: [{ text: 'No fever.', sourceTexts: [' "no fever" ', '  '] }],
    });
    expect(parsed.lines[0].sourceTexts).toEqual(['no fever']);
  });

  it('fails the answer when a line has no text', () => {
    expect(NarrativeModelResponseSchema.safeParse({ lines: [{ sourceTexts: [] }] }).success).toBe(false);
  });
});
