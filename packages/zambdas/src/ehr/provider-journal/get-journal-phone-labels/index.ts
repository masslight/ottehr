import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isIntakePaperworkQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  GetJournalPhoneLabelsInputSchema,
  GetJournalPhoneLabelsResponse,
} from 'utils/lib/types/api/provider-journal.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { consentSignerLabel, phonesByBookingAppointment, toJournalPatient } from '../get-provider-journal/helpers';

const ZAMBDA_NAME = 'get-journal-phone-labels';

let m2mToken: string;

/**
 * Labels a patient's account phones with the consent signer of the newest visit each phone booked, for the journal's
 * side column. Read when a row is picked, not with the journal: it reads every booking the patient made.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateWithSchema(GetJournalPhoneLabelsInputSchema, input);
  // The journal's access: anyone who can open charts.
  await requireUserWithRole(getUserToken(input), secrets, ALL_EHR_STAFF_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const [patientResources, appointments] = await Promise.all([
    getAllFhirSearchPages<Patient | RelatedPerson>(
      {
        resourceType: 'Patient',
        params: [
          { name: '_id', value: patientId },
          { name: '_revinclude', value: 'RelatedPerson:patient' },
        ],
      },
      oystehr
    ),
    getAllFhirSearchPages<Appointment>(
      { resourceType: 'Appointment', params: [{ name: 'actor', value: `Patient/${patientId}` }] },
      oystehr
    ),
  ]);
  const patient = patientResources.find((r): r is Patient => r.resourceType === 'Patient');
  const empty: GetJournalPhoneLabelsResponse = { labels: [] };
  // An unknown patient gets the same empty answer as one with no labels.
  if (!patient) return lambdaResponse(200, empty);

  // The phones come from the patient's own account records, never from the caller.
  const journalPatient = toJournalPatient(
    patient,
    patientResources.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson')
  );
  const bookings = phonesByBookingAppointment([journalPatient], appointments);
  if (!bookings.size) return lambdaResponse(200, empty);

  const visits = await getAllFhirSearchPages<Encounter | QuestionnaireResponse>(
    {
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: [...bookings.keys()].map((id) => `Appointment/${id}`).join(',') },
        { name: '_revinclude', value: 'QuestionnaireResponse:encounter' },
      ],
    },
    oystehr
  );
  const signers = new Map<string, string>();
  visits.forEach((encounter) => {
    if (encounter.resourceType !== 'Encounter') return;
    const intake = visits.find(
      (r): r is QuestionnaireResponse =>
        r.resourceType === 'QuestionnaireResponse' &&
        r.encounter?.reference === `Encounter/${encounter.id}` &&
        isIntakePaperworkQuestionnaireResponse(r)
    );
    const signer = intake ? consentSignerLabel(intake) : undefined;
    const appointmentId = getIdFromReference(encounter.appointment?.[0]?.reference, 'Appointment');
    if (signer && appointmentId)
      bookings.get(appointmentId)?.forEach((phone) => signers.set(phone.recipientResourceUri, signer));
  });
  const response: GetJournalPhoneLabelsResponse = {
    labels: [...signers].map(([recipientResourceUri, signer]) => ({ recipientResourceUri, signer })),
  };
  return lambdaResponse(200, response);
});
