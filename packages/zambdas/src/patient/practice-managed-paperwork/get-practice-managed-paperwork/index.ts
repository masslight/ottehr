import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import {
  GetAllPracticeManagedPaperworkOutput,
  isPracticeManagedQr,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PracticeManagedPaperworkDTO,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getUser,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-practice-managed-paperwork';

// todo sarah this should get moved under EHR

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const validatedParameters = validateRequestParameters(input);

  const { appointmentId, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);

  const { patientId, questionnaireResponses } = await getResources(oystehr, appointmentId);

  // Authorization: the caller must be connected to the patient (or be an EHR user —
  // userHasAccessToPatient allows those implicitly). Without this, any authenticated
  // account could read another patient's forms AND their QuestionnaireResponse answers
  // by guessing/replaying an appointment id.
  const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
  const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
  const hasAccess = caller ? await userHasAccessToPatient(caller, patientId, oystehr) : false;
  console.log('hasAccess', hasAccess);
  if (!hasAccess) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  // if no specific questionnaireId is passed as a param all managed paperwork for the appointment / encounter will be returned
  console.log(`getting all managed paperwork for Appointment/${appointmentId}`);

  if (questionnaireResponses.length === 0) {
    console.log('no custom paperwork has been completed for this visit');
    return { statusCode: 200, body: JSON.stringify({}) }; // todo sarah fix return
  } else {
    console.log(`fetching questionnaires for ${questionnaireResponses.map((qr) => `QuestionnaireResponse/${qr.id}`)}`);
    // need to fetch the questionnaires for each response
    const promises = questionnaireResponses.map(async (qr) => {
      const questionnaires = (
        await oystehr.fhir.search<Questionnaire>({
          resourceType: 'Questionnaire',
          params: [{ name: 'url', value: qr.questionnaire ?? '' }],
        })
      ).unbundle();
      // todo sarah fix 0 thing
      const managedPaperwork = makeManagedPaperworkDTO(questionnaires[0], qr);
      return managedPaperwork;
    });

    const practiceManagedPaperwork = await Promise.all(promises);
    const response: GetAllPracticeManagedPaperworkOutput = { practiceManagedPaperwork };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
});

type ResourceConfig = {
  encounter: Encounter;
  encounterId: string;
  patientId: string;
  questionnaireResponses: QuestionnaireResponse[];
};

const getResources = async (oystehr: Oystehr, appointmentId: string): Promise<ResourceConfig> => {
  console.log(`getting resources for Appointment/${appointmentId}`);

  const resources = (
    await oystehr.fhir.search<Encounter | QuestionnaireResponse>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: appointmentId },
        { name: '_revinclude', value: 'QuestionnaireResponse:encounter' },
      ],
    })
  ).unbundle();

  const { encounters, questionnaireResponses } = resources.reduce(
    (acc: { encounters: Encounter[]; questionnaireResponses: QuestionnaireResponse[] }, resource) => {
      if (resource.resourceType === 'Encounter') acc.encounters.push(resource);
      if (resource.resourceType === 'QuestionnaireResponse') {
        if (isPracticeManagedQr(resource)) acc.questionnaireResponses.push(resource);
      }

      return acc;
    },
    { encounters: [], questionnaireResponses: [] }
  );

  // todo sarah maybe don't throw error? need to comply with requirement to not disrupt booking flow
  if (encounters.length !== 1) {
    throw new Error(`unexpected number of encounters returned for Appointment/${appointmentId}: ${encounters.length}`);
  }

  const encounter = encounters[0];
  const encounterId = encounter?.id || '';
  const patientId = encounter?.subject?.reference?.replace('Patient/', '') || '';

  if (!patientId || !encounterId) {
    throw new Error(
      `patientId and/or encounterId could not be resolved for for Appointment/${appointmentId}: ${patientId} ${encounterId}`
    );
  }

  return { encounter, encounterId, patientId, questionnaireResponses };
};

function makeManagedPaperworkDTO(
  questionnaire: Questionnaire,
  questionnaireResponse: QuestionnaireResponse
): PracticeManagedPaperworkDTO {
  return {
    questionnaireTitle: questionnaire.title ?? '',
    questionnaireId: questionnaire.id ?? '',
    questionnaireItems: questionnaire.item ?? [],
    questionnaireResponse: questionnaireResponse,
  };
}
