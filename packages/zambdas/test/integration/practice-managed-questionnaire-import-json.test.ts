import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Questionnaire } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  JSON_IMPORT_QUESTIONNAIRE_TAG,
  PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
} from 'utils/lib/fhir/constants';
import { PracticeManagedQuestionnaireImportJsonOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('practice-managed-questionnaire-import-json integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let form: Questionnaire;
  let flow: Questionnaire;
  const suffix = randomUUID().slice(0, 8);
  const formUrl = `https://ottehr.com/FHIR/Questionnaire/it-imported-form-${suffix}`;
  const flowUrl = `https://ottehr.com/FHIR/Questionnaire/it-paperwork-flow-${suffix}`;

  const versionsOf = async (url: string): Promise<Questionnaire[]> =>
    (await oystehr.fhir.search<Questionnaire>({ resourceType: 'Questionnaire', params: [{ name: 'url', value: url }] }))
      .unbundle()
      .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? ''));

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'practice-managed-questionnaire-import-json.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;

    form = await oystehr.fhir.create<Questionnaire>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, JSON_IMPORT_QUESTIONNAIRE_TAG] },
          url: formUrl,
          version: '1.0.0',
          name: `it-imported-form-${suffix}`,
          title: 'IT imported form',
          status: 'active',
          item: [{ linkId: 'allergies', type: 'string', text: 'Allergies' }],
        },
        processId
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
        processId
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

  it('imports the json as the next version of the form and bumps the flow that contains it', async () => {
    const questionnaireJson = JSON.stringify(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          url: formUrl,
          title: 'IT imported form v2',
          status: 'active',
          item: [
            { linkId: 'allergies', type: 'string', text: 'Allergies' },
            { linkId: 'medications', type: 'text', text: 'Current medications' },
          ],
        },
        processId
      )
    );

    const response = await oystehrZambdas.zambda.execute({
      id: 'practice-managed-questionnaire-import-json',
      questionnaireJson,
      questionnaireId: form.id,
    });
    const output = response.output as PracticeManagedQuestionnaireImportJsonOutput;

    expect(output).toEqual({ questionnaireId: expect.any(String), version: '1.0.1' });

    const formVersions = await versionsOf(formUrl);
    expect(formVersions.map(({ id, version, status }) => ({ id, version, status }))).toEqual([
      { id: form.id, version: '1.0.0', status: 'retired' },
      { id: output.questionnaireId, version: '1.0.1', status: 'active' },
    ]);
    expect(formVersions[1].title).toBe('IT imported form v2');
    expect(formVersions[1].item?.map((item) => item.linkId)).toEqual(['allergies', 'medications']);
    expect(formVersions[1].meta?.tag).toEqual(
      expect.arrayContaining([
        expect.objectContaining(PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
        expect.objectContaining(JSON_IMPORT_QUESTIONNAIRE_TAG),
      ])
    );

    const flowVersions = await versionsOf(flowUrl);
    expect(flowVersions.map(({ id, version, status }) => ({ id, version, status }))).toEqual([
      { id: flow.id, version: '1.0.0', status: 'retired' },
      { id: expect.any(String), version: '1.0.1', status: 'active' },
    ]);
    expect(flowVersions[1].derivedFrom).toEqual([`${formUrl}|1.0.1`]);
  });
});
