export type GetOystehrTelemedAPIParams = {
  isAppLocal?: 'true' | 'false';
  getTelemedAppointmentsZambdaID?: string;
  initTelemedSessionZambdaID?: string;
  getChartDataZambdaID?: string;
  saveChartDataZambdaID?: string;
  deleteChartDataZambdaID?: string;
  changeTelemedAppointmentStatusZambdaID?: string;
  assignPractitionerZambdaID?: string;
  unassignPractitionerZambdaID?: string;
  signAppointmentZambdaID?: string;
  syncUserZambdaID?: string;
  getPatientInstructionsZambdaID?: string;
  savePatientInstructionZambdaID?: string;
  deletePatientInstructionZambdaID?: string;
  savePatientFollowupZambdaID?: string;
  icdSearchZambdaId?: string;
  createUpdateMedicationOrderZambdaID?: string;
  getMedicationOrdersZambdaID?: string;
};

export type { PromiseReturnType } from 'utils';
