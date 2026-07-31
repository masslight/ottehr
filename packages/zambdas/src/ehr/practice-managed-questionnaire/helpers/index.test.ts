import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { PAPERWORK_FLOW_INPERSON_EXTENSION_URL, PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL } from 'utils';
import { describe, expect, it } from 'vitest';
import { PAPERWORK_FLOW_BASE_VERSION } from '../../paperwork-flow/shared';
import {
  bumpFlowFormVersionRequests,
  bumpServiceExtensionCanonical,
  evaluateFlowsForUrl,
  FhirQuestionnaireSubset,
  isLatestVersion,
  makeServicePatchesForFlowCanonicalBumps,
  patchQuestionnaireVersion,
} from './index';

const questionnaire = (overrides: Partial<FhirQuestionnaireSubset> = {}): FhirQuestionnaireSubset => ({
  id: 'q-1',
  title: 'Test Form',
  status: 'active',
  url: 'https://ottehr.com/FHIR/Questionnaire/test-form',
  version: '1.0.0',
  ...overrides,
});

describe('isLatestVersion', () => {
  it('returns true when candidate has a higher major version', () => {
    const candidate = questionnaire({ version: '2.0.0' });
    const current = questionnaire({ version: '1.9.9' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns true when candidate has a higher minor version', () => {
    const candidate = questionnaire({ version: '1.2.0' });
    const current = questionnaire({ version: '1.1.9' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns true when candidate has a higher patch version', () => {
    const candidate = questionnaire({ version: '1.0.2' });
    const current = questionnaire({ version: '1.0.1' });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns false when candidate has a lower version', () => {
    const candidate = questionnaire({ version: '1.0.0' });
    const current = questionnaire({ version: '1.0.1' });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });

  it('falls back to lastUpdated when versions are equal', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('returns false when versions are equal and candidate lastUpdated is older', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });

  it('returns true when versions and lastUpdated are both equal', () => {
    const candidate = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('defaults missing versions to the base version so equal defaults compare by lastUpdated', () => {
    const candidate = questionnaire({
      version: undefined,
      meta: { lastUpdated: '2024-01-02T00:00:00.000Z' },
    });
    const current = questionnaire({
      version: undefined,
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(true);
  });

  it('treats a missing lastUpdated as an invalid date, comparing as less than any real date', () => {
    const candidate = questionnaire({ version: '1.0.0', meta: undefined });
    const current = questionnaire({
      version: '1.0.0',
      meta: { lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    expect(isLatestVersion(candidate, current)).toBe(false);
  });
});

describe('patchQuestionnaireVersion', () => {
  it('increments the patch segment', () => {
    expect(patchQuestionnaireVersion('1.2.3')).toBe('1.2.4');
  });

  it('increments from zero', () => {
    expect(patchQuestionnaireVersion('1.0.0')).toBe('1.0.1');
  });

  it('leaves major and minor segments unchanged', () => {
    expect(patchQuestionnaireVersion('3.4.9')).toBe('3.4.10');
  });
});

describe('bumpFlowFormVersionRequests', () => {
  const url = 'https://ottehr.com/FHIR/Questionnaire/target-form';
  const previousVersion = '1.0.0';
  const nextVersion = '1.0.1';

  const flowQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire =>
    ({
      resourceType: 'Questionnaire',
      status: 'active',
      url: 'https://ottehr.com/FHIR/Questionnaire/some-flow',
      name: 'some-flow',
      title: 'Some Flow',
      version: '1.0.0',
      meta: { tag: [{ system: 'https://ottehr.com/paperwork-flow', code: 'paperwork-flow' }] },
      ...overrides,
    }) as Questionnaire;

  it('returns no requests when no flow derives from the target form', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', derivedFrom: ['https://ottehr.com/FHIR/Questionnaire/other-form|1.0.0'] }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result).toEqual([]);
  });

  it('returns no requests when flowQuestionnaires is empty', () => {
    const result = bumpFlowFormVersionRequests({
      previousVersion,
      nextVersion,
      url,
      flowQuestionnaires: [],
      services: [],
    });

    expect(result).toEqual([]);
  });

  it('retires the matching flow and creates a new version with derivedFrom and version bumped', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({
        id: 'flow-1',
        version: '2.3.0',
        derivedFrom: ['https://ottehr.com/FHIR/Questionnaire/other-form|2.0.0', `${url}|${previousVersion}`],
      }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result).toEqual([
      {
        method: 'PATCH',
        url: 'Questionnaire/flow-1',
        operations: [{ op: 'replace', path: '/status', value: 'retired' }],
      },
      {
        method: 'POST',
        url: '/Questionnaire',
        resource: {
          resourceType: 'Questionnaire',
          status: 'active',
          url: 'https://ottehr.com/FHIR/Questionnaire/some-flow',
          name: 'some-flow',
          title: 'Some Flow',
          version: '2.3.1',
          meta: { tag: [{ system: 'https://ottehr.com/paperwork-flow', code: 'paperwork-flow' }] },
          derivedFrom: ['https://ottehr.com/FHIR/Questionnaire/other-form|2.0.0', `${url}|${nextVersion}`],
        },
      },
    ]);
  });

  it('falls back to the paperwork flow base version when the flow has no version', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', version: undefined, derivedFrom: [`${url}|${previousVersion}`] }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result[1]).toMatchObject({
      resource: { version: PAPERWORK_FLOW_BASE_VERSION },
    });
  });

  it('returns a retire+create pair per matching flow when multiple flows derive from the target form', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', derivedFrom: [`${url}|${previousVersion}`] }),
      flowQuestionnaire({ id: 'flow-2', derivedFrom: [`${url}|${previousVersion}`] }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ method: 'PATCH', url: 'Questionnaire/flow-1' });
    expect(result[1]).toMatchObject({ method: 'POST', url: '/Questionnaire' });
    expect(result[2]).toMatchObject({ method: 'PATCH', url: 'Questionnaire/flow-2' });
    expect(result[3]).toMatchObject({ method: 'POST', url: '/Questionnaire' });
  });

  it('ignores flows whose derivedFrom references a different version of the target form', () => {
    const flowQuestionnaires = [flowQuestionnaire({ id: 'flow-1', derivedFrom: [`${url}|9.9.9`] })];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result).toEqual([]);
  });

  it('does not throw when a flow has no derivedFrom', () => {
    const flowQuestionnaires = [flowQuestionnaire({ id: 'flow-1', derivedFrom: undefined })];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });

    expect(result).toEqual([]);
  });

  it('does not carry the previous flow id or lastUpdated onto the newly created flow', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({
        id: 'flow-1',
        derivedFrom: [`${url}|${previousVersion}`],
        meta: {
          lastUpdated: '2024-01-01T00:00:00.000Z',
          tag: [{ system: 'https://ottehr.com/paperwork-flow', code: 'paperwork-flow' }],
        },
      }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services: [] });
    const createPost = result[1] as { resource: Questionnaire };

    expect(createPost.resource.id).toBeUndefined();
    expect(createPost.resource.meta).toEqual({
      tag: [{ system: 'https://ottehr.com/paperwork-flow', code: 'paperwork-flow' }],
    });
  });

  const healthcareService = (overrides: Partial<HealthcareService> = {}): HealthcareService =>
    ({
      resourceType: 'HealthcareService',
      id: 'hs-1',
      active: true,
      ...overrides,
    }) as HealthcareService;

  it('re-points a service extension from the previous flow canonical to the next one', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', version: '2.3.0', derivedFrom: [`${url}|${previousVersion}`] }),
    ];
    const services = [
      healthcareService({
        extension: [
          {
            url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
            valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/some-flow|2.3.0',
          },
        ],
      }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services });

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      method: 'PATCH',
      url: 'HealthcareService/hs-1',
      operations: [
        {
          op: 'replace',
          path: '/extension',
          value: [
            {
              url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
              valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/some-flow|2.3.1',
            },
          ],
        },
      ],
    });
  });

  it('applies both bumps in a single patch when one service is bound to two flows derived from the same form', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({
        id: 'flow-1',
        url: 'https://ottehr.com/FHIR/Questionnaire/flow-a',
        version: '2.3.0',
        derivedFrom: [`${url}|${previousVersion}`],
      }),
      flowQuestionnaire({
        id: 'flow-2',
        url: 'https://ottehr.com/FHIR/Questionnaire/flow-b',
        version: '1.5.0',
        derivedFrom: [`${url}|${previousVersion}`],
      }),
    ];
    const services = [
      healthcareService({
        extension: [
          {
            url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
            valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/flow-a|2.3.0',
          },
          {
            url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL,
            valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/flow-b|1.5.0',
          },
        ],
      }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services });

    expect(result).toHaveLength(5);
    const servicePatch = result[4] as { operations: { value: Extension[] }[] };
    expect(servicePatch).toEqual({
      method: 'PATCH',
      url: 'HealthcareService/hs-1',
      operations: [
        {
          op: 'replace',
          path: '/extension',
          value: [
            {
              url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
              valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/flow-a|2.3.1',
            },
            {
              url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL,
              valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/flow-b|1.5.1',
            },
          ],
        },
      ],
    });
  });

  it('leaves a service extension untouched when it points at an unrelated flow canonical', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', version: '2.3.0', derivedFrom: [`${url}|${previousVersion}`] }),
    ];
    const services = [
      healthcareService({
        extension: [
          {
            url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
            valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/other-flow|1.0.0',
          },
        ],
      }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services });

    expect(result).toHaveLength(2);
  });

  it('does not patch a service when the target flow does not match any of its extensions', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', derivedFrom: ['https://ottehr.com/FHIR/Questionnaire/other-form|1.0.0'] }),
    ];
    const services = [healthcareService()];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires, services });

    expect(result).toEqual([]);
  });
});

