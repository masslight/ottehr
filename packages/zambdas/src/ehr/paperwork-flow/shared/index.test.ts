import { Extension, Questionnaire } from 'fhir/r4b';
import {
  PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
} from 'utils/lib/fhir/constants';
import { ServiceMode } from 'utils/lib/types/common';
import { FlowForm, FlowService } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import {
  buildFlowQuestionnaire,
  getCanonicalUrlFromQ,
  getFlowModes,
  getFormCanonicals,
  getPatchOperationForExtensionUpsert,
  makeAdditionalFlowQuestionnairePatches,
  makeFlowModeExtensions,
  makeOttehrManagedServiceTags,
} from './index';

describe('getCanonicalUrlFromQ', () => {
  it('joins url and version with a pipe', () => {
    const q = { resourceType: 'Questionnaire', url: 'https://example.com/Q', version: '1.0.0' } as Questionnaire;
    expect(getCanonicalUrlFromQ(q)).toBe('https://example.com/Q|1.0.0');
  });

  it('returns undefined when url is missing', () => {
    const q = { resourceType: 'Questionnaire', version: '1.0.0' } as Questionnaire;
    expect(getCanonicalUrlFromQ(q)).toBeUndefined();
  });

  it('returns undefined when version is missing', () => {
    const q = { resourceType: 'Questionnaire', url: 'https://example.com/Q' } as Questionnaire;
    expect(getCanonicalUrlFromQ(q)).toBeUndefined();
  });
});

describe('makeFlowModeExtensions', () => {
  it('maps each service mode to a mode extension', () => {
    const result = makeFlowModeExtensions([ServiceMode['in-person'], ServiceMode.virtual]);
    expect(result).toEqual([
      { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'in-person' },
      { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'virtual' },
    ]);
  });

  it('returns an empty array for no modes', () => {
    expect(makeFlowModeExtensions([])).toEqual([]);
  });
});

describe('makeOttehrManagedServiceTags', () => {
  it('maps each service to a coding using its id and label', () => {
    const services: FlowService[] = [
      { id: 'svc-1', label: 'Service One', ottehrManagedService: true },
      { id: 'svc-2', label: 'Service Two', ottehrManagedService: false },
    ];

    expect(makeOttehrManagedServiceTags(services)).toEqual([
      { system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM, code: 'svc-1', display: 'Service One' },
      { system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM, code: 'svc-2', display: 'Service Two' },
    ]);
  });
});

describe('buildFlowQuestionnaire', () => {
  it('assembles a Questionnaire from the flow input', () => {
    const q = buildFlowQuestionnaire({
      slug: 'my-flow',
      version: '1.0.0',
      title: 'My Flow',
      serviceModes: [ServiceMode['in-person']],
      includedForms: ['https://example.com/FormB|1.0.0', 'https://example.com/FormA|1.0.0'],
      status: 'active',
      ottehrManagedServices: [{ id: 'svc-1', label: 'Service One', ottehrManagedService: true }],
    });

    expect(q).toEqual({
      resourceType: 'Questionnaire',
      url: 'https://ottehr.com/FHIR/Questionnaire/my-flow',
      version: '1.0.0',
      name: 'my-flow',
      title: 'My Flow',
      status: 'active',
      meta: {
        tag: [PAPERWORK_FLOW_TAG, { system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM, code: 'svc-1', display: 'Service One' }],
      },
      extension: [{ url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'in-person' }],
      derivedFrom: ['https://example.com/FormB|1.0.0', 'https://example.com/FormA|1.0.0'],
    });
  });

  it('preserves the order of includedForms in derivedFrom', () => {
    const forms = ['c|1', 'a|1', 'b|1'];
    const q = buildFlowQuestionnaire({
      slug: 'flow',
      version: '1.0.0',
      title: 'Flow',
      serviceModes: [],
      includedForms: forms,
      status: 'draft',
      ottehrManagedServices: [],
    });

    expect(q.derivedFrom).toEqual(forms);
  });
});

