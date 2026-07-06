import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import {
  AISuggestionNotes,
  AISuggestionNotesInput,
  AssignPractitionerInput,
  AssignPractitionerResponse,
  BillingSuggestionInput,
  BillingSuggestionOutput,
  ChangeInPersonVisitStatusInput,
  ChangeInPersonVisitStatusResponse,
  CommunicationDTO,
  DeleteApprovedPatientEducationInput,
  DeleteApprovedPatientEducationOutput,
  DeleteChartDataRequest,
  DeleteChartDataResponse,
  DeletePatientInstructionInput,
  GeneratePatientEducationInput,
  GeneratePatientEducationOutput,
  GetChartDataRequest,
  GetChartDataResponse,
  GetCreateInHouseLabOrderResourcesInput,
  GetCreateInHouseLabOrderResourcesOutput,
  GetCreateLabOrderResources,
  GetMedicationOrdersInput,
  GetMedicationOrdersResponse,
  GetMergePatientsTaskInput,
  GetMergePatientsTaskResponse,
  getOystehrApiHelpers,
  GetPatientAccountZambdaInput,
  GetPatientInstructionsInput,
  GetUnsolicitedResultsResourcesInput,
  GetUnsolicitedResultsResourcesOutput,
  InitTelemedSessionRequestParams,
  InitTelemedSessionResponse,
  LabOrderResourcesRes,
  ListApprovedPatientEducationOutput,
  MakeMedicationHistoryPdfZambdaInput,
  MakeMedicationHistoryPdfZambdaOutput,
  MergePatientsInput,
  MergePatientsResponse,
  OrderedCoveragesWithSubscribers,
  PatientAccountResponse,
  PatientEducationLanguage,
  ProcedureDetail,
  ProcedureSuggestion,
  RemoveCoverageResponse,
  RemoveCoverageZambdaInput,
  SaveApprovedPatientEducationInput,
  SaveApprovedPatientEducationOutput,
  SaveChartDataRequest,
  SaveChartDataResponse,
  SavePatientEducationPdfInput,
  SavePatientEducationPdfOutput,
  SavePatientInstructionInput,
  SearchPlacesInput,
  SearchPlacesOutput,
  SendFaxZambdaInput,
  SignAppointmentInput,
  SignAppointmentResponse,
  SyncUserResponse,
  UnassignPractitionerZambdaInput,
  UnassignPractitionerZambdaOutput,
  UnlockAppointmentZambdaInputValidated,
  UnlockAppointmentZambdaOutput,
  UpdateApprovedPatientEducationCodesInput,
  UpdateApprovedPatientEducationCodesOutput,
  UpdateLabOrderResourcesInput,
  UpdateMedicationOrderInput,
  UpdatePatientAccountInput,
  UpdatePatientAccountResponse,
} from 'utils';
import { GetOystehrTelemedAPIParams } from './types';

enum ZambdaNames {
  'init telemed session' = 'init telemed session',
  'get chart data' = 'get chart data',
  'save chart data' = 'save chart data',
  'delete chart data' = 'delete chart data',
  'change in person visit status' = 'change in person visit status',
  'assign practitioner' = 'assign practitioner',
  'unassign practitioner' = 'unassign practitioner',
  'sign appointment' = 'sign appointment',
  'unlock appointment' = 'unlock appointment',
  'sync user' = 'sync user',
  'get patient instructions' = 'get patient instructions',
  'save patient instruction' = 'save patient instruction',
  'delete patient instruction' = 'delete patient instruction',
  'icd search' = 'icd search',
  'ai suggestion notes' = 'ai suggestion notes',
  'recommend billing suggestions' = 'recommend billing suggestions',
  'recommend billing codes' = 'recommend billing codes',
  'create update medication order' = 'create update medication order',
  'get medication orders' = 'get medication orders',
  'create update patient followup' = 'create update patient followup',
  'get patient account' = 'get patient account',
  'update patient account' = 'update patient account',
  'remove patient coverage' = 'remove patient coverage',
  'merge patients' = 'merge patients',
  'send fax' = 'send fax',
  'external lab resource search' = 'external lab resource search',
  'get unsolicited results resources' = 'get unsolicited results resources',
  'update lab order resources' = 'update lab order resources',
  'search places' = 'search places',
  'inhouse lab resource search' = 'inhouse lab resource search',
  'make medication history pdf' = 'make medication history pdf',
  'generate patient education' = 'generate patient education',
  'save patient education pdf' = 'save patient education pdf',
  'list approved patient education' = 'list approved patient education',
  'save approved patient education' = 'save approved patient education',
  'delete approved patient education' = 'delete approved patient education',
  'update approved patient education codes' = 'update approved patient education codes',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'init telemed session': false,
  'get chart data': false,
  'save chart data': false,
  'delete chart data': false,
  'change in person visit status': false,
  'assign practitioner': false,
  'unassign practitioner': false,
  'sign appointment': false,
  'unlock appointment': false,
  'sync user': false,
  'get patient instructions': false,
  'save patient instruction': false,
  'delete patient instruction': false,
  'icd search': false,
  'ai suggestion notes': false,
  'recommend billing suggestions': false,
  'recommend billing codes': false,
  'create update medication order': false,
  'get medication orders': false,
  'create update patient followup': false,
  'get patient account': false,
  'update patient account': false,
  'remove patient coverage': false,
  'merge patients': false,
  'send fax': false,
  'external lab resource search': false,
  'get unsolicited results resources': false,
  'update lab order resources': false,
  'search places': false,
  'inhouse lab resource search': false,
  'make medication history pdf': false,
  'generate patient education': false,
  'save patient education pdf': false,
  'list approved patient education': false,
  'save approved patient education': false,
  'delete approved patient education': false,
  'update approved patient education codes': false,
};