describe('bumpServiceExtensionCanonical', () => {
  const previousCanonical = 'https://ottehr.com/FHIR/Questionnaire/some-flow|1.0.0';
  const nextCanonical = 'https://ottehr.com/FHIR/Questionnaire/some-flow|1.0.1';

  it('bumps the valueCanonical of a matching in-person flow extension', () => {
    const extensions: Extension[] = [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical }];

    const result = bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(result).toEqual([{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: nextCanonical }]);
  });

  it('bumps the valueCanonical of a matching virtual flow extension', () => {
    const extensions: Extension[] = [{ url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL, valueCanonical: previousCanonical }];

    const result = bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(result).toEqual([{ url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL, valueCanonical: nextCanonical }]);
  });

  it('bumps only the extension whose valueCanonical matches, leaving the other mode untouched', () => {
    const otherCanonical = 'https://ottehr.com/FHIR/Questionnaire/other-flow|3.0.0';
    const extensions: Extension[] = [
      { url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical },
      { url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL, valueCanonical: otherCanonical },
    ];

    const result = bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(result).toEqual([
      { url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: nextCanonical },
      { url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL, valueCanonical: otherCanonical },
    ]);
  });

  it('leaves an extension with a non-flow url untouched even if its valueCanonical matches', () => {
    const extensions: Extension[] = [
      { url: 'https://ottehr.com/FHIR/Extension/unrelated', valueCanonical: previousCanonical },
    ];

    const result = bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(result).toEqual(extensions);
  });

  it('leaves a flow extension untouched when its valueCanonical does not match the previous canonical', () => {
    const extensions: Extension[] = [
      {
        url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
        valueCanonical: 'https://ottehr.com/FHIR/Questionnaire/some-flow|9.9.9',
      },
    ];

    const result = bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(result).toEqual(extensions);
  });

  it('returns an empty array when given no extensions', () => {
    expect(bumpServiceExtensionCanonical([], previousCanonical, nextCanonical)).toEqual([]);
  });

  it('does not mutate the input extensions array', () => {
    const extensions: Extension[] = [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical }];
    const original = JSON.parse(JSON.stringify(extensions));

    bumpServiceExtensionCanonical(extensions, previousCanonical, nextCanonical);

    expect(extensions).toEqual(original);
  });
});

