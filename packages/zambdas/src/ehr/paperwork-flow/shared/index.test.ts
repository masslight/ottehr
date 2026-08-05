import { Extension, Questionnaire } from 'fhir/r4b';
import {
  FlowForm,
  FlowService,
  PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  ServiceMode,
  SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
} from 'utils';
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
      { id: 'q-b', label: 'B' },
      { id: 'q-a', label: 'A' },
    ];

    expect(getFormCanonicals(formQuestionnaires, flowForms)).toEqual([
      'https://example.com/B|2.0.0',
      'https://example.com/A|1.0.0',
    ]);
  });

  it('skips flow forms with no matching questionnaire', () => {
    const formQuestionnaires: Questionnaire[] = [
      { resourceType: 'Questionnaire', id: 'q-a', url: 'https://example.com/A', version: '1.0.0', status: 'active' },
    ];
    const flowForms: FlowForm[] = [
      { id: 'missing', label: 'Missing' },
      { id: 'q-a', label: 'A' },
    ];

    expect(getFormCanonicals(formQuestionnaires, flowForms)).toEqual(['https://example.com/A|1.0.0']);
  });

  it('skips a matched questionnaire that has no resolvable canonical url', () => {
    const formQuestionnaires: Questionnaire[] = [
      { resourceType: 'Questionnaire', id: 'q-a', version: '1.0.0', status: 'active' },
    ];
    const flowForms: FlowForm[] = [{ id: 'q-a', label: 'A' }];

    expect(getFormCanonicals(formQuestionnaires, flowForms)).toEqual([]);
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
