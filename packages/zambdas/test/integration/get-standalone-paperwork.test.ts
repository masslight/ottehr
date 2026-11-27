import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Person, Questionnaire, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { UCGetPaperworkResponse } from 'utils/lib/types/data/paperwork/paperwork.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const linkCallerToPatient = async (
  oystehr: Oystehr,
  processId: string,
  callerPhone: string,
  patientId: string
): Promise<void> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  await oystehr.fhir.transaction<FhirResource>({
    requests: [
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:user-related-person',
        resource: tag<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: `Patient/${patientId}` },
          relationship: [
            { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
          ],
          telecom: [{ system: 'phone', value: callerPhone }],
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tag<Person>({
          resourceType: 'Person',
          telecom: [{ system: 'phone', value: callerPhone }],
          link: [{ target: { reference: 'urn:uuid:user-related-person' } }],
        }),
      },
    ],
  });
};

describe('get-standalone-paperwork integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaire: Questionnaire;
  let questionnaireResponse: QuestionnaireResponse;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-standalone-paperwork.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const [visit, caller] = await Promise.all([
      insertInPersonAppointmentBase(oystehr, setup.processId),
      userMe(setup.testUserM2MToken, loadZambdaSecrets()),
    ]);
    base = visit;
    await linkCallerToPatient(oystehr, setup.processId, caller.name, base.patient.id!);

    questionnaire = await oystehr.fhir.create<Questionnaire>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
          url: `https://ottehr.com/FHIR/Questionnaire/integration-standalone-${randomUUID()}`,
          version: '1.0.0',
          status: 'active',
          title: 'Integration Standalone Form',
          item: [{ linkId: 'favorite-color', text: 'Favorite color', type: 'string' }],
        },
        setup.processId
      ) as Questionnaire
    );
    questionnaireResponse = await oystehr.fhir.create<QuestionnaireResponse>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          questionnaire: `${questionnaire.url}|${questionnaire.version}`,
          subject: { reference: `Patient/${base.patient.id}` },
          encounter: { reference: `Encounter/${base.encounter.id}` },
          item: [{ linkId: 'favorite-color', answer: [{ valueString: 'green' }] }],
        },
        setup.processId
      ) as QuestionnaireResponse
    );
  }, 60_000);

  afterAll(async () => {
    if (questionnaire?.id) await oystehr.fhir.delete({ resourceType: 'Questionnaire', id: questionnaire.id });
    await cleanup();
  });

  it("returns the managed form with the visit and patient it belongs to for the patient's user", async () => {
    const { status, output } = await oystehrZambdas.zambda.execute({
      id: 'get-standalone-paperwork',
      questionnaireResponseId: questionnaireResponse.id,
    });

    expect(status).toBe(200);
    const response = output as UCGetPaperworkResponse;
    expect(response.questionnaireTitle).toBe('Integration Standalone Form');
    expect(response.allItems.map((item) => item.linkId)).toEqual(['favorite-color']);
    expect(response.questionnaireResponse?.id).toBe(questionnaireResponse.id);
    expect(response.appointment).toMatchObject({
      id: base.appointment.id,
      start: base.appointment.start,
      location: { name: 'Integration Test Location' },
    });
    expect(response.patient).toMatchObject({
      id: base.patient.id,
      firstName: 'Jon',
      lastName: 'Snow',
      dateOfBirth: '2002-07-07',
      sex: 'Male',
    });
  });
});