describe('makeServicePatchesForFlowCanonicalBumps (single bump)', () => {
  const previousCanonical = 'https://ottehr.com/FHIR/Questionnaire/some-flow|1.0.0';
  const nextCanonical = 'https://ottehr.com/FHIR/Questionnaire/some-flow|1.0.1';

  const healthcareService = (overrides: Partial<HealthcareService> = {}): HealthcareService =>
    ({
      resourceType: 'HealthcareService',
      id: 'hs-1',
      active: true,
      ...overrides,
    }) as HealthcareService;

  it('returns a PATCH request replacing extension for a service with a matching extension', () => {
    const services = [
      healthcareService({
        extension: [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical }],
      }),
    ];

    const result = makeServicePatchesForFlowCanonicalBumps(services, [{ previousCanonical, nextCanonical }]);

    expect(result).toEqual([
      {
        method: 'PATCH',
        url: 'HealthcareService/hs-1',
        operations: [
          {
            op: 'replace',
            path: '/extension',
            value: [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: nextCanonical }],
          },
        ],
      },
    ]);
  });

  it('returns no requests when no service has a matching extension', () => {
    const services = [healthcareService({ extension: [] }), healthcareService({ id: 'hs-2' })];

    const result = makeServicePatchesForFlowCanonicalBumps(services, [{ previousCanonical, nextCanonical }]);

    expect(result).toEqual([]);
  });

  it('returns no requests when given an empty services array', () => {
    expect(makeServicePatchesForFlowCanonicalBumps([], [{ previousCanonical, nextCanonical }])).toEqual([]);
  });

  it('skips a service that has no id', () => {
    const services = [
      healthcareService({
        id: undefined,
        extension: [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical }],
      }),
    ];

    const result = makeServicePatchesForFlowCanonicalBumps(services, [{ previousCanonical, nextCanonical }]);

    expect(result).toEqual([]);
  });

  it('returns one PATCH per matching service, skipping non-matching ones, preserving order', () => {
    const services = [
      healthcareService({
        id: 'hs-1',
        extension: [{ url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL, valueCanonical: previousCanonical }],
      }),
      healthcareService({ id: 'hs-2', extension: [] }),
      healthcareService({
        id: 'hs-3',
        extension: [{ url: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL, valueCanonical: previousCanonical }],
      }),
    ];

    const result = makeServicePatchesForFlowCanonicalBumps(services, [{ previousCanonical, nextCanonical }]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ url: 'HealthcareService/hs-1' });
    expect(result[1]).toMatchObject({ url: 'HealthcareService/hs-3' });
  });

  it('treats a service with no extension array as having no matching extensions', () => {
    const services = [healthcareService({ extension: undefined })];

    const result = makeServicePatchesForFlowCanonicalBumps(services, [{ previousCanonical, nextCanonical }]);

    expect(result).toEqual([]);
  });
});

