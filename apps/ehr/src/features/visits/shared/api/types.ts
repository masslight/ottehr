export type GetOystehrTelemedAPIParams = {
  isAppLocal?: 'true' | 'false';
  initTelemedSessionZambdaID?: string;
  getChartSectionZambdaID?: string;
  getVisitNoteZambdaID?: string;
  saveChartDataZambdaID?: string;
  deleteChartDataZambdaID?: string;
  /**
   * Easy Chart: the planner (narrative → typed actions), the review pass (a second look), the
   * narrative writer (transcript → provider-voice lines the planner then reads), and the transcript
   * saver (typed or edited dialogue → a transcript document on the visit, processed as a recording's would be).
   */
  easyChartPlanZambdaID?: string;
  easyChartReviewZambdaID?: string;
  easyChartNarrativeZambdaID?: string;
  easyChartSaveTranscriptZambdaID?: string;
  changeInPersonVisitStatusZambdaID?: string;
  assignPractitionerZambdaID?: string;
  unassignPractitionerZambdaID?: string;
  signAppointmentZambdaID?: string;
  unlockAppointmentZambdaID?: string;
  syncUserZambdaID?: string;
  getPatientInstructionsZambdaID?: string;
  savePatientInstructionZambdaID?: string;
  deletePatientInstructionZambdaID?: string;
  savePatientFollowupZambdaID?: string;
  aiSuggestionNotesZambdaID?: string;
  recommendBillingSuggestionsZambdaID?: string;
  recommendBillingCodesZambdaID?: string;
  createUpdateMedicationOrderZambdaID?: string;
  getMedicationOrdersZambdaID?: string;
  getPatientAccountZambdaID?: string;
  updatePatientAccountZambdaID?: string;
  removePatientCoverageZambdaID?: string;
  mergePatientsZambdaID?: string;
  sendFaxPacketZambdaID?: string;
  getFaxPacketPreviewZambdaID?: string;
  getFaxPacketStatusZambdaID?: string;
  externalLabResourceSearchID?: string;
  getUnsolicitedResultsResourcesID?: string;
  updateLabOrderResourcesID?: string;
  searchPlacesID?: string;
  inhouseLabResourceSearchID?: string;
  makeMedicationHistoryPdfID?: string;
  generatePatientEducationZambdaID?: string;
  savePatientEducationPdfZambdaID?: string;
  listApprovedPatientEducationZambdaID?: string;
  saveApprovedPatientEducationZambdaID?: string;
  deleteApprovedPatientEducationZambdaID?: string;
  updateApprovedPatientEducationCodesZambdaID?: string;
};

export type { PromiseReturnType } from 'utils/lib/types/common';