describe('getFormCanonicals', () => {
  it('resolves canonical urls in the order the flow forms were given', () => {
    const formQuestionnaires: Questionnaire[] = [
      { resourceType: 'Questionnaire', id: 'q-a', url: 'https://example.com/A', version: '1.0.0', status: 'active' },
      { resourceType: 'Questionnaire', id: 'q-b', url: 'https://example.com/B', version: '2.0.0', status: 'active' },
    ];
    const flowForms: FlowForm[] = [
      { id: 'q-b', url: 'https://example.com/B', label: 'B' },
      { id: 'q-a', url: 'https://example.com/A', label: 'A' },
    ];

    expect(getFormCanonicals(formQuestionnaires, flowForms)).toEqual([
      'https://example.com/B|2.0.0',
      'https://example.com/A|1.0.0',
    ]);
  });

  it('throws error when unable to resolve form form to found questionnaires', () => {
    const formQuestionnaires: Questionnaire[] = [
      { resourceType: 'Questionnaire', id: 'q-a', url: 'https://example.com/A', version: '1.0.0', status: 'active' },
    ];
    const flowForms: FlowForm[] = [
      { id: 'q-b', url: 'https://example.com/B', label: 'B' },
      { id: 'q-a', url: 'https://example.com/A', label: 'A' },
    ];

    expect(() => getFormCanonicals(formQuestionnaires, flowForms)).toThrow();
  });

  it('throws an error when we are unable to parse a full canonical url from a questionnaire', () => {
    const formQuestionnaires: Questionnaire[] = [
      { resourceType: 'Questionnaire', id: 'q-a', url: 'https://example.com/A', status: 'active' },
    ];
    const flowForms: FlowForm[] = [{ id: 'q-a', url: 'https://example.com/A', label: 'A' }];

    expect(() => getFormCanonicals(formQuestionnaires, flowForms)).toThrow();
  });
});

describe('getPatchOperationForExtensionUpsert', () => {
  const newExtension: Extension = { url: 'https://example.com/ext', valueString: 'new' };

  it('adds a new extension array when the resource has none', () => {
    const op = getPatchOperationForExtensionUpsert({}, newExtension);
    expect(op).toEqual({ op: 'add', path: '/extension', value: [newExtension] });
  });

  it('appends the extension when the url is not already present', () => {
    const existing: Extension = { url: 'https://example.com/other', valueString: 'other' };
    const op = getPatchOperationForExtensionUpsert({ extension: [existing] }, newExtension);
    expect(op).toEqual({ op: 'add', path: '/extension', value: [existing, newExtension] });
  });

  it('returns undefined when an identical extension already exists at that url', () => {
    const resource = { extension: [{ ...newExtension }] };
    const op = getPatchOperationForExtensionUpsert(resource, newExtension);
    expect(op).toBeUndefined();
  });

  it('replaces the extension in place when the url matches but the value differs', () => {
    const existing: Extension = { url: newExtension.url, valueString: 'old' };
    const other: Extension = { url: 'https://example.com/other', valueString: 'other' };
    const resource = { extension: [other, existing] };

    const op = getPatchOperationForExtensionUpsert(resource, newExtension);

    expect(op).toEqual({ op: 'replace', path: '/extension', value: [other, newExtension] });
  });

  it('does not mutate the resource passed in', () => {
    const existing: Extension = { url: newExtension.url, valueString: 'old' };
    const resource = { extension: [existing] };

    getPatchOperationForExtensionUpsert(resource, newExtension);

    expect(resource.extension).toEqual([existing]);
  });
});

describe('getFlowModes', () => {
  it('extracts modes from paperwork-flow-mode extensions', () => {
    const q = {
      resourceType: 'Questionnaire',
      extension: [
        { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'virtual' },
        { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'in-person' },
      ],
    } as Questionnaire;

    expect(getFlowModes(q)).toEqual([ServiceMode['in-person'], ServiceMode.virtual]);
  });

  it('ignores extensions with other urls or non-mode values', () => {
    const q = {
      resourceType: 'Questionnaire',
      extension: [
        { url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCode: 'in-person' },
        { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'not-a-real-mode' },
      ],
    } as unknown as Questionnaire;

    expect(getFlowModes(q)).toEqual([]);
  });

  it('returns an empty array when there are no extensions', () => {
    const q = { resourceType: 'Questionnaire' } as Questionnaire;
    expect(getFlowModes(q)).toEqual([]);
  });

  it('deduplicates repeated mode extensions', () => {
    const q = {
      resourceType: 'Questionnaire',
      extension: [
        { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'virtual' },
        { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'virtual' },
      ],
    } as Questionnaire;

    expect(getFlowModes(q)).toEqual([ServiceMode.virtual]);
  });
});

