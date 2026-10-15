import { Questionnaire } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PAPERWORK_FLOW_BASE_VERSION } from '../../paperwork-flow/shared';
import {
  bumpFlowFormVersionRequests,
  FhirQuestionnaireSubset,
  findLinkIdClashes,
  isLatestVersion,
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

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

    expect(result).toEqual([]);
  });

  it('returns no requests when flowQuestionnaires is empty', () => {
    const result = bumpFlowFormVersionRequests({
      previousVersion,
      nextVersion,
      url,
      flowQuestionnaires: [],
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

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

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

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

    expect(result[1]).toMatchObject({
      resource: { version: PAPERWORK_FLOW_BASE_VERSION },
    });
  });

  it('returns a retire+create pair per matching flow when multiple flows derive from the target form', () => {
    const flowQuestionnaires = [
      flowQuestionnaire({ id: 'flow-1', derivedFrom: [`${url}|${previousVersion}`] }),
      flowQuestionnaire({ id: 'flow-2', derivedFrom: [`${url}|${previousVersion}`] }),
    ];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ method: 'PATCH', url: 'Questionnaire/flow-1' });
    expect(result[1]).toMatchObject({ method: 'POST', url: '/Questionnaire' });
    expect(result[2]).toMatchObject({ method: 'PATCH', url: 'Questionnaire/flow-2' });
    expect(result[3]).toMatchObject({ method: 'POST', url: '/Questionnaire' });
  });

  it('ignores flows whose derivedFrom references a different version of the target form', () => {
    const flowQuestionnaires = [flowQuestionnaire({ id: 'flow-1', derivedFrom: [`${url}|9.9.9`] })];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

    expect(result).toEqual([]);
  });

  it('does not throw when a flow has no derivedFrom', () => {
    const flowQuestionnaires = [flowQuestionnaire({ id: 'flow-1', derivedFrom: undefined })];

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });

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

    const result = bumpFlowFormVersionRequests({ previousVersion, nextVersion, url, flowQuestionnaires });
    const createPost = result[1] as { resource: Questionnaire };

    expect(createPost.resource.id).toBeUndefined();
    expect(createPost.resource.meta).toEqual({
      tag: [{ system: 'https://ottehr.com/paperwork-flow', code: 'paperwork-flow' }],
    });
  });
});

describe('findLinkIdClashes', () => {
  const form = (title: string, url: string, linkIds: string[]): Questionnaire => ({
    resourceType: 'Questionnaire',
    status: 'active',
    title,
    url,
    item: [{ linkId: `${title}-page`, type: 'group', item: linkIds.map((linkId) => ({ linkId, type: 'string' })) }],
  });
  const phq9 = form('PHQ-9', 'https://example.org/phq9', ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'total']);

  it('warns once per other form that shares ids, listing at most five of them', () => {
    const gad7 = form('GAD-7', 'https://example.org/gad7', ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'total']);
    expect(findLinkIdClashes(phq9, [gad7])).toEqual([
      '"GAD-7" also uses "q1", "q2", "q3", "q4", "q5" and 3 more, so the two forms can\'t be in the same paperwork flow until one is re-imported with different ids (for example prefixed with the form\'s name, like "cage-q1").',
    ]);
  });

  it('ignores forms without shared ids and earlier versions of the same form', () => {
    const cage = form('CAGE', 'https://example.org/cage', ['cage-q1', 'cage-total']);
    const olderPhq9 = form('PHQ-9', 'https://example.org/phq9', ['q1', 'total']);
    expect(findLinkIdClashes(phq9, [cage, olderPhq9])).toEqual([]);
  });
});
