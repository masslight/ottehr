import { Secrets, ZambdaInput } from '../../shared';

export interface SendPatientFormInput {
  appointmentId?: string;
  patientId?: string;
  questionnaireId: string;
  questionnaireName: string;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): SendPatientFormInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, patientId, questionnaireId, questionnaireName } = JSON.parse(input.body);

  if (!appointmentId && !patientId) {
    throw new Error('appointmentId or patientId is required');
  }
  if (!questionnaireId) {
    throw new Error('questionnaireId is required');
  }

  return {
    appointmentId,
    patientId,
    questionnaireId,
    questionnaireName: questionnaireName || 'a form',
    secrets: input.secrets,
  };
}
