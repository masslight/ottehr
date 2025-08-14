import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import {
  AssignPractitionerInput,
  AssignPractitionerResponse,
  ChangeInPersonVisitStatusInput,
  ChangeInPersonVisitStatusResponse,
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  CommunicationDTO,
  DeleteChartDataRequest,
  DeleteChartDataResponse,
  DeletePatientInstructionInput,
  GetChartDataRequest,
  GetChartDataResponse,
  GetCreateLabOrderResources,
  GetMedicationOrdersInput,
  GetMedicationOrdersResponse,
  getOystehrApiHelpers,
  GetPatientAccountZambdaInput,
  GetPatientInstructionsInput,
  GetTelemedAppointmentsResponseEhr,
  IcdSearchRequestParams,
  IcdSearchResponse,
  InitTelemedSessionRequestParams,
  InitTelemedSessionResponse,
  LabOrderResourcesRes,
  NotFoundAppointmentErrorHandler,
  OrderedCoveragesWithSubscribers,
  PatientAccountResponse,
  RemoveCoverageResponse,
  RemoveCoverageZambdaInput,
  SaveChartDataRequest,
  SaveChartDataResponse,
  SavePatientInstructionInput,
  SendFaxZambdaInput,
  SignAppointmentInput,
  SignAppointmentResponse,
  SyncUserResponse,
  UnassignPractitionerZambdaInput,
  UnassignPractitionerZambdaOutput,
  UpdateMedicationOrderInput,
  UpdatePatientAccountInput,
  UpdatePatientAccountResponse,
} from 'utils';
import { GetAppointmentsRequestParams } from '../utils';
import { GetOystehrTelemedAPIParams } from './types';

enum ZambdaNames {
  'get telemed appointments' = 'get telemed appointments',
  'init telemed session' = 'init telemed session',
  'get chart data' = 'get chart data',
  'save chart data' = 'save chart data',
  'delete chart data' = 'delete chart data',
  'change telemed appointment status' = 'change telemed appointment status',
  'change in person visit status' = 'change in person visit status',
  'assign practitioner' = 'assign practitioner',
  'unassign practitioner' = 'unassign practitioner',
  'sign appointment' = 'sign appointment',
  'sync user' = 'sync user',
  'get patient instructions' = 'get patient instructions',
  'save patient instruction' = 'save patient instruction',
  'delete patient instruction' = 'delete patient instruction',
  'icd search' = 'icd search',
  'create update medication order' = 'create update medication order',
  'get medication orders' = 'get medication orders',
  'create update patient followup' = 'create update patient followup',
  'get patient account' = 'get patient account',
  'update patient account' = 'update patient account',
  'remove patient coverage' = 'remove patient coverage',
  'send fax' = 'send fax',
  'external lab resource search' = 'external lab resource search',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'get telemed appointments': false,
  'init telemed session': false,
  'get chart data': false,
  'save chart data': false,
  'delete chart data': false,
  'change telemed appointment status': false,
  'change in person visit status': false,
  'assign practitioner': false,
  'unassign practitioner': false,
  'sign appointment': false,
  'sync user': false,
  'get patient instructions': false,
  'save patient instruction': false,
  'delete patient instruction': false,
  'icd search': false,
  'create update medication order': false,
  'get medication orders': false,
  'create update patient followup': false,
  'get patient account': false,
  'update patient account': false,
  'remove patient coverage': false,
  'send fax': false,
  'external lab resource search': false,
};

export type OystehrTelemedAPIClient = ReturnType<typeof getOystehrTelemedAPI>;

