import { ZambdaClient } from '@zapehr/sdk';

import {
  CancelAppointmentRequestParams,
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  GetLocationRequestParams,
  GetLocationResponse,
  GetPaperworkRequestParams,
  GetWaitStatusParams,
  GetWaitStatusResponse,
  PaperworkResponseWithResponses,
  PaperworkResponseWithoutResponses,
  PatientInfo,
  UpdateAppointmentRequestParams,
  UpdatePaperworkParams,
  UpdatePaperworkResponse,
  isoStringFromMDYString,
} from 'ottehr-utils';
import { ApiError, GetZapEHRAPIParams } from '../types/data';

enum ZambdaNames {
  'check in' = 'check in',
  'create appointment' = 'create appointment',
  'cancel appointment' = 'cancel appointment',
  'update appointment' = 'update appointment',
  'get paperwork' = 'get paperwork',
  'get appointments' = 'get appointments',
  'get patients' = 'get patients',
  'update paperwork' = 'update paperwork',
  'get location' = 'get location',
  'get wait status' = 'get wait status',
  'get presigned file url' = 'get presigned file url',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'check in': true,
  'create appointment': false,
  'cancel appointment': true,
  'update appointment': true,
  'get paperwork': true,
  'get appointments': false,
  'get patients': false,
  'update paperwork': true,
  'get location': true,
  'get wait status': false,
  'get presigned file url': true,
};

export type ZapEHRAPIClient = ReturnType<typeof getZapEHRAPI>;

export const getZapEHRAPI = (
  params: GetZapEHRAPIParams,
  zambdaClient: ZambdaClient,
): {
  checkIn: typeof checkIn;
  createAppointment: typeof createAppointment;
  cancelAppointment: typeof cancelAppointment;
  updateAppointment: typeof updateAppointment;
  getPatients: typeof getPatients;
  updatePaperwork: typeof updatePaperwork;
  getLocation: typeof getLocation;
  getAppointments: typeof getAppointments;
  getPaperwork: typeof getPaperwork;
  getPaperworkPublic: typeof getPaperworkPublic;
  getWaitStatus: typeof getWaitStatus;
  createZ3Object: typeof createZ3Object;
} => {
  const {
    checkInZambdaID,
    createAppointmentZambdaID,
    cancelAppointmentZambdaID,
    updateAppointmentZambdaID,
    getPaperworkZambdaID,
    getAppointmentsZambdaID,
    getPatientsZambdaID,
    updatePaperworkZambdaID,
    getLocationZambdaID,
    getWaitStatusZambdaID,
    getPresignedFileURLZambdaID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'check in': checkInZambdaID,
    'create appointment': createAppointmentZambdaID,
    'cancel appointment': cancelAppointmentZambdaID,
    'update appointment': updateAppointmentZambdaID,
    'get paperwork': getPaperworkZambdaID,
    'get appointments': getAppointmentsZambdaID,
    'get patients': getPatientsZambdaID,
    'update paperwork': updatePaperworkZambdaID,
    'get location': getLocationZambdaID,
    'get wait status': getWaitStatusZambdaID,
    'get presigned file url': getPresignedFileURLZambdaID,
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

  const checkIn = async (appointmentId: string): Promise<any> => {
    return await makeZapRequest('check in', { appointment: appointmentId }, NotFoundApointmentErrorHandler);
  };

  const createAppointment = async (
    parameters: CreateAppointmentUCTelemedParams,
  ): Promise<CreateAppointmentUCTelemedResponse> => {
    const fhirParams = fhirifyAppointmentInputs({ ...parameters });
    return await makeZapRequest('create appointment', fhirParams);
  };

  const cancelAppointment = async (parameters: CancelAppointmentRequestParams): Promise<any> => {
    return await makeZapRequest('cancel appointment', parameters, NotFoundApointmentErrorHandler);
  };

  const updateAppointment = async (parameters: UpdateAppointmentRequestParams): Promise<any> => {
    return await makeZapRequest('update appointment', parameters);
  };

  const getPatients = async (): Promise<any> => {
    return await makeZapRequest('get patients');
  };

  const updatePaperwork = async (parameters: UpdatePaperworkParams): Promise<UpdatePaperworkResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined),
      ),
    );
    return await makeZapRequest('update paperwork', payload);
  };

  const getLocation = async (parameters: GetLocationRequestParams): Promise<GetLocationResponse> => {
    return await makeZapRequest('get location', parameters);
  };

  const getAppointments = async (): Promise<any> => {
    return await makeZapRequest('get appointments');
  };

  const getPaperwork = async (parameters: GetPaperworkRequestParams): Promise<PaperworkResponseWithResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getPaperworkPublic = async (
    parameters: GetPaperworkRequestParams,
  ): Promise<PaperworkResponseWithoutResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getWaitStatus = async (parameters: GetWaitStatusParams): Promise<GetWaitStatusResponse> => {
    return await makeZapRequest('get wait status', parameters);
  };

  const createZ3Object = async (
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    file: File,
  ): Promise<any> => {
    try {
      const presignedURLRequest = await getPresignedFileURL(appointmentID, fileType, fileFormat);

      // const presignedURLResponse = await presignedURLRequest.json();
      // Upload the file to S3
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

      return presignedURLRequest;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  };

  const getPresignedFileURL = async (appointmentID: string, fileType: string, fileFormat: string): Promise<any> => {
    const payload = {
      appointmentID,
      fileType,
      fileFormat,
    };
    return await makeZapRequest('get presigned file url', payload);
  };

  return {
    checkIn,
    createAppointment,
    cancelAppointment,
    updateAppointment,
    getPaperwork,
    getPaperworkPublic,
    getPatients,
    getAppointments,
    createZ3Object,
    getLocation,
    getWaitStatus,
    updatePaperwork,
  };
};

const fhirifyAppointmentInputs = (inputs: CreateAppointmentUCTelemedParams): CreateAppointmentUCTelemedParams => {
  const returnParams = { ...inputs };
  const { patient } = returnParams;

  const { dateOfBirth: patientBirthDate } = patient as PatientInfo;
  if (patient) {
    patient.dateOfBirth = isoStringFromMDYString(patientBirthDate ?? '');
  }

  returnParams.patient = patient;

  return returnParams;
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