describe('makeAdditionalFlowQuestionnairePatches', () => {
  const inPersonModeExtension = { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'in-person' };
  const virtualModeExtension = { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: 'virtual' };
  const urgentCareTag = { system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM, code: 'urgent-care', display: 'Urgent Care' };
  const otherServiceTag = { system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM, code: 'other-service', display: 'Other' };
  const urgentCare: FlowService = { id: 'urgent-care', label: 'Urgent Care', ottehrManagedService: true };

  it('returns no patches when the flow includes no ottehr managed services', () => {
    const otherFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'other-flow',
      status: 'active',
      extension: [inPersonModeExtension],
      meta: { tag: [PAPERWORK_FLOW_TAG, urgentCareTag] },
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [],
      flowQuestionnaires: [otherFlow],
    });

    expect(patches).toEqual([]);
  });

  it('strips the tag from another active flow that shares a mode and already claims the service', () => {
    const otherFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'other-flow',
      status: 'active',
      meta: { tag: [PAPERWORK_FLOW_TAG, urgentCareTag], versionId: '1' },
      extension: [inPersonModeExtension],
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [urgentCare],
      flowQuestionnaires: [otherFlow],
    });

    expect(patches).toEqual([
      {
        method: 'PATCH',
        url: 'Questionnaire/other-flow',
        operations: [{ op: 'replace', path: '/meta/tag', value: [PAPERWORK_FLOW_TAG] }],
        ifMatch: 'W/"1"',
      },
    ]);
  });

  it('leaves other flows untouched when they do not share a visit mode', () => {
    const otherFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'other-flow',
      status: 'active',
      meta: { tag: [PAPERWORK_FLOW_TAG, urgentCareTag] },
      extension: [virtualModeExtension],
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [urgentCare],
      flowQuestionnaires: [otherFlow],
    });

    expect(patches).toEqual([]);
  });

  it('leaves tags for other services untouched even when the flow shares a mode', () => {
    const otherFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'other-flow',
      status: 'active',
      meta: { tag: [PAPERWORK_FLOW_TAG, otherServiceTag] },
      extension: [inPersonModeExtension],
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [urgentCare],
      flowQuestionnaires: [otherFlow],
    });

    expect(patches).toEqual([]);
  });

  it('excludes the flow being saved when targetFlowId matches', () => {
    const targetFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'target-flow',
      status: 'active',
      meta: { tag: [PAPERWORK_FLOW_TAG, urgentCareTag] },
      extension: [inPersonModeExtension],
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [urgentCare],
      flowQuestionnaires: [targetFlow],
      targetFlowId: 'target-flow',
    });

    expect(patches).toEqual([]);
  });

  it('does not exclude any flow when targetFlowId is omitted (create flow)', () => {
    const otherFlow: Questionnaire = {
      resourceType: 'Questionnaire',
      id: 'other-flow',
      status: 'active',
      meta: { tag: [PAPERWORK_FLOW_TAG, urgentCareTag] },
      extension: [inPersonModeExtension],
    };

    const patches = makeAdditionalFlowQuestionnairePatches({
      modes: [ServiceMode['in-person']],
      ottehrManagedServices: [urgentCare],
      flowQuestionnaires: [otherFlow],
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].url).toBe('Questionnaire/other-flow');
  });
});

