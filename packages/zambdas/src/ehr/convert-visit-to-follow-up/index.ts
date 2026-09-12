import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { isFollowupEncounter } from 'utils/lib/fhir/encounter';
import { Secrets } from 'utils/lib/secrets';
import {
  ConvertVisitToFollowUpInput,
  ConvertVisitToFollowUpResponse,
} from 'utils/lib/types/api/convert-visit-to-follow-up/convert-visit-to-follow-up.types';
import { User } from 'utils/lib/types/api/user.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isVisitFinished } from 'utils/lib/utils/visitUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getVisitResources } from '../../shared/practitioner/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { convertVisitToScheduledFollowUp } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface ConvertVisitToFollowUpInputValidated extends ConvertVisitToFollowUpInput {
  secrets: Secrets;
  userToken: string;
}

let m2mToken: string;

const ZAMBDA_NAME = 'convert-visit-to-follow-up';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);

  const validatedData = await complexValidation(oystehr, validatedParameters);

  const response = await performEffect(oystehr, validatedData);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

interface ConvertVisitToFollowUpValidatedData {
  encounter: Encounter;
  appointment: Appointment;
  parentEncounter: Encounter;
  patientRef: string;
  user: User;
  skipPatientDiagnosis?: boolean;
}

export const complexValidation = async (
  oystehr: Oystehr,
  params: ConvertVisitToFollowUpInputValidated
): Promise<ConvertVisitToFollowUpValidatedData> => {
  const { encounterId, parentEncounterId, skipPatientDiagnosis, userToken, secrets } = params;

  if (encounterId === parentEncounterId) {
    throw INVALID_INPUT_ERROR('A visit cannot be a follow-up of itself');
  }

  const visitResources = await getVisitResources(oystehr, encounterId);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for encounter ${encounterId}`);
  }

  const { encounter, appointment, patient } = visitResources;
  if (!encounter?.id) throw new Error('Encounter not found');
  if (!appointment?.id) throw new Error('Appointment not found');

  if (isFollowupEncounter(encounter)) {
    throw INVALID_INPUT_ERROR('This visit is already a follow-up');
  }

  if (isVisitFinished(appointment, encounter)) {
    throw INVALID_INPUT_ERROR('This visit can no longer be converted because it is already finished');
  }

  const patientRef = encounter.subject?.reference ?? (patient?.id ? `Patient/${patient.id}` : undefined);
  if (!patientRef) {
    throw new Error(`Could not resolve the patient for encounter ${encounterId}`);
  }

  const parentEncounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: parentEncounterId,
  });

  // Mirrors the guard in create-appointment: follow-ups are one level deep only.
  if (parentEncounter.partOf) {
    throw INVALID_INPUT_ERROR(
      'Cannot create a follow-up of a follow-up. Please select a top-level encounter as the initial visit.'
    );
  }

  if (parentEncounter.subject?.reference !== patientRef) {
    throw INVALID_INPUT_ERROR('The initial visit belongs to a different patient');
  }

  const user = await userMe(userToken, secrets);
  if (!user) {
    throw new Error('user unexpectedly not found');
  }

  return { encounter, appointment, parentEncounter, patientRef, user, skipPatientDiagnosis };
};

export const performEffect = async (
  oystehr: Oystehr,
  validatedData: ConvertVisitToFollowUpValidatedData
): Promise<ConvertVisitToFollowUpResponse> => {
  const { encounter, appointment, parentEncounter, patientRef, user, skipPatientDiagnosis } = validatedData;

  const { diagnosesCarriedOver } = await convertVisitToScheduledFollowUp(oystehr, {
    encounter,
    appointment,
    parentEncounter,
    patientRef,
    user,
    skipPatientDiagnosis,
  });

  return { encounterId: encounter.id!, diagnosesCarriedOver };
};