export type OystehrTelemedAPIClient = ReturnType<typeof getOystehrTelemedAPI>;

type SaveApprovedPatientEducationWithLanguageInput = SaveApprovedPatientEducationInput & {
  language?: PatientEducationLanguage;
};

export const getOystehrTelemedAPI = (
  params: GetOystehrTelemedAPIParams,
  oystehr: Oystehr
): {
  initTelemedSession: typeof initTelemedSession;
  getChartData: typeof getChartData;
  saveChartData: typeof saveChartData;
  deleteChartData: typeof deleteChartData;
  changeInPersonVisitStatus: typeof changeInPersonVisitStatus;
  assignPractitioner: typeof assignPractitioner;
  unassignPractitioner: typeof unassignPractitioner;
  signAppointment: typeof signAppointment;
  unlockAppointment: typeof unlockAppointment;
  syncUser: typeof syncUser;
  getPatientInstructions: typeof getPatientInstructions;
  savePatientInstruction: typeof savePatientInstruction;
  deletePatientInstruction: typeof deletePatientInstruction;
  aiSuggestionNotes: typeof aiSuggestionNotes;
  recommendBillingSuggestions: typeof recommendBillingSuggestions;
  recommendBillingCodes: typeof recommendBillingCodes;
  createUpdateMedicationOrder: typeof createUpdateMedicationOrder;
  getMedicationOrders: typeof getMedicationOrders;
  savePatientFollowup: typeof savePatientFollowup;
  getPatientAccount: typeof getPatientAccount;
  updatePatientAccount: typeof updatePatientAccount;
  getPatientCoverages: typeof getPatientCoverages;
  removePatientCoverage: typeof removePatientCoverage;
  mergePatients: typeof mergePatients;
  getMergePatientsTask: typeof getMergePatientsTask;
  sendFax: typeof sendFax;
  getCreateExternalLabResources: typeof getCreateExternalLabResources;
  getUnsolicitedResultsResources: typeof getUnsolicitedResultsResources;
  updateLabOrderResources: typeof updateLabOrderResources;
  searchPlaces: typeof searchPlaces;
  getCreateInHouseLabOrderResources: typeof getCreateInHouseLabOrderResources;
  makeMedicationHistoryPdf: typeof makeMedicationHistoryPdf;
  generatePatientEducation: typeof generatePatientEducation;
  savePatientEducationPdf: typeof savePatientEducationPdf;
  listApprovedPatientEducation: typeof listApprovedPatientEducation;
  saveApprovedPatientEducation: typeof saveApprovedPatientEducation;
  deleteApprovedPatientEducation: typeof deleteApprovedPatientEducation;
  updateApprovedPatientEducationCodes: typeof updateApprovedPatientEducationCodes;
} => {
  const {
    initTelemedSessionZambdaID,
    getChartDataZambdaID,
    saveChartDataZambdaID,
    deleteChartDataZambdaID,
    changeInPersonVisitStatusZambdaID,
    assignPractitionerZambdaID,
    unassignPractitionerZambdaID,
    signAppointmentZambdaID,
    unlockAppointmentZambdaID,
    syncUserZambdaID,
    getPatientInstructionsZambdaID,
    savePatientInstructionZambdaID,
    deletePatientInstructionZambdaID,
    icdSearchZambdaId,
    aiSuggestionNotesZambdaID,
    recommendBillingSuggestionsZambdaID,
    recommendBillingCodesZambdaID,
    createUpdateMedicationOrderZambdaID,
    getMedicationOrdersZambdaID,
    savePatientFollowupZambdaID,
    getPatientAccountZambdaID,
    updatePatientAccountZambdaID,
    removePatientCoverageZambdaID,
    mergePatientsZambdaID,
    sendFaxZambdaID,
    externalLabResourceSearchID,
    getUnsolicitedResultsResourcesID,
    updateLabOrderResourcesID,
    searchPlacesID,
    inhouseLabResourceSearchID,
    makeMedicationHistoryPdfID,
    generatePatientEducationZambdaID,
    savePatientEducationPdfZambdaID,
    listApprovedPatientEducationZambdaID,
    saveApprovedPatientEducationZambdaID,
    deleteApprovedPatientEducationZambdaID,
    updateApprovedPatientEducationCodesZambdaID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'init telemed session': initTelemedSessionZambdaID,
    'get chart data': getChartDataZambdaID,
    'save chart data': saveChartDataZambdaID,
    'delete chart data': deleteChartDataZambdaID,
    'change in person visit status': changeInPersonVisitStatusZambdaID,
    'assign practitioner': assignPractitionerZambdaID,
    'unassign practitioner': unassignPractitionerZambdaID,
    'sign appointment': signAppointmentZambdaID,
    'unlock appointment': unlockAppointmentZambdaID,
    'sync user': syncUserZambdaID,
    'get patient instructions': getPatientInstructionsZambdaID,
    'save patient instruction': savePatientInstructionZambdaID,
    'delete patient instruction': deletePatientInstructionZambdaID,
    'icd search': icdSearchZambdaId,
    'ai suggestion notes': aiSuggestionNotesZambdaID,
    'recommend billing suggestions': recommendBillingSuggestionsZambdaID,
    'recommend billing codes': recommendBillingCodesZambdaID,
    'create update medication order': createUpdateMedicationOrderZambdaID,
    'get medication orders': getMedicationOrdersZambdaID,
    'create update patient followup': savePatientFollowupZambdaID,
    'get patient account': getPatientAccountZambdaID,
    'update patient account': updatePatientAccountZambdaID,
    'remove patient coverage': removePatientCoverageZambdaID,
    'merge patients': mergePatientsZambdaID,
    'send fax': sendFaxZambdaID,
    'external lab resource search': externalLabResourceSearchID,
    'get unsolicited results resources': getUnsolicitedResultsResourcesID,
    'update lab order resources': updateLabOrderResourcesID,
    'search places': searchPlacesID,
    'inhouse lab resource search': inhouseLabResourceSearchID,
    'make medication history pdf': makeMedicationHistoryPdfID,
    'generate patient education': generatePatientEducationZambdaID,
    'save patient education pdf': savePatientEducationPdfZambdaID,
    'list approved patient education': listApprovedPatientEducationZambdaID,
    'save approved patient education': saveApprovedPatientEducationZambdaID,
    'delete approved patient education': deleteApprovedPatientEducationZambdaID,
    'update approved patient education codes': updateApprovedPatientEducationCodesZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;

  const { makeZapRequest } = getOystehrApiHelpers(
    oystehr,
    ZambdaNames,
    zambdasToIdsMap,
    zambdasPublicityMap,
    isAppLocalProvided
  );

  const initTelemedSession = async (
    parameters: InitTelemedSessionRequestParams
  ): Promise<InitTelemedSessionResponse> => {
    return await makeZapRequest('init telemed session', parameters);
  };

  const getChartData = async (parameters: GetChartDataRequest): Promise<GetChartDataResponse> => {
    return await makeZapRequest('get chart data', parameters);
  };

  const saveChartData = async (parameters: SaveChartDataRequest): Promise<SaveChartDataResponse> => {
    return await makeZapRequest('save chart data', parameters);
  };

  const deleteChartData = async (parameters: DeleteChartDataRequest): Promise<DeleteChartDataResponse> => {
    return await makeZapRequest('delete chart data', parameters);
  };

  const changeInPersonVisitStatus = async (
    parameters: Omit<ChangeInPersonVisitStatusInput, 'secrets'>
  ): Promise<ChangeInPersonVisitStatusResponse> => {
    return await makeZapRequest('change in person visit status', parameters);
  };

  const assignPractitioner = async (parameters: AssignPractitionerInput): Promise<AssignPractitionerResponse> => {
    return await makeZapRequest('assign practitioner', parameters);
  };

  const unassignPractitioner = async (
    parameters: UnassignPractitionerZambdaInput
  ): Promise<UnassignPractitionerZambdaOutput> => {
    return await makeZapRequest('unassign practitioner', parameters);
  };

  const signAppointment = async (
    parameters: Omit<SignAppointmentInput, 'secrets'>
  ): Promise<SignAppointmentResponse> => {
    return await makeZapRequest('sign appointment', parameters);
  };

  const unlockAppointment = async (
    parameters: Omit<UnlockAppointmentZambdaInputValidated, 'secrets' | 'userToken'>
  ): Promise<UnlockAppointmentZambdaOutput> => {
    return await makeZapRequest('unlock appointment', parameters);
  };

  const syncUser = async (): Promise<SyncUserResponse> => {
    return await makeZapRequest('sync user');
  };

  const getPatientInstructions = async (parameters: GetPatientInstructionsInput): Promise<CommunicationDTO[]> => {
    return await makeZapRequest('get patient instructions', parameters);
  };

  const savePatientInstruction = async (parameters: SavePatientInstructionInput): Promise<CommunicationDTO> => {
    return await makeZapRequest('save patient instruction', parameters);
  };

  const deletePatientInstruction = async (parameters: DeletePatientInstructionInput): Promise<void> => {
    return await makeZapRequest('delete patient instruction', parameters);
  };

  const savePatientFollowup = async (parameters: { id: 'test' }): Promise<void> => {
    return await makeZapRequest('create update patient followup', parameters);
  };

  const aiSuggestionNotes = async (parameters: AISuggestionNotesInput): Promise<AISuggestionNotes> => {
    return await makeZapRequest('ai suggestion notes', parameters);
  };

  const recommendBillingSuggestions = async (parameters: BillingSuggestionInput): Promise<BillingSuggestionOutput> => {
    return await makeZapRequest('recommend billing suggestions', parameters);
  };

  const recommendBillingCodes = async (parameters: ProcedureDetail): Promise<ProcedureSuggestion[]> => {
    return await makeZapRequest('recommend billing codes', parameters);
  };

  const createUpdateMedicationOrder = async (
    parameters: UpdateMedicationOrderInput
  ): Promise<{ id: string; message: string }> => {
    return await makeZapRequest('create update medication order', parameters);
  };

  const getMedicationOrders = async (parameters: GetMedicationOrdersInput): Promise<GetMedicationOrdersResponse> => {
    return await makeZapRequest('get medication orders', parameters);
  };

  const getPatientAccount = async (parameters: GetPatientAccountZambdaInput): Promise<PatientAccountResponse> => {
    const response = await makeZapRequest<PatientAccountResponse, GetPatientAccountZambdaInput>(
      'get patient account',
      parameters
    );
    response.coverages = {};
    response.insuranceOrgs = [];
    return response;
  };

  const updatePatientAccount = async (parameters: UpdatePatientAccountInput): Promise<UpdatePatientAccountResponse> => {
    return await makeZapRequest('update patient account', parameters);
  };

  const getPatientCoverages = async (
    parameters: GetPatientAccountZambdaInput
  ): Promise<{ coverages: OrderedCoveragesWithSubscribers; insuranceOrgs: Organization[] }> => {
    const response = await makeZapRequest<PatientAccountResponse, GetPatientAccountZambdaInput>(
      'get patient account',
      parameters
    );
    return {
      coverages: response.coverages,
      insuranceOrgs: response.insuranceOrgs,
    };
  };

  const removePatientCoverage = async (parameters: RemoveCoverageZambdaInput): Promise<RemoveCoverageResponse> => {
    return await makeZapRequest('remove patient coverage', parameters);
  };

  const mergePatients = async (parameters: MergePatientsInput): Promise<MergePatientsResponse> => {
    return await makeZapRequest('merge patients', parameters);
  };

  const getMergePatientsTask = async (parameters: GetMergePatientsTaskInput): Promise<GetMergePatientsTaskResponse> => {
    return await makeZapRequest('merge patients', { ...parameters, mode: 'status' });
  };

  const sendFax = async (parameters: SendFaxZambdaInput): Promise<void> => {
    return await makeZapRequest('send fax', parameters);
  };

  const getCreateExternalLabResources = async (
    parameters: GetCreateLabOrderResources
  ): Promise<LabOrderResourcesRes> => {
    return await makeZapRequest('external lab resource search', parameters);
  };

  const getUnsolicitedResultsResources = async (
    parameters: GetUnsolicitedResultsResourcesInput
  ): Promise<GetUnsolicitedResultsResourcesOutput> => {
    return await makeZapRequest('get unsolicited results resources', parameters);
  };

  const updateLabOrderResources = async (parameters: UpdateLabOrderResourcesInput): Promise<void> => {
    return await makeZapRequest('update lab order resources', parameters);
  };

  const searchPlaces = async (parameters: SearchPlacesInput): Promise<SearchPlacesOutput> => {
    return await makeZapRequest('search places', parameters);
  };

  const getCreateInHouseLabOrderResources = async (
    parameters: GetCreateInHouseLabOrderResourcesInput
  ): Promise<GetCreateInHouseLabOrderResourcesOutput> => {
    return await makeZapRequest('inhouse lab resource search', parameters);
  };

  const makeMedicationHistoryPdf = async (
    parameters: MakeMedicationHistoryPdfZambdaInput
  ): Promise<MakeMedicationHistoryPdfZambdaOutput> => {
    return await makeZapRequest('make medication history pdf', parameters);
  };

  const generatePatientEducation = async (
    parameters: GeneratePatientEducationInput
  ): Promise<GeneratePatientEducationOutput> => {
    return await makeZapRequest('generate patient education', parameters);
  };

  const savePatientEducationPdf = async (
    parameters: SavePatientEducationPdfInput
  ): Promise<SavePatientEducationPdfOutput> => {
    return await makeZapRequest('save patient education pdf', parameters);
  };

  const listApprovedPatientEducation = async (): Promise<ListApprovedPatientEducationOutput> => {
    return await makeZapRequest('list approved patient education', {});
  };

  const saveApprovedPatientEducation = async (
    parameters: SaveApprovedPatientEducationWithLanguageInput
  ): Promise<SaveApprovedPatientEducationOutput> => {
    return await makeZapRequest('save approved patient education', parameters);
  };

  const deleteApprovedPatientEducation = async (
    parameters: DeleteApprovedPatientEducationInput
  ): Promise<DeleteApprovedPatientEducationOutput> => {
    return await makeZapRequest('delete approved patient education', parameters);
  };

  const updateApprovedPatientEducationCodes = async (
    parameters: UpdateApprovedPatientEducationCodesInput
  ): Promise<UpdateApprovedPatientEducationCodesOutput> => {
    return await makeZapRequest('update approved patient education codes', parameters);
  };

  return {
    initTelemedSession,
    getChartData,
    saveChartData,
    deleteChartData,
    changeInPersonVisitStatus,
    assignPractitioner,
    unassignPractitioner,
    signAppointment,
    unlockAppointment,
    syncUser,
    getPatientInstructions,
    savePatientInstruction,
    deletePatientInstruction,
    aiSuggestionNotes,
    recommendBillingSuggestions,
    recommendBillingCodes,
    getMedicationOrders,
    createUpdateMedicationOrder,
    savePatientFollowup,
    getPatientAccount,
    updatePatientAccount,
    getPatientCoverages,
    removePatientCoverage,
    mergePatients,
    getMergePatientsTask,
    sendFax,
    getCreateExternalLabResources,
    getUnsolicitedResultsResources,
    updateLabOrderResources,
    searchPlaces,
    getCreateInHouseLabOrderResources,
    makeMedicationHistoryPdf,
    generatePatientEducation,
    savePatientEducationPdf,
    listApprovedPatientEducation,
    saveApprovedPatientEducation,
    deleteApprovedPatientEducation,
    updateApprovedPatientEducationCodes,
  };
};
