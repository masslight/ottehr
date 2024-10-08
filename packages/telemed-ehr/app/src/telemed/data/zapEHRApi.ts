import { ZambdaClient } from '@zapehr/sdk';
import {
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  CommunicationDTO,
  DeleteChartDataRequest,
  DeleteChartDataResponse,
  DeletePatientInstructionInput,
  GetChartDataRequest,
  GetChartDataResponse,
  GetPatientInstructionsInput,
  GetTelemedAppointmentsResponse,
  IcdSearchRequestParams,
  IcdSearchResponse,
  InitTelemedSessionRequestParams,
  InitTelemedSessionResponse,
  SaveChartDataRequest,
  SaveChartDataResponse,
  SavePatientInstructionInput,
} from 'ehr-utils';
import { GetAppointmentsRequestParams } from '../utils';
import { ApiError, GetZapEHRTelemedAPIParams } from './types';

enum ZambdaNames {
  'get telemed appointments' = 'get telemed appointments',
  'init telemed session' = 'init telemed session',
  'get chart data' = 'get chart data',
  'save chart data' = 'save chart data',
  'delete chart data' = 'delete chart data',
  'change telemed appointment status' = 'change telemed appointment status',
  'get patient instructions' = 'get patient instructions',
  'save patient instruction' = 'save patient instruction',
  'delete patient instruction' = 'delete patient instruction',
  'icd search' = 'icd search',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'get telemed appointments': false,
  'init telemed session': false,
  'get chart data': false,
  'save chart data': false,
  'delete chart data': false,
  'change telemed appointment status': false,
  'get patient instructions': false,
  'save patient instruction': false,
  'delete patient instruction': false,
  'icd search': false,
};

export type ZapEHRTelemedAPIClient = ReturnType<typeof getZapEHRTelemedAPI>;

export const getZapEHRTelemedAPI = (
  params: GetZapEHRTelemedAPIParams,
  zambdaClient: ZambdaClient,
): {
  getTelemedAppointments: typeof getTelemedAppointments;
  initTelemedSession: typeof initTelemedSession;
  getChartData: typeof getChartData;
  saveChartData: typeof saveChartData;
  deleteChartData: typeof deleteChartData;
  changeTelemedAppointmentStatus: typeof changeTelemedAppointmentStatus;
  getPatientInstructions: typeof getPatientInstructions;
  savePatientInstruction: typeof savePatientInstruction;
  deletePatientInstruction: typeof deletePatientInstruction;
  icdSearch: typeof icdSearch;
} => {
  const {
    getTelemedAppointmentsZambdaID,
    initTelemedSessionZambdaID,
    getChartDataZambdaID,
    saveChartDataZambdaID,
    deleteChartDataZambdaID,
    changeTelemedAppointmentStatusZambdaID,
    getPatientInstructionsZambdaID,
    savePatientInstructionZambdaID,
    deletePatientInstructionZambdaID,
    icdSearchZambdaId,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'get telemed appointments': getTelemedAppointmentsZambdaID,
    'init telemed session': initTelemedSessionZambdaID,
    'get chart data': getChartDataZambdaID,
    'save chart data': saveChartDataZambdaID,
    'delete chart data': deleteChartDataZambdaID,
    'change telemed appointment status': changeTelemedAppointmentStatusZambdaID,
    'get patient instructions': getPatientInstructionsZambdaID,
    'save patient instruction': savePatientInstructionZambdaID,
    'delete patient instruction': deletePatientInstructionZambdaID,
    'icd search': icdSearchZambdaId,
  };
  const isAppLocalProvided = params.isAppLocal != null;
  const isAppLocal = params.isAppLocal === 'true';

  const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap,
  ): zambdaID is Exclude<typeof zambdaID, undefined> => {
    console.log('zambdaID', zambdaID);
    console.log('isAppLocalProvided', isAppLocalProvided);
    if (zambdaID === undefined || !isAppLocalProvided) {
      throw new Error(`${zambdaName} zambda environment variable could not be loaded`);
    }
    return true;
  };

  const chooseJson = (json: any): any => {
    return isAppLocal ? json : json.output;
  };

  const makeZapRequest = async <TResponse, TPayload>(
    zambdaName: keyof typeof ZambdaNames,
    payload?: TPayload,
    additionalErrorHandler?: (error: unknown) => void,
  ): Promise<TResponse> => {
    const zambdaId = zambdasToIdsMap[zambdaName];

    try {
      if (verifyZambdaProvidedAndNotLocalThrowErrorOtherwise(zambdaId, zambdaName)) {
        let zambdaMethodToInvoke: ZambdaClient['invokeZambda'] | ZambdaClient['invokePublicZambda'];

        if (zambdasPublicityMap[zambdaName]) {
          zambdaMethodToInvoke = zambdaClient.invokePublicZambda;
        } else {
          zambdaMethodToInvoke = zambdaClient.invokeZambda;
        }

        zambdaMethodToInvoke = zambdaMethodToInvoke.bind(zambdaClient);

        const response = await zambdaMethodToInvoke({
          zambdaId: zambdaId,
          payload,
        });

        const jsonToUse = chooseJson(response);
        return jsonToUse;
      }
      // won't be reached, but for TS to give the right return type
      throw Error();
    } catch (error) {
      additionalErrorHandler && additionalErrorHandler(error);
      throw apiErrorToThrow(error);
    }
  };

  const getTelemedAppointments = async (
    parameters: GetAppointmentsRequestParams,
  ): Promise<GetTelemedAppointmentsResponse> => {
    return await makeZapRequest('get telemed appointments', parameters, NotFoundApointmentErrorHandler);
  };

  const initTelemedSession = async (
    parameters: InitTelemedSessionRequestParams,
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
    parameters: Omit<ChangeTelemedAppointmentStatusInput, 'secrets'>,
  ): Promise<ChangeTelemedAppointmentStatusResponse> => {
    return await makeZapRequest('change telemed appointment status', parameters);
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

  const icdSearch = async (parameters: IcdSearchRequestParams): Promise<IcdSearchResponse> => {
    return await makeZapRequest('icd search', parameters);
  };

  return {
    getTelemedAppointments,
    initTelemedSession,
    getChartData,
    saveChartData,
    deleteChartData,
    changeTelemedAppointmentStatus,
    getPatientInstructions,
    savePatientInstruction,
    deletePatientInstruction,
    icdSearch,
  };
};

const InternalError: ApiError = {
  message: 'Internal Service Error',
};

const isApiError = (error: any): boolean => error instanceof Object && error && 'message' in error;

export const apiErrorToThrow = (error: any): ApiError => {
  console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    return error;
  } else {
    console.error('An endpoint threw and did not provide a well formed ApiError');
    return InternalError;
  }
};

function NotFoundApointmentErrorHandler(error: any): void {
  if (error.message === 'Appointment is not found') {
    throw error;
  }
}
