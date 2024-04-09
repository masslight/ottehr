import { ZambdaClient } from '@zapehr/sdk';
import { GetZapEHRTelemedAPIParams, ApiError } from './types';
import { GetAppointmentsRequestParams } from '../utils';
import { StateType } from '../../types/types';
import {
  GetChartDataResponse,
  GetChartDataRequest,
  GetTelemedAppointmentsResponse,
  InitTelemedSessionRequestParams,
  InitTelemedSessionResponse,
  SaveChartDataResponse,
  SaveChartDataRequest,
  DeleteChartDataRequest,
  DeleteChartDataResponse,
} from 'ehr-utils';

enum ZambdaNames {
  'get telemed appointments' = 'get telemed appointments',
  'init telemed session' = 'init telemed session',
  'get user' = 'get user',
  'get chart data' = 'get chart data',
  'save chart data' = 'save chart data',
  'delete chart data' = 'delete chart data',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'get telemed appointments': false,
  'init telemed session': false,
  'get user': false,
  'get chart data': false,
  'save chart data': false,
  'delete chart data': false,
};

export type ZapEHRTelemedAPIClient = ReturnType<typeof getZapEHRTelemedAPI>;

export const getZapEHRTelemedAPI = (
  params: GetZapEHRTelemedAPIParams,
  zambdaClient: ZambdaClient,
): {
  getTelemedAppointments: typeof getTelemedAppointments;
  initTelemedSession: typeof initTelemedSession;
  getUser: typeof getUser;
  getChartData: typeof getChartData;
  saveChartData: typeof saveChartData;
  deleteChartData: typeof deleteChartData;
} => {
  const {
    getTelemedAppointmentsZambdaID,
    initTelemedSessionZambdaID,
    getUserZambdaID,
    getChartDataZambdaID,
    saveChartDataZambdaID,
    deleteChartDataZambdaID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'get telemed appointments': getTelemedAppointmentsZambdaID,
    'init telemed session': initTelemedSessionZambdaID,
    'get user': getUserZambdaID,
    'get chart data': getChartDataZambdaID,
    'save chart data': saveChartDataZambdaID,
    'delete chart data': deleteChartDataZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;
  const isAppLocal = params.isAppLocal === 'true';

  const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap,
  ): zambdaID is Exclude<typeof zambdaID, undefined> => {
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

  const getUser = async (parameters: {
    userId: string;
  }): Promise<{
    message: string;
    user: {
      licenses: { state: StateType; licenseId: string }[];
    };
  }> => {
    return await makeZapRequest('get user', parameters, NotFoundApointmentErrorHandler);
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

  return {
    getTelemedAppointments,
    initTelemedSession,
    getUser,
    getChartData,
    saveChartData,
    deleteChartData,
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
