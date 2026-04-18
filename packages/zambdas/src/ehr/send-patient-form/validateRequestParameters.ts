import { Secrets, ZambdaInput } from '../../shared';

export interface SendPatientFormInput {
  appointmentId: string;
  questionnaireId: string;
  questionnaireName: string;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): SendPatientFormInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, questionnaireId, questionnaireName } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentId is required');
  }
  if (!questionnaireId) {
    throw new Error('questionnaireId is required');
  }

  return {
    appointmentId,
    questionnaireId,
    questionnaireName: questionnaireName || 'a form',
    secrets: input.secrets,
  };
}
