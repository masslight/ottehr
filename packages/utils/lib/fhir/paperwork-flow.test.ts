import { List } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { BASE_PAPERWORK_FLOWS, baseFlowForCanonical } from './base-paperwork-flows';
import { PAPERWORK_FLOW_BASE_EXTENSION_URL, PAPERWORK_FLOW_IDENTIFIER_SYSTEM, PAPERWORK_FLOW_TAG } from './constants';
import {
  composeFormIds,
  getPaperworkFlowBase,
  getPaperworkFlowCanonical,
  getPaperworkFlowFormIds,
  isBaseFlow,
  isPaperworkFlowList,
  PaperworkFlow,
  paperworkFlowToFhirList,
  toPaperworkFlowRecord,
} from './paperwork-flow';

const flowList = (overrides: Partial<List> = {}): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  title: 'Massage intake',
  meta: { tag: [PAPERWORK_FLOW_TAG] },
  identifier: [{ system: PAPERWORK_FLOW_IDENTIFIER_SYSTEM, value: 'massage-intake' }],
  extension: [{ url: PAPERWORK_FLOW_BASE_EXTENSION_URL, valueCode: 'consent-only' }],
  entry: [{ item: { reference: 'Questionnaire/q-1' } }, { item: { reference: 'Questionnaire/q-2' } }],
  ...overrides,
});

describe('isPaperworkFlowList', () => {
  it('recognizes a flow-tagged List', () => {
    expect(isPaperworkFlowList(flowList())).toBe(true);
  });

  it('rejects a List without the flow tag', () => {
    expect(isPaperworkFlowList(flowList({ meta: { tag: [] } }))).toBe(false);
    expect(isPaperworkFlowList(flowList({ meta: undefined }))).toBe(false);
  });
});

describe('getPaperworkFlowBase', () => {
  it('reads the configured base', () => {
    expect(getPaperworkFlowBase(flowList())).toBe('consent-only');
  });

  it('defaults to standard when the extension is missing or invalid', () => {
    expect(getPaperworkFlowBase(flowList({ extension: [] }))).toBe('standard');
    expect(
      getPaperworkFlowBase(flowList({ extension: [{ url: PAPERWORK_FLOW_BASE_EXTENSION_URL, valueCode: 'bogus' }] }))
    ).toBe('standard');
  });
});

describe('getPaperworkFlowFormIds', () => {
  it('extracts ordered Questionnaire ids and ignores non-Questionnaire entries', () => {
    const list = flowList({
      entry: [
        { item: { reference: 'Questionnaire/q-1' } },
        { item: { reference: 'Patient/p-1' } },
        { item: { reference: 'Questionnaire/q-2' } },
      ],
    });
    expect(getPaperworkFlowFormIds(list)).toEqual(['q-1', 'q-2']);
  });

  it('returns an empty array when there are no entries', () => {
    expect(getPaperworkFlowFormIds(flowList({ entry: undefined }))).toEqual([]);
  });
});

describe('toPaperworkFlowRecord', () => {
  it('parses a complete flow List', () => {
    expect(toPaperworkFlowRecord(flowList({ id: 'list-1' }))).toEqual({
      id: 'list-1',
      slug: 'massage-intake',
      name: 'Massage intake',
      base: 'consent-only',
      formIds: ['q-1', 'q-2'],
    });
  });

  it('falls back to the slug for the name when title is absent', () => {
    expect(toPaperworkFlowRecord(flowList({ title: undefined }))?.name).toBe('massage-intake');
  });

  it('returns null when the List is not a flow', () => {
    expect(toPaperworkFlowRecord(flowList({ meta: { tag: [] } }))).toBeNull();
  });

  it('returns null when the flow has no slug identifier', () => {
    expect(toPaperworkFlowRecord(flowList({ identifier: [] }))).toBeNull();
  });
});

describe('paperworkFlowToFhirList round-trip', () => {
  it('serializes a record and parses back to the same logical values', () => {
    const record: PaperworkFlow = {
      id: 'list-9',
      slug: 'facial-intake',
      name: 'Facial intake',
      base: 'standard',
      formIds: ['form-a', 'form-b', 'form-c'],
    };
    const list = paperworkFlowToFhirList(record);
    expect(isPaperworkFlowList(list)).toBe(true);
    expect(toPaperworkFlowRecord(list)).toEqual(record);
  });

  it('omits the id for unsaved records', () => {
    const list = paperworkFlowToFhirList({ slug: 's', name: 'n', base: 'standard', formIds: [] });
    expect(list.id).toBeUndefined();
  });
});

describe('base flows (canonical-bound)', () => {
  const inPerson = BASE_PAPERWORK_FLOWS[0];

  it('round-trips a base flow with its canonical and is recognized by isBaseFlow', () => {
    const record: PaperworkFlow = {
      id: 'base-1',
      slug: inPerson.slug,
      name: inPerson.title,
      base: inPerson.base,
      formIds: ['f1', 'f2'],
      canonical: inPerson.canonical,
    };
    const list = paperworkFlowToFhirList(record);
    expect(isBaseFlow(list)).toBe(true);
    expect(getPaperworkFlowCanonical(list)).toBe(inPerson.canonical);
    expect(toPaperworkFlowRecord(list)).toEqual(record);
  });

  it('treats a flow without a canonical as a service flow', () => {
    const list = paperworkFlowToFhirList({ slug: 's', name: 'n', base: 'consent-only', formIds: [] });
    expect(isBaseFlow(list)).toBe(false);
    expect(getPaperworkFlowCanonical(list)).toBeUndefined();
  });

  it('catalogs exactly three base flows, one per base intake, with distinct canonicals', () => {
    expect(BASE_PAPERWORK_FLOWS).toHaveLength(3);
    expect(new Set(BASE_PAPERWORK_FLOWS.map((b) => b.canonical)).size).toBe(3);
    expect(BASE_PAPERWORK_FLOWS.map((b) => b.base)).toEqual(['standard', 'standard', 'consent-only']);
  });

  it('baseFlowForCanonical maps a canonical to its descriptor, else undefined', () => {
    for (const b of BASE_PAPERWORK_FLOWS) {
      expect(baseFlowForCanonical(b.canonical)).toEqual(b);
    }
    expect(baseFlowForCanonical('https://example.com/not-a-base')).toBeUndefined();
    expect(baseFlowForCanonical(undefined)).toBeUndefined();
  });
});

describe('composeFormIds (base + service compose)', () => {
  it('puts base forms first, then service forms', () => {
    expect(composeFormIds(['b1', 'b2'], ['s1', 's2'])).toEqual(['b1', 'b2', 's1', 's2']);
  });

  it('de-dupes keep-first — a form in both keeps its base position', () => {
    expect(composeFormIds(['hipaa', 'b2'], ['s1', 'hipaa', 's2'])).toEqual(['hipaa', 'b2', 's1', 's2']);
  });

  it('handles empty base (service-only) and empty service (base-only)', () => {
    expect(composeFormIds([], ['s1', 's2'])).toEqual(['s1', 's2']);
    expect(composeFormIds(['b1'], [])).toEqual(['b1']);
    expect(composeFormIds([], [])).toEqual([]);
  });

  it('de-dupes repeats within a single list too', () => {
    expect(composeFormIds(['b1', 'b1'], ['b1'])).toEqual(['b1']);
  });
});