describe('evaluateFlowsForUrl', () => {
  const formQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire =>
    ({
      resourceType: 'Questionnaire',
      status: 'active',
      url: 'https://ottehr.com/FHIR/Questionnaire/target-form',
      version: '1.0.0',
      ...overrides,
    }) as Questionnaire;

  const flow = (overrides: Partial<Questionnaire> = {}): Questionnaire =>
    ({
      resourceType: 'Questionnaire',
      status: 'active',
      url: 'https://ottehr.com/FHIR/Questionnaire/some-flow',
      title: 'Some Flow',
      version: '1.0.0',
      ...overrides,
    }) as Questionnaire;

  it('does not throw when no flow derives from the target form', () => {
    const targetFormQ = formQuestionnaire();
    const flowQuestionnaires = [flow({ derivedFrom: ['https://ottehr.com/FHIR/Questionnaire/other-form|1.0.0'] })];

    expect(() => evaluateFlowsForUrl(targetFormQ, flowQuestionnaires)).not.toThrow();
  });

  it('does not throw when there are no flows', () => {
    const targetFormQ = formQuestionnaire();

    expect(() => evaluateFlowsForUrl(targetFormQ, [])).not.toThrow();
  });

  it('throws a MANAGED_QUESTIONNAIRE_ERROR naming the flow when a flow derives from the target form', () => {
    const targetFormQ = formQuestionnaire();
    const flowQuestionnaires = [
      flow({ title: 'Some Flow', derivedFrom: [`${targetFormQ.url}|${targetFormQ.version}`] }),
    ];

    let caught: unknown;
    try {
      evaluateFlowsForUrl(targetFormQ, flowQuestionnaires);
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({ message: expect.stringContaining('Some Flow') });
  });
});
