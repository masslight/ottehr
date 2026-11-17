import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { FORM_PLACEMENT_TAG_SYSTEM, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { PAPERWORK_FLOW_BASE_VERSION } from '../../paperwork-flow/shared';
import {
  bumpFlowFormVersionRequests,
  ensureUniqueQuestionnaire,
  FhirQuestionnaireSubset,
  isLatestVersion,
  patchQuestionnaireVersion,
  placementTagOperations,
  supersedeVersionRequests,
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

describe('ensureUniqueQuestionnaire', () => {
  const url = 'https://ottehr.com/FHIR/Questionnaire/new-form';

  const newQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire => ({
    resourceType: 'Questionnaire',
    status: 'active',
    url,
    name: 'new-form',
    title: 'New Form',
    version: '1.0.0',
    ...overrides,
  });

  const mockOystehr = (existing: Questionnaire[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => existing });
    return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
  };

  it('returns the questionnaire unchanged when no questionnaire with the url exists', async () => {
    const input = newQuestionnaire();
    const { oystehr } = mockOystehr([]);

    const result = await ensureUniqueQuestionnaire(input, oystehr);

    expect(result).toBe(input);
  });

  it('appends a random hex suffix to the url when a questionnaire with the url exists', async () => {
    const input = newQuestionnaire();
    const { oystehr } = mockOystehr([newQuestionnaire({ id: 'existing-1' })]);

    const result = await ensureUniqueQuestionnaire(input, oystehr);

    expect(result.url).toMatch(new RegExp(`^${url}-[0-9a-f]{6}$`));
    expect({ ...result, url }).toEqual(input);
  });

  it('treats a url match on a different version as a collision', async () => {
    const input = newQuestionnaire({ version: '1.0.0' });
    const { oystehr } = mockOystehr([newQuestionnaire({ id: 'existing-1', version: '2.0.0' })]);

    const result = await ensureUniqueQuestionnaire(input, oystehr);

    expect(result.url).not.toBe(url);
  });

  it('throws without searching when the questionnaire has no url', async () => {
    const { oystehr, search } = mockOystehr([]);

    await expect(ensureUniqueQuestionnaire(newQuestionnaire({ url: undefined }), oystehr)).rejects.toThrow(
      'ensureUniqueQuestionnaire requires a questionnaire with a url'
    );
    expect(search).not.toHaveBeenCalled();
  });
});

describe('placementTagOperations', () => {
  const screeningTag = { system: FORM_PLACEMENT_TAG_SYSTEM, code: 'screening' };
  const version = (id: string, tag: Questionnaire['meta']): Questionnaire => ({
    resourceType: 'Questionnaire',
    id,
    status: 'retired',
    meta: tag,
  });

  // A response points at the exact version it answered, so earlier versions must carry the form's current
  // placement too, or moving a form to another page would leave every earlier response behind.
  it('moves every earlier version to the new placement, keeping their other tags', () => {
    const operations = placementTagOperations(
      [
        version('v1', { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] }),
        version('v2', { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, screeningTag] }),
      ],
      'questionnaires'
    );

    const questionnairesTags = [
      PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
      { system: FORM_PLACEMENT_TAG_SYSTEM, code: 'questionnaires' },
    ];
    expect(operations.get('v1')).toEqual([{ op: 'replace', path: '/meta/tag', value: questionnairesTags }]);
    expect(operations.get('v2')).toEqual([{ op: 'replace', path: '/meta/tag', value: questionnairesTags }]);
  });

  it('moves a version back to Visit Details by dropping its placement tag', () => {
    const operations = placementTagOperations(
      [version('v1', { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, screeningTag] })],
      'visit-details'
    );

    expect(operations.get('v1')).toEqual([
      { op: 'replace', path: '/meta/tag', value: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
    ]);
  });

  it('leaves versions alone when the placement did not change', () => {
    const operations = placementTagOperations(
      [version('v1', { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, screeningTag] })],
      'screening'
    );

    expect(operations.size).toBe(0);
  });
});

describe('supersedeVersionRequests', () => {
  const screeningTag = { system: FORM_PLACEMENT_TAG_SYSTEM, code: 'screening' };
  const version = (id: string): Questionnaire => ({
    resourceType: 'Questionnaire',
    id,
    url: 'https://ottehr.com/FHIR/Questionnaire/sdoh',
    status: id === 'v2' ? 'active' : 'retired',
    meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
  });
  const oystehrWith = (versions: Questionnaire[]): Oystehr =>
    ({
      fhir: {
        search: vi.fn(async () => ({
          entry: versions.map((resource) => ({ resource, search: { mode: 'match' } })),
          total: versions.length,
          unbundle: () => versions,
        })),
      },
    }) as unknown as Oystehr;

  // Builder saves and JSON uploads both mint a version, so both must move the answers to earlier ones.
  it('retires the previous version and moves it and every older version to the new placement', async () => {
    const requests = await supersedeVersionRequests({
      url: 'https://ottehr.com/FHIR/Questionnaire/sdoh',
      previousId: 'v2',
      placement: 'screening',
      oystehr: oystehrWith([version('v1'), version('v2')]),
    });

    const screeningTags = [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, screeningTag];
    expect(requests).toEqual([
      {
        method: 'PATCH',
        url: 'Questionnaire/v2',
        operations: [
          { op: 'replace', path: '/status', value: 'retired' },
          { op: 'replace', path: '/meta/tag', value: screeningTags },
        ],
      },
      {
        method: 'PATCH',
        url: 'Questionnaire/v1',
        operations: [{ op: 'replace', path: '/meta/tag', value: screeningTags }],
      },
    ]);
  });

  it('only retires the previous version when the placement is unchanged', async () => {
    const requests = await supersedeVersionRequests({
      url: 'https://ottehr.com/FHIR/Questionnaire/sdoh',
      previousId: 'v2',
      placement: 'visit-details',
      oystehr: oystehrWith([version('v1'), version('v2')]),
    });

    expect(requests).toEqual([
      { method: 'PATCH', url: 'Questionnaire/v2', operations: [{ op: 'replace', path: '/status', value: 'retired' }] },
    ]);
  });
});
