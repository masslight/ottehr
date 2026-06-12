import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface SendPatientFormInput {
  appointmentId?: string;
  patientId?: string;
  questionnaireId: string;
  questionnaireName: string;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): SendPatientFormInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentId, patientId, questionnaireId, questionnaireName } = JSON.parse(input.body);

  if (!appointmentId && !patientId) {
    throw INVALID_INPUT_ERROR('appointmentId or patientId is required');
  }
  if (!questionnaireId) {
    throw MISSING_REQUIRED_PARAMETERS(['questionnaireId']);
  }

  return {
    appointmentId,
    patientId,
    questionnaireId,
    questionnaireName: questionnaireName || 'a form',
    secrets: input.secrets,
  };
}