export const getOystehrTelemedAPI = (
  params: GetOystehrTelemedAPIParams,
  oystehr: Oystehr
): {
  getTelemedAppointments: typeof getTelemedAppointments;
  initTelemedSession: typeof initTelemedSession;
  getChartData: typeof getChartData;
  saveChartData: typeof saveChartData;
  deleteChartData: typeof deleteChartData;
  changeTelemedAppointmentStatus: typeof changeTelemedAppointmentStatus;
  changeInPersonVisitStatus: typeof changeInPersonVisitStatus;
  assignPractitioner: typeof assignPractitioner;
  unassignPractitioner: typeof unassignPractitioner;
  signAppointment: typeof signAppointment;
  syncUser: typeof syncUser;
  getPatientInstructions: typeof getPatientInstructions;
  savePatientInstruction: typeof savePatientInstruction;
  deletePatientInstruction: typeof deletePatientInstruction;
  icdSearch: typeof icdSearch;
  createUpdateMedicationOrder: typeof createUpdateMedicationOrder;
  getMedicationOrders: typeof getMedicationOrders;
  savePatientFollowup: typeof savePatientFollowup;
  getPatientAccount: typeof getPatientAccount;
  updatePatientAccount: typeof updatePatientAccount;
  getPatientCoverages: typeof getPatientCoverages;
  removePatientCoverage: typeof removePatientCoverage;
  sendFax: typeof sendFax;
  getCreateExternalLabResources: typeof getCreateExternalLabResources;
} => {
  const {
    getTelemedAppointmentsZambdaID,
    initTelemedSessionZambdaID,
    getChartDataZambdaID,
    saveChartDataZambdaID,
    deleteChartDataZambdaID,
    changeTelemedAppointmentStatusZambdaID,
    changeInPersonVisitStatusZambdaID,
    assignPractitionerZambdaID,
    unassignPractitionerZambdaID,
    signAppointmentZambdaID,
    syncUserZambdaID,
    getPatientInstructionsZambdaID,
    savePatientInstructionZambdaID,
    deletePatientInstructionZambdaID,
    icdSearchZambdaId,
    createUpdateMedicationOrderZambdaID,
    getMedicationOrdersZambdaID,
    savePatientFollowupZambdaID,
    getPatientAccountZambdaID,
    updatePatientAccountZambdaID,
    removePatientCoverageZambdaID,
    sendFaxZambdaID,
    externalLabResourceSearchID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'get telemed appointments': getTelemedAppointmentsZambdaID,
    'init telemed session': initTelemedSessionZambdaID,
    'get chart data': getChartDataZambdaID,
    'save chart data': saveChartDataZambdaID,
    'delete chart data': deleteChartDataZambdaID,
    'change telemed appointment status': changeTelemedAppointmentStatusZambdaID,
    'change in person visit status': changeInPersonVisitStatusZambdaID,
    'assign practitioner': assignPractitionerZambdaID,
    'unassign practitioner': unassignPractitionerZambdaID,
    'sign appointment': signAppointmentZambdaID,
    'sync user': syncUserZambdaID,
    'get patient instructions': getPatientInstructionsZambdaID,
    'save patient instruction': savePatientInstructionZambdaID,
    'delete patient instruction': deletePatientInstructionZambdaID,
    'icd search': icdSearchZambdaId,
    'create update medication order': createUpdateMedicationOrderZambdaID,
    'get medication orders': getMedicationOrdersZambdaID,
    'create update patient followup': savePatientFollowupZambdaID,
    'get patient account': getPatientAccountZambdaID,
    'update patient account': updatePatientAccountZambdaID,
    'remove patient coverage': removePatientCoverageZambdaID,
    'send fax': sendFaxZambdaID,
    'external lab resource search': externalLabResourceSearchID,
  };
  const isAppLocalProvided = params.isAppLocal != null;

  const { makeZapRequest } = getOystehrApiHelpers(
    oystehr,
    ZambdaNames,
    zambdasToIdsMap,
    zambdasPublicityMap,
    isAppLocalProvided
  );

  const getTelemedAppointments = async (
    parameters: GetAppointmentsRequestParams
  ): Promise<GetTelemedAppointmentsResponseEhr> => {
    return await makeZapRequest('get telemed appointments', parameters, NotFoundAppointmentErrorHandler);
  };

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

  const changeTelemedAppointmentStatus = async (
    parameters: Omit<ChangeTelemedAppointmentStatusInput, 'secrets'>
  ): Promise<ChangeTelemedAppointmentStatusResponse> => {
    return await makeZapRequest('change telemed appointment status', parameters);
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

  const icdSearch = async (parameters: IcdSearchRequestParams): Promise<IcdSearchResponse> => {
    return await makeZapRequest('icd search', parameters);
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

  const sendFax = async (parameters: SendFaxZambdaInput): Promise<void> => {
    return await makeZapRequest('send fax', parameters);
  };

  const getCreateExternalLabResources = async (
    parameters: GetCreateLabOrderResources
  ): Promise<LabOrderResourcesRes> => {
    return await makeZapRequest('external lab resource search', parameters);
  };

  return {
    getTelemedAppointments,
    initTelemedSession,
    getChartData,
    saveChartData,
    deleteChartData,
    changeTelemedAppointmentStatus,
    changeInPersonVisitStatus,
    assignPractitioner,
    unassignPractitioner,
    signAppointment,
    syncUser,
    getPatientInstructions,
    savePatientInstruction,
    deletePatientInstruction,
    icdSearch,
    getMedicationOrders,
    createUpdateMedicationOrder,
    savePatientFollowup,
    getPatientAccount,
    updatePatientAccount,
    getPatientCoverages,
    removePatientCoverage,
    sendFax,
    getCreateExternalLabResources,
  };
};