// A flow stores all of its forms in one QuestionnaireResponse, so a custom (practice-managed) form must not share a
// page or question id with another form in the flow. Ottehr-managed forms may (the consent page).
describe('getFormCanonicals linkId conflicts', () => {
  const form = (
    name: string,
    item: Questionnaire['item'],
    { custom = true }: { custom?: boolean } = {}
  ): { questionnaire: Questionnaire; flowForm: FlowForm } => ({
    questionnaire: {
      resourceType: 'Questionnaire',
      id: `q-${name}`,
      url: `https://example.com/${name}`,
      version: '1.0.0',
      status: 'active',
      ...(custom && { meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] } }),
      item,
    },
    flowForm: { id: `q-${name}`, url: `https://example.com/${name}`, label: name },
  });

  const canonicalsFor = (...forms: ReturnType<typeof form>[]): string[] =>
    getFormCanonicals(
      forms.map((f) => f.questionnaire),
      forms.map((f) => f.flowForm)
    );

  const thrownMessage = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      return (error as { message?: string }).message ?? String(error);
    }
    throw new Error('expected an error');
  };

  const cage = (): ReturnType<typeof form> =>
    form('CAGE', [
      { linkId: 'items', type: 'group', item: [{ linkId: 'q1', type: 'string' }] },
      { linkId: 'results', type: 'group', item: [{ linkId: 'total', type: 'string' }] },
    ]);

  it('rejects two custom forms that share a page id, naming both forms and the id', () => {
    const other = form('PHQ-9', [{ linkId: 'items', type: 'group', item: [{ linkId: 'p1', type: 'string' }] }]);

    const message = thrownMessage(() => canonicalsFor(cage(), other));
    expect(message).toContain('"CAGE" and "PHQ-9" both use the page id "items".');
    expect(message).toContain('prefix them with the form');
  });

  it('rejects two custom forms that share a question id nested inside different pages', () => {
    const other = form('PHQ-9', [{ linkId: 'phq-page', type: 'group', item: [{ linkId: 'q1', type: 'string' }] }]);

    expect(thrownMessage(() => canonicalsFor(cage(), other))).toContain(
      '"CAGE" and "PHQ-9" both use the question id "q1".'
    );
  });

  it('rejects a custom form that shares an id with an ottehr-managed form', () => {
    const intake = form('intake', [{ linkId: 'items', type: 'group' }], { custom: false });

    expect(thrownMessage(() => canonicalsFor(intake, cage()))).toContain(
      '"intake" and "CAGE" both use the page id "items".'
    );
  });

  it('names every form when more than two share an id', () => {
    const a = form('A', [{ linkId: 'shared', type: 'group' }]);
    const b = form('B', [{ linkId: 'shared', type: 'group' }]);
    const c = form('C', [{ linkId: 'shared', type: 'group' }]);

    expect(thrownMessage(() => canonicalsFor(a, b, c))).toContain('"A", "B" and "C" all use the page id "shared".');
  });

  it('rejects the same custom form added twice, once, instead of listing every id', () => {
    const message = thrownMessage(() => canonicalsFor(cage(), cage()));
    expect(message).toContain('"CAGE" is in this flow more than once.');
    expect(message).not.toContain('both use');
  });

  it('lists at most five conflicts and counts the rest', () => {
    const many = (prefix: string): Questionnaire['item'] =>
      Array.from({ length: 7 }, (_, i) => ({ linkId: `shared-${i}`, type: 'string' as const, text: prefix }));
    const message = thrownMessage(() => canonicalsFor(form('A', many('a')), form('B', many('b'))));

    expect(message.match(/both use/g)).toHaveLength(5);
    expect(message).toContain('And 2 more.');
  });

  it('lets ottehr-managed forms share a page, which is how the consent page ends up last', () => {
    const intake = form('intake', [{ linkId: 'consent-forms-page', type: 'group' }], { custom: false });
    const consentOnly = form('consent-only', [{ linkId: 'consent-forms-page', type: 'group' }], { custom: false });

    expect(canonicalsFor(intake, consentOnly)).toEqual([
      'https://example.com/intake|1.0.0',
      'https://example.com/consent-only|1.0.0',
    ]);
  });

  it('allows custom forms that share nothing, alongside an ottehr-managed form', () => {
    const phq = form('PHQ-9', [{ linkId: 'phq-items', type: 'group', item: [{ linkId: 'phq-q1', type: 'string' }] }]);
    const intake = form('intake', [{ linkId: 'consent-forms-page', type: 'group' }], { custom: false });

    expect(canonicalsFor(cage(), phq, intake)).toHaveLength(3);
  });

  it('is the error the flows admin shows, with the flow error code', () => {
    const other = form('PHQ-9', [{ linkId: 'items', type: 'group' }]);
    let thrown: unknown;
    try {
      canonicalsFor(cage(), other);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      code: APIErrorCode.PAPERWORK_FLOW_GENERAL,
      message: expect.stringContaining('"items"'),
    });
  });
});
