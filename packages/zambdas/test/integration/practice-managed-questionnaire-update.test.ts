import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Questionnaire } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PAPERWORK_FLOW_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('practice-managed-questionnaire-update integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let form: Questionnaire;
  let flow: Questionnaire;
  const suffix = randomUUID().slice(0, 8);
  const formUrl = `https://ottehr.com/FHIR/Questionnaire/it-practice-form-${suffix}`;
  const flowUrl = `https://ottehr.com/FHIR/Questionnaire/it-paperwork-flow-${suffix}`;

  const versionsOf = async (url: string): Promise<Questionnaire[]> =>
    (await oystehr.fhir.search<Questionnaire>({ resourceType: 'Questionnaire', params: [{ name: 'url', value: url }] }))
      .unbundle()
      .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? ''));

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'practice-managed-questionnaire-update.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    form = await oystehr.fhir.create<Questionnaire>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
          url: formUrl,
          version: '1.0.0',
          name: `it-practice-form-${suffix}`,
          title: 'IT practice form',
          status: 'active',
          item: [{ linkId: 'reason', type: 'string', text: 'Reason for visit' }],
        },
        setup.processId
      ) as Questionnaire
    );
    flow = await oystehr.fhir.create<Questionnaire>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          meta: { tag: [PAPERWORK_FLOW_TAG] },
          url: flowUrl,
          version: '1.0.0',
          name: `it-paperwork-flow-${suffix}`,
          title: 'IT paperwork flow',
          status: 'active',
          derivedFrom: [`${formUrl}|1.0.0`],
        },
        setup.processId
      ) as Questionnaire
    );
  }, 60_000);

  afterAll(async () => {
    for (const url of [formUrl, flowUrl]) {
      for (const version of await versionsOf(url)) {
        await oystehr.fhir.delete({ resourceType: 'Questionnaire', id: version.id! }).catch(() => undefined);
      }
    }
    await cleanup();
  });

  it('publishes the next form version, retires the previous one and bumps the flow that contains it', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'practice-managed-questionnaire-update',
      updateType: 'update-questionnaire',
      data: {
        resourceType: 'Questionnaire',
        id: form.id,
        meta: { tag: form.meta?.tag },
        url: formUrl,
        version: '1.0.0',
        name: form.name,
        title: 'IT practice form v2',
        status: 'active',
        item: [{ linkId: 'reason', type: 'string', text: 'Main reason for visit', _key: 'itkey001' }],
      },
    });
    const { questionnaireId } = response.output as { questionnaireId: string };

    const formVersions = await versionsOf(formUrl);
    expect(formVersions.map(({ id, version, status }) => ({ id, version, status }))).toEqual([
      { id: form.id, version: '1.0.0', status: 'retired' },
      { id: questionnaireId, version: '1.0.1', status: 'active' },
    ]);
    expect(formVersions[1]).toMatchObject({
      title: 'IT practice form v2',
      item: [{ linkId: 'reason', type: 'string', text: 'Main reason for visit' }],
    });
    expect(formVersions[1].item?.[0]).not.toHaveProperty('_key');

    const flowVersions = await versionsOf(flowUrl);
    expect(flowVersions.map(({ id, version, status }) => ({ id, version, status }))).toEqual([
      { id: flow.id, version: '1.0.0', status: 'retired' },
      { id: expect.any(String), version: '1.0.1', status: 'active' },
    ]);
    expect(flowVersions[1].derivedFrom).toEqual([`${formUrl}|1.0.1`]);
    expect(flowVersions[1].meta?.tag).toEqual(expect.arrayContaining([expect.objectContaining(PAPERWORK_FLOW_TAG)]));
  });
});
