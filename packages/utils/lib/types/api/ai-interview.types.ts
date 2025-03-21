export interface StartInterviewInput {
  appointmentId: string;
}

export interface HandleAnswerInput {
  questionnaireResponseId: string;
  linkId: string;
  answer: string;
}
