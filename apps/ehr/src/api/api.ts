import Oystehr, { User } from '@oystehr/sdk';
import { Medication, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import { createClinicalOystehrClient } from 'ui-components';
import {
  AdHocBillingInput,
  AdHocBillingOutput,
  AdHocEncountersInput,
  AdHocEncountersOutput,
  AdHocPatientsInput,
  AdHocPatientsOutput,
  AdminAddInHouseLabInput,
  AdminAddInHouseLabOutput,
  AdminAddLabSetInput,
  AdminAddLabSetOutput,
  AdminCreateTemplateInput,
  AdminCreateTemplateOutput,
  AdminDeleteTemplateInput,
  AdminDeleteTemplateOutput,
  AdminGetInHouseLabConfigInput,
  AdminGetLabSetDetailInput,
  AdminGetLabSetDetailOutput,
  AdminGetLabSetListOutput,
  AdminGetTemplateDetailInput,
  AdminGetTemplateDetailOutput,
  AdminInHouseLabConfigOutput,
  AdminListInHouseLabsOutput,
  AdminRenameTemplateInput,
  AdminRenameTemplateOutput,
  AdminUpdateInHouseLabInput,
  AdminUpdateLabSetInput,
  AdminUpdateLocationSupportPhonesInput,
  AdminUpdatePrintingConfigInput,
  AdminUpdateSupportDialogInput,
  AiAssistedEncountersReportZambdaInput,
  AiAssistedEncountersReportZambdaOutput,
  AllergyQuickPickData,
  apiErrorToThrow,
  ApplyTemplateZambdaInput,
  ApplyTemplateZambdaOutput,
  AssignPractitionerInput,
  AssignPractitionerResponse,
  BulkUpdateInsuranceStatusInput,
  BulkUpdateInsuranceStatusResponse,
  CancelAppointmentZambdaInput,
  CancelAppointmentZambdaOutput,
  CancelRadiologyOrderZambdaInput,
  CancelRadiologyOrderZambdaOutput,
  CancelTelemedAppointmentZambdaInput,
  CancelTelemedAppointmentZambdaOutput,
  ChangeInPersonVisitStatusInput,
  ChangeInPersonVisitStatusResponse,
  chooseJson,
  CollectInHouseLabSpecimenParameters,
  CollectInHouseLabSpecimenZambdaOutput,
  CreateAllergyQuickPickInput,
  CreateAllergyQuickPickResponse,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateCustomFolderInput,
  CreateCustomFolderOutput,
  CreateDischargeSummaryInput,
  CreateDischargeSummaryResponse,
  CreateEmCodeInput,
  CreateImmunizationQuickPickInput,
  CreateImmunizationQuickPickResponse,
  CreateInHouseLabOrderParameters,
  CreateInHouseLabOrderResponse,
  CreateInHouseMedicationInput,
  CreateInHouseMedicationQuickPickInput,
  CreateInHouseMedicationQuickPickResponse,
  CreateInsuranceQuickPickInput,
  CreateInsuranceQuickPickResponse,
  CreateLabOrderParameters,
  CreateLabOrderZambdaOutput,
  CreateMedicalConditionQuickPickInput,
  CreateMedicalConditionQuickPickResponse,
  CreateMedicationHistoryQuickPickInput,
  CreateMedicationHistoryQuickPickResponse,
  CreateNursingOrderInput,
  CreatePatientInstructionQuickPickInput,
  CreatePatientInstructionQuickPickResponse,
  CreateProcedureQuickPickInput,
  CreateProcedureQuickPickResponse,
  CreateQuickTextQuickPickInput,
  CreateQuickTextQuickPickResponse,
  CreateRadiologyQuickPickInput,
  CreateRadiologyQuickPickResponse,
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  CreateResourcesFromAudioRecordingInput,
  CreateResourcesFromAudioRecordingOutput,
  CreateScheduleParams,
  CreateSlotParams,
  CreateUploadAudioRecordingInput,
  CreateUploadAudioRecordingOutput,
  CreateUserOutput,
  CreateUserParams,
  DailyPaymentsReportZambdaInput,
  DailyPaymentsReportZambdaOutput,
  DeleteAdHocReportInput,
  DeleteAdHocReportOutput,
  DeleteCustomFolderInput,
  DeleteCustomFolderOutput,
  DeleteEmCodeInput,
  DeleteInHouseLabOrderParameters,
  DeleteInHouseLabOrderZambdaOutput,
  DeleteLabOrderZambdaInput,
  DeleteLabOrderZambdaOutput,
  DeletePatientDocumentInput,
  DeletePatientDocumentOutput,
  DeleteUserZambdaInput,
  DeleteUserZambdaOutput,
  DeleteVisitFilesInput,
  DownloadPatientProfilePhotoInput,
  EHRVisitDetails,
  EmCodeOutput,
  GenerateAdHocReportInput,
  GenerateAdHocReportOutput,
  GetAllergyQuickPicksResponse,
  GetAppointmentsZambdaInput,
  GetAppointmentsZambdaOutput,
  GetConversationInput,
  GetConversationZambdaOutput,
  GetEmployeesResponse,
  GetImmunizationQuickPicksResponse,
  GetInHouseMedicationQuickPicksResponse,
  GetInHouseOrdersParameters,
  GetInsuranceQuickPicksResponse,
  GetLabelPrintingConfigInput,
  GetLabelPrintingConfigOutput,
  GetLabOrdersParameters,
  GetLocationSupportPhonesOutput,
  GetMedicalConditionQuickPicksResponse,
  GetMedicationHistoryQuickPicksResponse,
  GetNursingOrdersInput,
  GetOrUploadPatientProfilePhotoZambdaResponse,
  GetPatientBalancesZambdaInput,
  GetPatientBalancesZambdaOutput,
  GetPatientInstructionQuickPicksResponse,
  GetPatientLoginPhoneNumbersInput,
  GetPatientLoginPhoneNumbersOutput,
  GetPatientMedicalRecordInput,
  GetPatientMedicalRecordOutput,
  GetPresignedFileURLInput,
  GetProcedureQuickPicksResponse,
  GetProgressNoteConfigInput,
  GetProgressNoteConfigOutput,
  GetQuickTextQuickPicksResponse,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOutput,
  GetRadiologyQuickPicksResponse,
  GetScheduleParams,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetSupportDialogOutput,
  GetUserParams,
  GetUserResponse,
  GetVisitDetailsPDFInput,
  GetVisitFaxHistoryInput,
  GetVisitFaxHistoryOutput,
  GetVisitLabelInput,
  HandleInHouseLabResultsParameters,
  HandleInHouseLabResultsZambdaOutput,
  ImmunizationQuickPickData,
  IncompleteEncountersReportZambdaInput,
  IncompleteEncountersReportZambdaOutput,
  InferAdHocLayersInput,
  InferAdHocLayersOutput,
  InHouseGetOrdersResponseDTO,
  InHouseMedicationQuickPickData,
  InsuranceQuickPickData,
  InviteParticipantRequestParameters,
  LabelPdf,
  ListAdHocReportsOutput,
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  ListTemplatesZambdaInput,
  ListTemplatesZambdaOutput,
  MailedStatementsReportZambdaInput,
  MailedStatementsReportZambdaOutput,
  MedicalConditionQuickPickData,
  MedicationHistoryQuickPickData,
  MigrateExamDataInput,
  MigrateExamDataOutput,
  OnDemandLabelXmlRequestInput,
  OnDemandLabelXmlRequestOutput,
  PaginatedResponse,
  PaperworkToPDFInput,
  PatientInstructionQuickPickData,
  PendingSupervisorApprovalInput,
  PracticeKpisReportZambdaInput,
  PracticeKpisReportZambdaOutput,
  PresignUploadUrlResponse,
  ProcedureQuickPickData,
  QuickPickRemoveResponse,
  QuickTextQuickPickData,
  RadiologyLaunchViewerZambdaInput,
  RadiologyLaunchViewerZambdaOutput,
  RadiologyQuickPickData,
  RecentPatientsReportZambdaInput,
  RecentPatientsReportZambdaOutput,
  RenameCustomFolderInput,
  RenameCustomFolderOutput,
  SaveAdHocReportInput,
  SaveAdHocReportOutput,
  SaveFollowupEncounterZambdaInput,
  SaveFollowupEncounterZambdaOutput,
  SaveRadiologyReportZambdaInput,
  SaveRadiologyReportZambdaOutput,
  ScheduleDTO,
  SearchLegacyRecordsInput,
  SearchLegacyRecordsOutput,
  SendForFinalReadZambdaInput,
  SendForFinalReadZambdaOutput,
  SendReceiptByEmailZambdaInput,
  SendReceiptByEmailZambdaOutput,
  SubmitLabOrderInput,
  SubmitLabOrderOutput,
  SyncMailedStatementStatusesOutput,
  UnassignPractitionerZambdaInput,
  UnassignPractitionerZambdaOutput,
  UpdateAllergyQuickPickResponse,
  UpdateEmCodeInput,
  UpdateImmunizationQuickPickResponse,
  UpdateInHouseMedicationInput,
  UpdateInHouseMedicationQuickPickResponse,
  UpdateInsuranceQuickPickResponse,
  UpdateInvoiceTaskZambdaInput,
  UpdateLabOrderResourcesInput,
  UpdateMedicalConditionQuickPickResponse,
  UpdateMedicationHistoryQuickPickResponse,
  UpdateNursingOrderInput,
  UpdatePatientInstructionQuickPickResponse,
  UpdatePatientLoginPhoneNumbersInput,
  UpdateProcedureQuickPickResponse,
  UpdateProgressNoteConfigInput,
  UpdateQuickTextQuickPickResponse,
  UpdateRadiologyQuickPickResponse,
  UpdateScheduleParams,
  UpdateUserParams,
  UpdateUserZambdaOutput,
  UpdateVisitDetailsInput,
  UpdateVisitFilesInput,
  UploadDotVisionDocumentInput,
  UploadDotVisionDocumentOutput,
  UploadPatientConditionPhotoInput,
  UploadPatientConditionPhotoOutput,
  UploadPatientProfilePhotoInput,
  UserActivationZambdaInput,
  UserActivationZambdaOutput,
  VisitDocuments,
  VisitsOverviewReportZambdaInput,
  VisitsOverviewReportZambdaOutput,
} from 'utils';

export interface PatchOperation {
  // https://www.hl7.org/fhir/fhirpatch.html
  op: 'add' | 'insert' | 'delete' | 'replace' | 'move';
  path: string;
  value: string | object | boolean;
}

const VITE_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;
const SUBMIT_LAB_ORDER_ZAMBDA_ID = 'submit-lab-order';
const GET_APPOINTMENTS_ZAMBDA_ID = 'get-appointments';
const ENCOUNTERS_REPORT_ZAMBDA_ID = 'incomplete-encounters-report';
const GENERATE_ADHOC_REPORT_ZAMBDA_ID = 'generate-adhoc-report';
const INFER_ADHOC_REPORT_LAYERS_ZAMBDA_ID = 'infer-adhoc-report-layers';
const ADHOC_ENCOUNTERS_ZAMBDA_ID = 'adhoc-encounters';
const SAVE_ADHOC_REPORT_ZAMBDA_ID = 'save-adhoc-report';
const LIST_ADHOC_REPORTS_ZAMBDA_ID = 'list-adhoc-reports';
const DELETE_ADHOC_REPORT_ZAMBDA_ID = 'delete-adhoc-report';
const MAILED_STATEMENTS_REPORT_ZAMBDA_ID = 'mailed-statements-report';
const SYNC_MAILED_STATEMENT_STATUSES_ZAMBDA_ID = 'sync-mailed-statement-statuses';
const AI_ASSISTED_ENCOUNTERS_REPORT_ZAMBDA_ID = 'ai-assisted-encounters-report';
const DAILY_PAYMENTS_REPORT_ZAMBDA_ID = 'daily-payments-report';
const PRACTICE_KPIS_REPORT_ZAMBDA_ID = 'practice-kpis-report';
const VISITS_OVERVIEW_REPORT_ZAMBDA_ID = 'visits-overview-report';
const RECENT_PATIENTS_REPORT_ZAMBDA_ID = 'recent-patients-report';
const CREATE_APPOINTMENT_ZAMBDA_ID = 'create-appointment';
const CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID = 'telemed-cancel-appointment';
const INVITE_PARTICIPANT_ZAMBDA_ID = 'video-chat-invites-create';
const CREATE_USER_ZAMBDA_ID = 'create-user';
const DELETE_USER_ZAMBDA_ID = 'delete-user';
const UPDATE_USER_ZAMBDA_ID = 'update-user';
const ASSIGN_PRACTITIONER_ZAMBDA_ID = 'assign-practitioner';
const UNASSIGN_PRACTITIONER_ZAMBDA_ID = 'unassign-practitioner';
const CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID = 'change-in-person-visit-status';
const GET_USER_ZAMBDA_ID = 'get-user';
const USER_ACTIVATION_ZAMBDA_ID = 'user-activation';
const GET_CONVERSATION_ZAMBDA_ID = 'get-conversation';
const GET_SCHEDULE_ZAMBDA_ID = 'get-schedule';
const CANCEL_APPOINTMENT_ZAMBDA_ID = 'cancel-appointment';
const GET_EMPLOYEES_ZAMBDA_ID = 'get-employees';
const GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID = 'get-patient-profile-photo-url';
const SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID = 'save-followup-encounter';
const CREATE_LAB_ORDER_ZAMBDA_ID = 'create-lab-order';
const GET_LAB_ORDERS_ZAMBDA_ID = 'get-lab-orders';
const DELETE_LAB_ORDER_ZAMBDA_ID = 'delete-lab-order';
const UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID = 'update-lab-order-resources';
const EHR_GET_SCHEDULE_ZAMBDA_ID = 'ehr-get-schedule';
const UPDATE_SCHEDULE_ZAMBDA_ID = 'update-schedule';
const LIST_SCHEDULE_OWNERS_ZAMBDA_ID = 'list-schedule-owners';
const CREATE_SCHEDULE_ZAMBDA_ID = 'create-schedule';
const CREATE_SLOT_ZAMBDA_ID = 'create-slot';
const CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID = 'create-in-house-lab-order';
const GET_IN_HOUSE_ORDERS_ZAMBDA_ID = 'get-in-house-orders';
const COLLECT_IN_HOUSE_LAB_SPECIMEN = 'collect-in-house-lab-specimen';
const HANDLE_IN_HOUSE_LAB_RESULTS = 'handle-in-house-lab-results';
const DELETE_IN_HOUSE_LAB_ORDER = 'delete-in-house-lab-order';
const CREATE_IN_HOUSE_MEDICATION = 'create-in-house-medication';
const UPDATE_IN_HOUSE_MEDICATION = 'update-in-house-medication';
const GET_IN_HOUSE_MEDICATIONS = 'get-in-house-medications';
const GET_EM_CODES = 'get-em-codes';
const CREATE_EM_CODE = 'create-em-code';
const UPDATE_EM_CODE = 'update-em-code';
const DELETE_EM_CODE = 'delete-em-code';
const UNLOCK_APPOINTMENT_ZAMBDA_ID = 'unlock-appointment';
const GET_NURSING_ORDERS_ZAMBDA_ID = 'get-nursing-orders';
const CREATE_NURSING_ORDER_ZAMBDA_ID = 'create-nursing-order';
const UPDATE_NURSING_ORDER = 'update-nursing-order';
const UPLOAD_AUDIO_RECORDING_ZAMBDA_ID = 'upload-audio-recording';
const CREATE_RESOURCES_FROM_AUDIO_RECORDING_ZAMBDA_ID = 'create-resources-from-audio-recording';
const GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID = 'get-or-create-visit-label-pdf';
const CREATE_DISCHARGE_SUMMARY = 'create-discharge-summary';
const PAPERWORK_TO_PDF_ZAMBDA_ID = 'paperwork-to-pdf';
const VISIT_DETAILS_TO_PDF_ZAMBDA_ID = 'visit-details-to-pdf';
const PENDING_SUPERVISOR_APPROVAL_ZAMBDA_ID = 'pending-supervisor-approval';
const SEND_RECEIPT_BY_EMAIL_ZAMBDA_ID = 'send-receipt-by-email';
const BULK_UPDATE_INSURANCE_STATUS_ZAMBDA_ID = 'bulk-update-insurance-status';
const ADMIN_GET_QUICK_PICKS_ZAMBDA_ID = 'admin-get-quick-picks';
const ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID = 'admin-create-quick-pick';
const ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID = 'admin-update-quick-pick';
const UPDATE_INVOICE_TASK_ZAMBDA_ID = 'update-invoice-task';
const GET_PATIENT_BALANCES_ZAMBDA_ID = 'get-patient-balances';
const ADMIN_CREATE_TEMPLATE_ZAMBDA_ID = 'admin-create-template';
const ADMIN_RENAME_TEMPLATE_ZAMBDA_ID = 'admin-rename-template';
const ADMIN_DELETE_TEMPLATE_ZAMBDA_ID = 'admin-delete-template';
const ADMIN_GET_TEMPLATE_DETAIL_ZAMBDA_ID = 'admin-get-template-detail';
const ADMIN_LIST_IN_HOUSE_LABS_ZAMBDA_ID = 'admin-list-in-house-labs';
const ADMIN_ADD_IN_HOUSE_LAB_ZAMBDA_ID = 'admin-add-in-house-lab';
const ADMIN_GET_IN_HOUSE_LAB_CONFIG_ZAMBDA_ID = 'admin-get-in-house-lab-config';
const ADMIN_UPDATE_IN_HOUSE_LAB_ZAMBDA_ID = 'admin-update-in-house-lab';
const ADMIN_LIST_SERVICE_CATEGORIES_ZAMBDA_ID = 'admin-list-service-categories';
const ADMIN_CREATE_SERVICE_CATEGORY_ZAMBDA_ID = 'admin-create-service-category';
const ADMIN_UPDATE_SERVICE_CATEGORY_ZAMBDA_ID = 'admin-update-service-category';
const ADMIN_DELETE_SERVICE_CATEGORY_ZAMBDA_ID = 'admin-delete-service-category';
const ADMIN_CREATE_PRACTITIONER_ROLE_ZAMBDA_ID = 'admin-create-practitioner-role';
const ADMIN_UPDATE_PRACTITIONER_ROLE_ZAMBDA_ID = 'admin-update-practitioner-role';
const ADMIN_SET_PRACTITIONER_ROLE_ACTIVE_ZAMBDA_ID = 'admin-set-practitioner-role-active';
const GET_LABEL_PRINTING_CONFIG_ZAMBDA_ID = 'get-label-printing-config';
const ADMIN_UPDATE_LABEL_PRINTING_CONFIG_ZAMBDA_ID = 'admin-update-label-printing-config';
const GENERATE_LABEL_XML_ZAMBDA_ID = 'generate-label-xml';
const GET_SUPPORT_DIALOG_ZAMBDA_ID = 'get-support-dialog';
const GET_PUBLIC_LOCATION_SUPPORT_PHONES_ZAMBDA_ID = 'get-public-location-support-phones';
const ADMIN_UPDATE_SUPPORT_DIALOG_ZAMBDA_ID = 'admin-update-support-dialog';
const ADMIN_UPDATE_LOCATION_SUPPORT_PHONES_ZAMBDA_ID = 'admin-update-location-support-phones';
const ADMIN_GET_LAB_SETS = 'admin-get-lab-sets';
const ADMIN_ADD_LAB_SET = 'admin-add-lab-set';
const ADMIN_UPDATE_LAB_SET_ZAMBDA_ID = 'admin-update-lab-set';
const CREATE_CUSTOM_FOLDER_ZAMBDA_ID = 'create-custom-folder';
const RENAME_CUSTOM_FOLDER_ZAMBDA_ID = 'rename-custom-folder';
const DELETE_CUSTOM_FOLDER_ZAMBDA_ID = 'delete-custom-folder';

export const getUser = async (token: string): Promise<User> => {
  const oystehr = createClinicalOystehrClient(token);
  return oystehr.user.me();
};

if (!VITE_APP_IS_LOCAL) {
  throw new Error('VITE_APP_IS_LOCAL is not defined');
}

export const submitLabOrder = async (
  oystehr: Oystehr,
  parameters: SubmitLabOrderInput
): Promise<SubmitLabOrderOutput> => {
  try {
    if (SUBMIT_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('submit external lab order zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SUBMIT_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const uploadAudioRecording = async (
  oystehr: Oystehr,
  parameters: CreateUploadAudioRecordingInput
): Promise<CreateUploadAudioRecordingOutput> => {
  try {
    if (UPLOAD_AUDIO_RECORDING_ZAMBDA_ID == null) {
      throw new Error('upload audio recording zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UPLOAD_AUDIO_RECORDING_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createResourcesFromAudioRecording = async (
  oystehr: Oystehr,
  parameters: CreateResourcesFromAudioRecordingInput
): Promise<CreateResourcesFromAudioRecordingOutput> => {
  try {
    if (CREATE_RESOURCES_FROM_AUDIO_RECORDING_ZAMBDA_ID == null) {
      throw new Error('create resources from audio recording zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_RESOURCES_FROM_AUDIO_RECORDING_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getOrCreateVisitLabel = async (oystehr: Oystehr, parameters: GetVisitLabelInput): Promise<LabelPdf[]> => {
  try {
    if (GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID == null) {
      throw new Error('get-or-create-visit-label-pdf environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export const getAppointments = async (
  oystehr: Oystehr,
  parameters: GetAppointmentsZambdaInput
): Promise<GetAppointmentsZambdaOutput> => {
  try {
    if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
      throw new Error('get appointments environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_APPOINTMENTS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const generateAdHocReport = async (
  oystehr: Oystehr,
  parameters: GenerateAdHocReportInput
): Promise<GenerateAdHocReportOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GENERATE_ADHOC_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const inferAdHocReportLayers = async (
  oystehr: Oystehr,
  parameters: InferAdHocLayersInput
): Promise<InferAdHocLayersOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: INFER_ADHOC_REPORT_LAYERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getAdHocEncounters = async (
  oystehr: Oystehr,
  parameters: AdHocEncountersInput
): Promise<AdHocEncountersOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADHOC_ENCOUNTERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

const ADHOC_PATIENTS_ZAMBDA_ID = 'adhoc-patients';
export const getAdHocPatients = async (
  oystehr: Oystehr,
  parameters: AdHocPatientsInput
): Promise<AdHocPatientsOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADHOC_PATIENTS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

const ADHOC_BILLING_ZAMBDA_ID = 'adhoc-billing';
export const getAdHocBilling = async (oystehr: Oystehr, parameters: AdHocBillingInput): Promise<AdHocBillingOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADHOC_BILLING_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveAdHocReport = async (
  oystehr: Oystehr,
  parameters: SaveAdHocReportInput
): Promise<SaveAdHocReportOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: SAVE_ADHOC_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listAdHocReports = async (oystehr: Oystehr): Promise<ListAdHocReportsOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: LIST_ADHOC_REPORTS_ZAMBDA_ID });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteAdHocReport = async (
  oystehr: Oystehr,
  parameters: DeleteAdHocReportInput
): Promise<DeleteAdHocReportOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: DELETE_ADHOC_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getEncountersReport = async (
  oystehr: Oystehr,
  parameters: IncompleteEncountersReportZambdaInput
): Promise<IncompleteEncountersReportZambdaOutput> => {
  try {
    if (ENCOUNTERS_REPORT_ZAMBDA_ID == null) {
      throw new Error('encounters report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: ENCOUNTERS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getMailedStatementsReport = async (
  oystehr: Oystehr,
  parameters: MailedStatementsReportZambdaInput
): Promise<MailedStatementsReportZambdaOutput> => {
  try {
    if (MAILED_STATEMENTS_REPORT_ZAMBDA_ID == null) {
      throw new Error('mailed statements report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: MAILED_STATEMENTS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

export const syncMailedStatementStatuses = async (
  oystehr: Oystehr,
  batchSize?: number
): Promise<SyncMailedStatementStatusesOutput> => {
  try {
    if (SYNC_MAILED_STATEMENT_STATUSES_ZAMBDA_ID == null) {
      throw new Error('sync mailed statement statuses environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SYNC_MAILED_STATEMENT_STATUSES_ZAMBDA_ID,
      ...(batchSize != null && { batchSize }),
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

export const getAiAssistedEncountersReport = async (
  oystehr: Oystehr,
  parameters: AiAssistedEncountersReportZambdaInput
): Promise<AiAssistedEncountersReportZambdaOutput> => {
  try {
    if (AI_ASSISTED_ENCOUNTERS_REPORT_ZAMBDA_ID == null) {
      throw new Error('ai-assisted encounters report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: AI_ASSISTED_ENCOUNTERS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getDailyPaymentsReport = async (
  oystehr: Oystehr,
  parameters: DailyPaymentsReportZambdaInput
): Promise<DailyPaymentsReportZambdaOutput> => {
  try {
    if (DAILY_PAYMENTS_REPORT_ZAMBDA_ID == null) {
      throw new Error('daily payments report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: DAILY_PAYMENTS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getVisitsOverviewReport = async (
  oystehr: Oystehr,
  parameters: VisitsOverviewReportZambdaInput
): Promise<VisitsOverviewReportZambdaOutput> => {
  try {
    if (VISITS_OVERVIEW_REPORT_ZAMBDA_ID == null) {
      throw new Error('visits overview report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: VISITS_OVERVIEW_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getPracticeKpisReport = async (
  oystehr: Oystehr,
  parameters: PracticeKpisReportZambdaInput
): Promise<PracticeKpisReportZambdaOutput> => {
  try {
    if (PRACTICE_KPIS_REPORT_ZAMBDA_ID == null) {
      throw new Error('practice kpis report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: PRACTICE_KPIS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getRecentPatientsReport = async (
  oystehr: Oystehr,
  parameters: RecentPatientsReportZambdaInput
): Promise<RecentPatientsReportZambdaOutput> => {
  try {
    if (RECENT_PATIENTS_REPORT_ZAMBDA_ID == null) {
      throw new Error('recent patients report environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: RECENT_PATIENTS_REPORT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createAppointment = async (
  oystehr: Oystehr,
  parameters: CreateAppointmentInputParams
): Promise<CreateAppointmentResponse> => {
  try {
    if (CREATE_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('create appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveFollowup = async (
  oystehr: Oystehr,
  parameters: SaveFollowupEncounterZambdaInput
): Promise<SaveFollowupEncounterZambdaOutput> => {
  try {
    if (SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID == null) {
      throw new Error('save followup environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw new Error(JSON.stringify(error));
  }
};

export const cancelTelemedAppointment = async (
  oystehr: Oystehr,
  parameters: CancelTelemedAppointmentZambdaInput
): Promise<CancelTelemedAppointmentZambdaOutput> => {
  try {
    if (CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error, 'error');
    throw new Error(JSON.stringify(error));
  }
};

export const inviteParticipant = async (
  oystehr: Oystehr,
  parameters: InviteParticipantRequestParameters
): Promise<void> => {
  try {
    if (INVITE_PARTICIPANT_ZAMBDA_ID == null) {
      throw new Error('invite participant environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: INVITE_PARTICIPANT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error, 'Error occurred trying to invite participant');
    throw new Error(JSON.stringify(error));
  }
};

export const createUser = async (oystehr: Oystehr, parameters: CreateUserParams): Promise<CreateUserOutput> => {
  try {
    if (CREATE_USER_ZAMBDA_ID == null) {
      throw new Error('create user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const deleteUser = async (
  oystehr: Oystehr,
  parameters: DeleteUserZambdaInput
): Promise<DeleteUserZambdaOutput> => {
  try {
    if (DELETE_USER_ZAMBDA_ID == null) {
      throw new Error('delete-user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: DELETE_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

export const updateUser = async (oystehr: Oystehr, parameters: UpdateUserParams): Promise<UpdateUserZambdaOutput> => {
  try {
    if (UPDATE_USER_ZAMBDA_ID == null) {
      throw new Error('update user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UPDATE_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const assignPractitioner = async (
  oystehr: Oystehr,
  parameters: AssignPractitionerInput
): Promise<AssignPractitionerResponse> => {
  try {
    if (ASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
      throw new Error('assign practitioner environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: ASSIGN_PRACTITIONER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unassignPractitioner = async (
  oystehr: Oystehr,
  parameters: UnassignPractitionerZambdaInput
): Promise<UnassignPractitionerZambdaOutput> => {
  try {
    if (UNASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
      throw new Error('unassign practitioner environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UNASSIGN_PRACTITIONER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const changeInPersonVisitStatus = async (
  oystehr: Oystehr,
  parameters: ChangeInPersonVisitStatusInput
): Promise<ChangeInPersonVisitStatusResponse> => {
  try {
    if (CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID == null) {
      throw new Error('change in person visit status environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const getUserDetails = async (oystehr: Oystehr, parameters: GetUserParams): Promise<GetUserResponse> => {
  try {
    if (GET_USER_ZAMBDA_ID == null) {
      throw new Error('get user details environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const userActivation = async (
  oystehr: Oystehr,
  parameters: UserActivationZambdaInput
): Promise<UserActivationZambdaOutput> => {
  try {
    if (USER_ACTIVATION_ZAMBDA_ID == null) {
      throw new Error('user-activation environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: USER_ACTIVATION_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const getConversation = async (
  oystehr: Oystehr,
  parameters: GetConversationInput
): Promise<GetConversationZambdaOutput> => {
  try {
    if (GET_CONVERSATION_ZAMBDA_ID == null) {
      throw new Error('GET_CONVERSATION_ZAMBDA_ID environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_CONVERSATION_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const getLocations = async (
  oystehr: Oystehr,
  parameters: GetScheduleRequestParams
): Promise<GetScheduleResponse> => {
  try {
    if (GET_SCHEDULE_ZAMBDA_ID == null || VITE_APP_IS_LOCAL == null) {
      throw new Error('get location environment variable could not be loaded');
    }
    console.log(import.meta.env);
    const response = await oystehr.zambda.executePublic({
      id: GET_SCHEDULE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cancelAppointment = async (
  oystehr: Oystehr,
  parameters: CancelAppointmentZambdaInput
): Promise<CancelAppointmentZambdaOutput> => {
  try {
    if (CANCEL_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.executePublic({
      id: CANCEL_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getEmployees = async (oystehr: Oystehr, options?: { lite?: boolean }): Promise<GetEmployeesResponse> => {
  try {
    if (GET_EMPLOYEES_ZAMBDA_ID == null) {
      throw new Error('get employees environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_EMPLOYEES_ZAMBDA_ID,
      ...(options?.lite ? { lite: true } : {}),
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listScheduleOwners = async (
  params: ListScheduleOwnersParams,
  oystehr: Oystehr
): Promise<ListScheduleOwnersResponse> => {
  try {
    if (LIST_SCHEDULE_OWNERS_ZAMBDA_ID == null) {
      throw new Error('list-schedule-owners zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: LIST_SCHEDULE_OWNERS_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getSchedule = async (params: GetScheduleParams, oystehr: Oystehr): Promise<ScheduleDTO> => {
  try {
    if (EHR_GET_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('ehr-get-schedule zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: EHR_GET_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateSchedule = async (params: UpdateScheduleParams, oystehr: Oystehr): Promise<Schedule> => {
  try {
    if (UPDATE_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('update-schedule zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UPDATE_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createSchedule = async (params: CreateScheduleParams, oystehr: Oystehr): Promise<Schedule> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export type UploadPatientProfilePhotoParameters = Omit<UploadPatientProfilePhotoInput, 'action'> & {
  patientPhotoFile: File;
};

export const uploadPatientProfilePhoto = async (
  oystehr: Oystehr,
  parameters: UploadPatientProfilePhotoParameters
): Promise<GetOrUploadPatientProfilePhotoZambdaResponse> => {
  try {
    if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
      throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
    }

    const { patientPhotoFile, ...zambdaInput } = parameters;

    const urlSigningResponse = await oystehr.zambda.execute({
      id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID,
      ...zambdaInput,
      action: 'upload',
    });

    const { presignedImageUrl } = chooseJson(urlSigningResponse);

    const uploadResponse = await fetch(presignedImageUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': patientPhotoFile.type,
      },
      body: patientPhotoFile,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return chooseJson(urlSigningResponse);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export type GetPatientProfilePhotoParameters = Omit<DownloadPatientProfilePhotoInput, 'action'>;

export const getSignedPatientProfilePhotoUrl = async (
  oystehr: Oystehr,
  parameters: GetPatientProfilePhotoParameters
): Promise<GetOrUploadPatientProfilePhotoZambdaResponse> => {
  try {
    if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
      throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
    }

    const urlSigningResponse = await oystehr.zambda.execute({
      id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID,
      ...parameters,
      action: 'download',
    });

    return chooseJson(urlSigningResponse);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export const createExternalLabOrder = async (
  oystehr: Oystehr,
  parameters: CreateLabOrderParameters
): Promise<CreateLabOrderZambdaOutput> => {
  try {
    if (CREATE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('create external lab order environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getExternalLabOrders = async <RequestParameters extends GetLabOrdersParameters>(
  oystehr: Oystehr,
  parameters: RequestParameters
): Promise<PaginatedResponse<RequestParameters>> => {
  try {
    if (GET_LAB_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get external lab orders zambda environment variable could not be loaded');
    }
    const { searchBy } = parameters;
    if (!searchBy) {
      throw new Error(
        `Missing one of the required parameters (serviceRequestId | encounterId | patientId): ${JSON.stringify(
          parameters
        )}`
      );
    }
    const response = await oystehr.zambda.execute({
      id: GET_LAB_ORDERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteLabOrder = async (
  oystehr: Oystehr,
  parameters: DeleteLabOrderZambdaInput
): Promise<DeleteLabOrderZambdaOutput> => {
  try {
    if (DELETE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('delete lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DELETE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateLabOrderResources = async (
  oystehr: Oystehr,
  parameters: UpdateLabOrderResourcesInput
): Promise<any> => {
  try {
    if (UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID == null) {
      throw new Error('update lab order resources zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createRadiologyOrder = async (
  oystehr: Oystehr,
  parameters: CreateRadiologyZambdaOrderInput
): Promise<CreateRadiologyZambdaOrderOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-create-order',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cancelRadiologyOrder = async (
  oystehr: Oystehr,
  parameters: CancelRadiologyOrderZambdaInput
): Promise<CancelRadiologyOrderZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-cancel-order',
      ...parameters,
    });
    return response ? chooseJson(response) : {};
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const radiologyLaunchViewer = async (
  oystehr: Oystehr,
  parameters: RadiologyLaunchViewerZambdaInput
): Promise<RadiologyLaunchViewerZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-launch-viewer',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const savePreliminaryReport = async (
  oystehr: Oystehr,
  parameters: SaveRadiologyReportZambdaInput
): Promise<SaveRadiologyReportZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-save-preliminary-report',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveFinalReport = async (
  oystehr: Oystehr,
  parameters: SaveRadiologyReportZambdaInput
): Promise<SaveRadiologyReportZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-save-final-report',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const sendForFinalRead = async (
  oystehr: Oystehr,
  parameters: SendForFinalReadZambdaInput
): Promise<SendForFinalReadZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-send-for-final-read',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getRadiologyOrders = async (
  oystehr: Oystehr,
  parameters: GetRadiologyOrderListZambdaInput
): Promise<GetRadiologyOrderListZambdaOutput> => {
  try {
    const searchBy = parameters.encounterIds || parameters.patientId || parameters.serviceRequestId;
    if (!searchBy) {
      throw new Error(
        `Missing one of the required parameters (serviceRequestId | encounterId | patientId): ${JSON.stringify(
          parameters
        )}`
      );
    }
    const response = await oystehr.zambda.execute({
      id: 'radiology-order-list',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createSlot = async (input: CreateSlotParams, oystehr: Oystehr): Promise<Slot> => {
  try {
    const response = await oystehr.zambda.executePublic({ id: CREATE_SLOT_ZAMBDA_ID, ...input });
    const jsonToUse = chooseJson(response);
    return jsonToUse;
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

export const createInHouseLabOrder = async (
  oystehr: Oystehr,
  parameters: CreateInHouseLabOrderParameters
): Promise<CreateInHouseLabOrderResponse> => {
  try {
    if (CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('create in house lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getInHouseOrders = async <RequestParameters extends GetInHouseOrdersParameters>(
  oystehr: Oystehr,
  parameters: RequestParameters
): Promise<InHouseGetOrdersResponseDTO<RequestParameters>> => {
  try {
    if (GET_IN_HOUSE_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get in house orders zambda environment variable could not be loaded');
    }
    const { searchBy } = parameters;
    if (!searchBy) {
      throw new Error(
        `Missing one of the required parameters (serviceRequestId | encounterId | patientId): ${JSON.stringify(
          parameters
        )}`
      );
    }
    const response = await oystehr.zambda.execute({
      id: GET_IN_HOUSE_ORDERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const collectInHouseLabSpecimen = async (
  oystehr: Oystehr,
  parameters: CollectInHouseLabSpecimenParameters
): Promise<CollectInHouseLabSpecimenZambdaOutput> => {
  try {
    if (COLLECT_IN_HOUSE_LAB_SPECIMEN == null) {
      throw new Error('collect in house lab specimen zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: COLLECT_IN_HOUSE_LAB_SPECIMEN,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const handleInHouseLabResults = async (
  oystehr: Oystehr,
  parameters: HandleInHouseLabResultsParameters
): Promise<HandleInHouseLabResultsZambdaOutput> => {
  try {
    if (HANDLE_IN_HOUSE_LAB_RESULTS == null) {
      throw new Error('handle in house lab results zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: HANDLE_IN_HOUSE_LAB_RESULTS,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteInHouseLabOrder = async (
  oystehr: Oystehr,
  parameters: DeleteInHouseLabOrderParameters
): Promise<DeleteInHouseLabOrderZambdaOutput> => {
  try {
    if (DELETE_IN_HOUSE_LAB_ORDER == null) {
      throw new Error('delete in house lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DELETE_IN_HOUSE_LAB_ORDER,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createInHouseMedication = async (
  oystehr: Oystehr,
  parameters: CreateInHouseMedicationInput
): Promise<Medication> => {
  try {
    if (CREATE_IN_HOUSE_MEDICATION == null) {
      throw new Error('create in house medication zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_IN_HOUSE_MEDICATION,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateInHouseMedication = async (
  oystehr: Oystehr,
  parameters: UpdateInHouseMedicationInput
): Promise<Medication> => {
  try {
    if (UPDATE_IN_HOUSE_MEDICATION == null) {
      throw new Error('update in house medication zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: UPDATE_IN_HOUSE_MEDICATION,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getInHouseMedications = async (oystehr: Oystehr): Promise<Medication[]> => {
  try {
    if (GET_IN_HOUSE_MEDICATIONS == null) {
      throw new Error('get in house medications zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: GET_IN_HOUSE_MEDICATIONS,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getEmCodes = async (oystehr: Oystehr): Promise<EmCodeOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: GET_EM_CODES });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createEmCode = async (oystehr: Oystehr, parameters: CreateEmCodeInput): Promise<EmCodeOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_EM_CODE,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateEmCode = async (oystehr: Oystehr, parameters: UpdateEmCodeInput): Promise<EmCodeOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: UPDATE_EM_CODE,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteEmCode = async (oystehr: Oystehr, parameters: DeleteEmCodeInput): Promise<EmCodeOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: DELETE_EM_CODE,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getNursingOrders = async (oystehr: Oystehr, parameters: GetNursingOrdersInput): Promise<any> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_NURSING_ORDERS_ZAMBDA_ID,
      ...parameters,
    });

    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createNursingOrder = async (oystehr: Oystehr, parameters: CreateNursingOrderInput): Promise<any> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_NURSING_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateNursingOrder = async (oystehr: Oystehr, parameters: UpdateNursingOrderInput): Promise<any> => {
  try {
    const response = await oystehr.zambda.execute({
      id: UPDATE_NURSING_ORDER,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createDischargeSummary = async (
  oystehr: Oystehr,
  parameters: CreateDischargeSummaryInput
): Promise<CreateDischargeSummaryResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_DISCHARGE_SUMMARY,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const generatePaperworkPdf = async (
  oystehr: Oystehr,
  parameters: PaperworkToPDFInput
): Promise<{ documentReference: string }> => {
  try {
    const response = await oystehr.zambda.execute({
      id: PAPERWORK_TO_PDF_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getOrCreateVisitDetailsPdf = async (
  oystehr: Oystehr,
  parameters: GetVisitDetailsPDFInput
): Promise<{ documentReference: string }> => {
  try {
    const response = await oystehr.zambda.execute({
      id: VISIT_DETAILS_TO_PDF_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listTemplates = async (
  oystehr: Oystehr,
  parameters: ListTemplatesZambdaInput
): Promise<ListTemplatesZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'list-templates',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const applyTemplate = async (
  oystehr: Oystehr,
  parameters: ApplyTemplateZambdaInput
): Promise<ApplyTemplateZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'apply-template',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deletePatientDocument = async (
  oystehr: Oystehr,
  parameters: DeletePatientDocumentInput
): Promise<DeletePatientDocumentOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'delete-patient-document',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getPatientMedicalRecordZip = async (
  oystehr: Oystehr,
  parameters: GetPatientMedicalRecordInput
): Promise<GetPatientMedicalRecordOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'get-patient-medical-record',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const uploadPatientConditionPhoto = async (
  oystehr: Oystehr,
  parameters: UploadPatientConditionPhotoInput
): Promise<UploadPatientConditionPhotoOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'upload-patient-condition-photo',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const uploadDotVisionDocument = async (
  oystehr: Oystehr,
  parameters: UploadDotVisionDocumentInput
): Promise<UploadDotVisionDocumentOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'upload-dot-vision-document',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const pendingSupervisorApproval = async (
  oystehr: Oystehr,
  parameters: PendingSupervisorApprovalInput
): Promise<any> => {
  try {
    const response = await oystehr.zambda.execute({
      id: PENDING_SUPERVISOR_APPROVAL_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const unlockAppointment = async (
  oystehr: Oystehr,
  parameters: { appointmentId?: string; encounterId?: string }
): Promise<{ message: string }> => {
  try {
    if (UNLOCK_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('unlock appointment zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: UNLOCK_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const sendReceiptByEmail = async (
  oystehr: Oystehr,
  parameters: SendReceiptByEmailZambdaInput
): Promise<SendReceiptByEmailZambdaOutput> => {
  try {
    if (SEND_RECEIPT_BY_EMAIL_ZAMBDA_ID == null) {
      throw new Error('send receipt by email zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: SEND_RECEIPT_BY_EMAIL_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getPatientVisitFiles = async (
  oystehr: Oystehr,
  parameters: { appointmentId: string }
): Promise<VisitDocuments> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'get-visit-files',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getPatientVisitDetails = async (
  oystehr: Oystehr,
  parameters: { appointmentId: string }
): Promise<EHRVisitDetails> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'ehr-get-visit-details',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getVisitFaxHistory = async (
  oystehr: Oystehr,
  parameters: GetVisitFaxHistoryInput
): Promise<GetVisitFaxHistoryOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'get-visit-fax-history',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updatePatientVisitDetails = async (
  oystehr: Oystehr,
  parameters: UpdateVisitDetailsInput
): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: 'ehr-update-visit-details',
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateVisitFiles = async (oystehr: Oystehr, parameters: UpdateVisitFilesInput): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: 'update-visit-files',
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteVisitFiles = async (oystehr: Oystehr, parameters: DeleteVisitFilesInput): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: 'delete-visit-files',
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const bulkUpdateInsuranceStatus = async (
  oystehr: Oystehr,
  parameters: BulkUpdateInsuranceStatusInput
): Promise<BulkUpdateInsuranceStatusResponse> => {
  try {
    if (BULK_UPDATE_INSURANCE_STATUS_ZAMBDA_ID == null) {
      throw new Error('bulk update insurance status zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: BULK_UPDATE_INSURANCE_STATUS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

const getPresignedFileURL = async (
  params: GetPresignedFileURLInput,
  oystehr: Oystehr
): Promise<PresignUploadUrlResponse> => {
  try {
    const { appointmentID, fileType, fileFormat } = params;

    const response = await oystehr.zambda.executePublic({
      id: 'get-presigned-file-url',
      appointmentID,
      fileType,
      fileFormat,
    });
    const jsonToUse = chooseJson(response);
    return jsonToUse;
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

interface CreateZ3ObjectParams {
  appointmentID: string;
  fileType: GetPresignedFileURLInput['fileType'];
  fileFormat: GetPresignedFileURLInput['fileFormat'];
  file: File;
}

export const createZ3Object = async (input: CreateZ3ObjectParams, oystehr: Oystehr): Promise<string> => {
  const { appointmentID, fileType, fileFormat, file } = input;
  try {
    const presignedURLRequest = await getPresignedFileURL(
      {
        appointmentID,
        fileType,
        fileFormat,
      },
      oystehr
    );

    const uploadResponse = await fetch(presignedURLRequest.presignedURL, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return presignedURLRequest.z3URL;
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};

export const updateInvoiceTask = async (oystehr: Oystehr, parameters: UpdateInvoiceTaskZambdaInput): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: UPDATE_INVOICE_TASK_ZAMBDA_ID,
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getPatientBalances = async (
  oystehr: Oystehr,
  parameters: GetPatientBalancesZambdaInput
): Promise<GetPatientBalancesZambdaOutput> => {
  try {
    if (GET_PATIENT_BALANCES_ZAMBDA_ID == null) {
      throw new Error('get patient balances environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_PATIENT_BALANCES_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getPatientLoginPhoneNumbers = async (
  oystehr: Oystehr,
  parameters: GetPatientLoginPhoneNumbersInput
): Promise<GetPatientLoginPhoneNumbersOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'get-login-phone-numbers',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const updatePatientLoginPhoneNumbers = async (
  oystehr: Oystehr,
  parameters: UpdatePatientLoginPhoneNumbersInput
): Promise<void> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'update-login-phone-numbers',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminListInHouseLabs = async (oystehr: Oystehr): Promise<AdminListInHouseLabsOutput> => {
  try {
    if (ADMIN_LIST_IN_HOUSE_LABS_ZAMBDA_ID == null) {
      throw new Error('admin list in house labs environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: ADMIN_LIST_IN_HOUSE_LABS_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminAddInHouseLab = async (
  oystehr: Oystehr,
  parameters: AdminAddInHouseLabInput
): Promise<AdminAddInHouseLabOutput> => {
  try {
    if (ADMIN_ADD_IN_HOUSE_LAB_ZAMBDA_ID == null) {
      throw new Error('admin add in house labs environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_ADD_IN_HOUSE_LAB_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminGetInHouseLabConfig = async (
  oystehr: Oystehr,
  parameters: AdminGetInHouseLabConfigInput
): Promise<AdminInHouseLabConfigOutput> => {
  try {
    if (ADMIN_GET_IN_HOUSE_LAB_CONFIG_ZAMBDA_ID == null) {
      throw new Error('admin get in house lab config environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_IN_HOUSE_LAB_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateInHouseLab = async (
  oystehr: Oystehr,
  parameters: AdminUpdateInHouseLabInput
): Promise<AdminInHouseLabConfigOutput> => {
  try {
    if (ADMIN_UPDATE_IN_HOUSE_LAB_ZAMBDA_ID == null) {
      throw new Error('admin update in house labs environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_IN_HOUSE_LAB_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export function adminGetLabSets(oystehr: Oystehr): Promise<AdminGetLabSetListOutput>;

export function adminGetLabSets(
  oystehr: Oystehr,
  parameters: AdminGetLabSetDetailInput
): Promise<AdminGetLabSetDetailOutput>;

export async function adminGetLabSets(
  oystehr: Oystehr,
  parameters?: AdminGetLabSetDetailInput
): Promise<AdminGetLabSetListOutput | AdminGetLabSetDetailOutput> {
  try {
    if (ADMIN_GET_LAB_SETS == null) {
      throw new Error('admin get lab sets environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_LAB_SETS,
      ...(parameters ?? {}),
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
}

export const adminAddLabSet = async (
  oystehr: Oystehr,
  parameters: AdminAddLabSetInput
): Promise<AdminAddLabSetOutput> => {
  try {
    if (ADMIN_ADD_LAB_SET == null) {
      throw new Error('admin add lab set environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_ADD_LAB_SET,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateLabSet = async (oystehr: Oystehr, parameters: AdminUpdateLabSetInput): Promise<void> => {
  try {
    if (ADMIN_UPDATE_LAB_SET_ZAMBDA_ID == null) {
      throw new Error('admin update lab set environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_LAB_SET_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getLabelPrintingConfig = async (
  oystehr: Oystehr,
  parameters: GetLabelPrintingConfigInput
): Promise<GetLabelPrintingConfigOutput> => {
  try {
    if (GET_LABEL_PRINTING_CONFIG_ZAMBDA_ID == null) {
      throw new Error('get label printing config environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: GET_LABEL_PRINTING_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateLabelPrintingConfig = async (
  oystehr: Oystehr,
  parameters: AdminUpdatePrintingConfigInput
): Promise<void> => {
  try {
    if (ADMIN_UPDATE_LABEL_PRINTING_CONFIG_ZAMBDA_ID == null) {
      throw new Error('admin update label printing config environment variable could not be loaded');
    }
    await oystehr.zambda.execute({
      id: ADMIN_UPDATE_LABEL_PRINTING_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getSupportDialog = async (oystehr: Oystehr): Promise<GetSupportDialogOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: GET_SUPPORT_DIALOG_ZAMBDA_ID });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getProgressNoteConfig = async (
  oystehr: Oystehr,
  parameters?: GetProgressNoteConfigInput
): Promise<GetProgressNoteConfigOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'get-progress-note-config',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateProgressNoteConfig = async (
  oystehr: Oystehr,
  parameters: UpdateProgressNoteConfigInput
): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: 'admin-update-progress-note-config',
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getPublicLocationSupportPhones = async (oystehr: Oystehr): Promise<GetLocationSupportPhonesOutput> => {
  try {
    const response = await oystehr.zambda.executePublic({ id: GET_PUBLIC_LOCATION_SUPPORT_PHONES_ZAMBDA_ID });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateSupportDialog = async (
  oystehr: Oystehr,
  parameters: AdminUpdateSupportDialogInput
): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: ADMIN_UPDATE_SUPPORT_DIALOG_ZAMBDA_ID,
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const adminUpdateLocationSupportPhones = async (
  oystehr: Oystehr,
  parameters: AdminUpdateLocationSupportPhonesInput
): Promise<void> => {
  try {
    await oystehr.zambda.execute({
      id: ADMIN_UPDATE_LOCATION_SUPPORT_PHONES_ZAMBDA_ID,
      ...parameters,
    });
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const generateLabelXml = async (
  oystehr: Oystehr,
  parameters: OnDemandLabelXmlRequestInput
): Promise<OnDemandLabelXmlRequestOutput> => {
  try {
    if (GENERATE_LABEL_XML_ZAMBDA_ID == null) {
      throw new Error('generate label xml environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: GENERATE_LABEL_XML_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

// ── Legacy Records ─────────────────────────────────────────────────────────────

export const searchLegacyRecords = async (
  oystehr: Oystehr,
  parameters: SearchLegacyRecordsInput
): Promise<SearchLegacyRecordsOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'ehr-search-legacy-records',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const createTemplate = async (
  oystehr: Oystehr,
  parameters: AdminCreateTemplateInput
): Promise<AdminCreateTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_TEMPLATE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as AdminCreateTemplateOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const getProcedureQuickPicks = async (oystehr: Oystehr): Promise<GetProcedureQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'procedure-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createProcedureQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateProcedureQuickPickInput
): Promise<CreateProcedureQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'procedure-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateProcedureQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<ProcedureQuickPickData, 'id'>
): Promise<UpdateProcedureQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'procedure-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Radiology Quick Picks ──

export const getRadiologyQuickPicks = async (oystehr: Oystehr): Promise<GetRadiologyQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'radiology-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const renameTemplate = async (
  oystehr: Oystehr,
  parameters: AdminRenameTemplateInput
): Promise<AdminRenameTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_RENAME_TEMPLATE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as AdminRenameTemplateOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const createRadiologyQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateRadiologyQuickPickInput
): Promise<CreateRadiologyQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'radiology-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteTemplate = async (
  oystehr: Oystehr,
  parameters: AdminDeleteTemplateInput
): Promise<AdminDeleteTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_DELETE_TEMPLATE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as AdminDeleteTemplateOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const updateRadiologyQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<RadiologyQuickPickData, 'id'>
): Promise<UpdateRadiologyQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'radiology-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getTemplateDetail = async (
  oystehr: Oystehr,
  parameters: AdminGetTemplateDetailInput
): Promise<AdminGetTemplateDetailOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_TEMPLATE_DETAIL_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson<AdminGetTemplateDetailOutput>(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

// ── Allergy Quick Picks ──

export const getAllergyQuickPicks = async (oystehr: Oystehr): Promise<GetAllergyQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'allergy-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createAllergyQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateAllergyQuickPickInput
): Promise<CreateAllergyQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'allergy-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateAllergyQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<AllergyQuickPickData, 'id'>
): Promise<UpdateAllergyQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'allergy-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Medical Condition Quick Picks ──

export const getMedicalConditionQuickPicks = async (
  oystehr: Oystehr
): Promise<GetMedicalConditionQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'medical-condition-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createMedicalConditionQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateMedicalConditionQuickPickInput
): Promise<CreateMedicalConditionQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'medical-condition-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateMedicalConditionQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<MedicalConditionQuickPickData, 'id'>
): Promise<UpdateMedicalConditionQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'medical-condition-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Medication History Quick Picks ──

export const getMedicationHistoryQuickPicks = async (
  oystehr: Oystehr
): Promise<GetMedicationHistoryQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'medication-history-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createMedicationHistoryQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateMedicationHistoryQuickPickInput
): Promise<CreateMedicationHistoryQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'medication-history-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateMedicationHistoryQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<MedicationHistoryQuickPickData, 'id'>
): Promise<UpdateMedicationHistoryQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'medication-history-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Insurance Quick Picks ──

export const getInsuranceQuickPicks = async (oystehr: Oystehr): Promise<GetInsuranceQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'insurance-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createInsuranceQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateInsuranceQuickPickInput
): Promise<CreateInsuranceQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'insurance-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateInsuranceQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<InsuranceQuickPickData, 'id'>
): Promise<UpdateInsuranceQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'insurance-quick-pick',
      quickPickId,
      quickPick,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Immunization Quick Picks ──

export const getImmunizationQuickPicks = async (oystehr: Oystehr): Promise<GetImmunizationQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'immunization-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createImmunizationQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateImmunizationQuickPickInput
): Promise<CreateImmunizationQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'immunization-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateImmunizationQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<ImmunizationQuickPickData, 'id'>
): Promise<UpdateImmunizationQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'immunization-quick-pick',
      quickPickId,
      quickPick,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── In-House Medication Quick Picks ──

export const getInHouseMedicationQuickPicks = async (
  oystehr: Oystehr
): Promise<GetInHouseMedicationQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'in-house-medication-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createInHouseMedicationQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateInHouseMedicationQuickPickInput
): Promise<CreateInHouseMedicationQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'in-house-medication-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateInHouseMedicationQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<InHouseMedicationQuickPickData, 'id'>
): Promise<UpdateInHouseMedicationQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'in-house-medication-quick-pick',
      quickPickId,
      quickPick,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

// ── Patient Instruction Quick Picks (Practice Quick Picks) ──

export const getPatientInstructionQuickPicks = async (
  oystehr: Oystehr
): Promise<GetPatientInstructionQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'patient-instruction-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createPatientInstructionQuickPick = async (
  oystehr: Oystehr,
  parameters: CreatePatientInstructionQuickPickInput
): Promise<CreatePatientInstructionQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'patient-instruction-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updatePatientInstructionQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<PatientInstructionQuickPickData, 'id'>
): Promise<UpdatePatientInstructionQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'patient-instruction-quick-pick',
      quickPickId,
      quickPick,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createCustomFolder = async (
  oystehr: Oystehr,
  parameters: CreateCustomFolderInput
): Promise<CreateCustomFolderOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_CUSTOM_FOLDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as CreateCustomFolderOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const renameCustomFolder = async (
  oystehr: Oystehr,
  parameters: RenameCustomFolderInput
): Promise<RenameCustomFolderOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: RENAME_CUSTOM_FOLDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as RenameCustomFolderOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

export const deleteCustomFolder = async (
  oystehr: Oystehr,
  parameters: DeleteCustomFolderInput
): Promise<DeleteCustomFolderOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: DELETE_CUSTOM_FOLDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response) as DeleteCustomFolderOutput;
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

// ── Quick Text Quick Picks ──

export const getQuickTextQuickPicks = async (oystehr: Oystehr): Promise<GetQuickTextQuickPicksResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_GET_QUICK_PICKS_ZAMBDA_ID,
      category: 'quick-text-quick-pick',
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createQuickTextQuickPick = async (
  oystehr: Oystehr,
  parameters: CreateQuickTextQuickPickInput
): Promise<CreateQuickTextQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_CREATE_QUICK_PICK_ZAMBDA_ID,
      category: 'quick-text-quick-pick',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateQuickTextQuickPick = async (
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<QuickTextQuickPickData, 'id'>
): Promise<UpdateQuickTextQuickPickResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADMIN_UPDATE_QUICK_PICK_ZAMBDA_ID,
      category: 'quick-text-quick-pick',
      quickPickId,
      quickPick,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

const MIGRATE_EXAM_DATA_ZAMBDA_ID = 'migrate-exam-data';

export const migrateExamData = async (
  oystehr: Oystehr,
  parameters: MigrateExamDataInput
): Promise<MigrateExamDataOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: MIGRATE_EXAM_DATA_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw apiErrorToThrow(error);
  }
};

// ── Service Categories (FHIR-backed bookable appointment categories) ──

export interface ServiceCategoryRuntimeConfig {
  durationMinutes: number;
  /**
   * Interval between offered slot start times, in minutes. Independent of durationMinutes (a
   * 60-min service may be offered every 30 min). Omitted → generator default (typically 15).
   */
  cadenceMinutes?: number;
  serviceModes: Array<'in-person' | 'virtual'>;
  /** Booking flows for this category — 'prebook' vs 'walk-in'. */
  visitTypes: Array<'prebook' | 'walk-in'>;
  reasonsForVisit?: Array<{ label: string; value: string }>;
}

export interface ServiceCategory {
  id?: string;
  name: string;
  code: string;
  /** Short abbreviation (2-3 chars) shown on the Tracking Board and patient visit lists — e.g. 'UC', 'WC'. */
  abbreviation?: string;
  active: boolean;
  config: ServiceCategoryRuntimeConfig;
}

export const listServiceCategories = async (oystehr: Oystehr): Promise<{ serviceCategories: ServiceCategory[] }> => {
  const response = await oystehr.zambda.execute({ id: ADMIN_LIST_SERVICE_CATEGORIES_ZAMBDA_ID });
  return chooseJson(response);
};

export const createServiceCategory = async (
  oystehr: Oystehr,
  serviceCategory: ServiceCategory
): Promise<{ serviceCategory: ServiceCategory }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_CREATE_SERVICE_CATEGORY_ZAMBDA_ID,
    serviceCategory,
  } as any);
  return chooseJson(response);
};

export const updateServiceCategory = async (
  oystehr: Oystehr,
  serviceCategory: ServiceCategory
): Promise<{ serviceCategory: ServiceCategory }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_UPDATE_SERVICE_CATEGORY_ZAMBDA_ID,
    serviceCategory,
  } as any);
  return chooseJson(response);
};

export const deleteServiceCategory = async (
  oystehr: Oystehr,
  serviceCategoryId: string
): Promise<{ message: string }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_DELETE_SERVICE_CATEGORY_ZAMBDA_ID,
    serviceCategoryId,
  } as any);
  return chooseJson(response);
};

export const createPractitionerRole = async (
  oystehr: Oystehr,
  input: {
    practitionerId: string;
    locationId: string;
    categoryHealthcareServiceIds: string[];
    timezone: string;
    /** Optional admin-set display name for the new schedule. */
    displayName?: string;
    /** Whether the role offers every service category in the system. Defaults to false. */
    allCategories?: boolean;
  }
): Promise<{ role: PractitionerRole; schedule: Schedule }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_CREATE_PRACTITIONER_ROLE_ZAMBDA_ID,
    ...input,
  } as any);
  return chooseJson(response);
};

export const updatePractitionerRole = async (
  oystehr: Oystehr,
  input: {
    roleId: string;
    categoryHealthcareServiceIds?: string[];
    locationId?: string;
    /** Optional admin-set display name. Empty string clears the override. */
    displayName?: string;
    /** Whether the role offers every service category. Omit to leave untouched. */
    allCategories?: boolean;
  }
): Promise<{ role: PractitionerRole }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_UPDATE_PRACTITIONER_ROLE_ZAMBDA_ID,
    ...input,
  } as any);
  return chooseJson(response);
};

export const setPractitionerRoleActive = async (
  oystehr: Oystehr,
  input: { roleId: string; active: boolean }
): Promise<{ active: boolean }> => {
  const response = await oystehr.zambda.execute({
    id: ADMIN_SET_PRACTITIONER_ROLE_ACTIVE_ZAMBDA_ID,
    ...input,
  } as any);
  return chooseJson(response);
};

export const removeQuickPick = async (oystehr: Oystehr, quickPickId: string): Promise<QuickPickRemoveResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'admin-remove-quick-pick',
      quickPickId,
    } as any);
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
