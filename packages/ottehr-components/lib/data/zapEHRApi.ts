import { ZambdaClient } from '@zapehr/sdk';

import {
  CancelAppointmentRequestParams,
  CancelInviteParticipantRequestParameters,
  CancelInviteParticipantResponse,
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  CreatePaperworkInput,
  CreatePaperworkResponse,
  GetLocationRequestParams,
  GetLocationResponse,
  GetPaperworkRequestParams,
  GetTelemedAppointmentsRequest,
  GetTelemedAppointmentsResponse,
  GetTelemedLocationsResponse,
  InviteParticipantRequestParameters,
  JoinCallRequestParameters,
  JoinCallResponse,
  ListInvitedParticipantsRequestParameters,
  ListInvitedParticipantsResponse,
  PaperworkResponseWithResponses,
  PaperworkResponseWithoutResponses,
  PatientInfo,
  UpdateAppointmentRequestParams,
  UpdatePaperworkInput,
  UpdatePaperworkResponse,
  VideoChatCreateInviteResponse,
  WaitingRoomInput,
  WaitingRoomResponse,
  isoStringFromMDYString,
} from 'ottehr-utils';
import { ApiError, GetZapEHRAPIParams } from '../types/data';

enum ZambdaNames {
  'check in' = 'check in',
  'create appointment' = 'create appointment',
  'cancel appointment' = 'cancel appointment',
  'update appointment' = 'update appointment',
  'get appointments' = 'get appointments',
  'get telemed states' = 'get telemed states',
  'get patients' = 'get patients',
  'get paperwork' = 'get paperwork',
  'create paperwork' = 'create paperwork',
  'update paperwork' = 'update paperwork',
  'get location' = 'get location',
  'get wait status' = 'get wait status',
  'join call' = 'join call',
  'video chat create invite' = 'video chat create invite',
  'video chat cancel invite' = 'video chat cancel invite',
  'video chat list invites' = 'video chat list invites',
  'get presigned file url' = 'get presigned file url',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'check in': true,
  'create appointment': false,
  'cancel appointment': false,
  'update appointment': false,
  'get appointments': false,
  'get telemed states': true,
  'get patients': false,
  'get paperwork': false,
  'create paperwork': false,
  'update paperwork': false,
  'get location': true,
  'get wait status': true,
  'join call': true,
  'video chat create invite': false,
  'video chat cancel invite': false,
  'video chat list invites': false,
  'get presigned file url': true,
};

export type ZapEHRAPIClient = ReturnType<typeof getZapEHRAPI>;

export const getZapEHRAPI = (
  params: GetZapEHRAPIParams,
  zambdaClient: ZambdaClient
): {
  checkIn: typeof checkIn;
  createAppointment: typeof createAppointment;
  cancelAppointment: typeof cancelAppointment;
  updateAppointment: typeof updateAppointment;
  getPatients: typeof getPatients;
  createPaperwork: typeof createPaperwork;
  updatePaperwork: typeof updatePaperwork;
  getLocation: typeof getLocation;
  getAppointments: typeof getAppointments;
  getTelemedStates: typeof getTelemedStates;
  getPaperwork: typeof getPaperwork;
  getPaperworkPublic: typeof getPaperworkPublic;
  getWaitStatus: typeof getWaitStatus;
  joinCall: typeof joinCall;
  videoChatCreateInvite: typeof videoChatCreateInvite;
  videoChatCancelInvite: typeof videoChatCancelInvite;
  videoChatListInvites: typeof videoChatListInvites;
  createZ3Object: typeof createZ3Object;
} => {
  const {
    checkInZambdaID,
    createAppointmentZambdaID,
    cancelAppointmentZambdaID,
    updateAppointmentZambdaID,
    getAppointmentsZambdaID,
    getTelemedStatesZambdaID,
    getPatientsZambdaID,
    getPaperworkZambdaID,
    createPaperworkZambdaID,
    updatePaperworkZambdaID,
    getLocationZambdaID,
    getWaitStatusZambdaID,
    joinCallZambdaID,
    videoChatCreateInviteZambdaID,
    videoChatCancelInviteZambdaID,
    videoChatListInvitesZambdaID,
    getPresignedFileURLZambdaID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'check in': checkInZambdaID,
    'create appointment': createAppointmentZambdaID,
    'cancel appointment': cancelAppointmentZambdaID,
    'update appointment': updateAppointmentZambdaID,
    'get appointments': getAppointmentsZambdaID,
    'get telemed states': getTelemedStatesZambdaID,
    'get patients': getPatientsZambdaID,
    'get paperwork': getPaperworkZambdaID,
    'create paperwork': createPaperworkZambdaID,
    'update paperwork': updatePaperworkZambdaID,
    'get location': getLocationZambdaID,
    'get wait status': getWaitStatusZambdaID,
    'join call': joinCallZambdaID,
    'video chat create invite': videoChatCreateInviteZambdaID,
    'video chat cancel invite': videoChatCancelInviteZambdaID,
    'video chat list invites': videoChatListInvitesZambdaID,
    'get presigned file url': getPresignedFileURLZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;
  const isAppLocal = params.isAppLocal === 'true';

  const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap
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
    additionalErrorHandler?: (error: unknown) => void
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
    parameters: CreateAppointmentUCTelemedParams
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

  const getPatients = async (): Promise<{ patients: PatientInfo[] }> => {
    return await makeZapRequest('get patients');
  };

  const createPaperwork = async (
    parameters: Pick<CreatePaperworkInput, 'appointmentID' | 'files' | 'paperwork' | 'paperworkComplete' | 'timezone'>
  ): Promise<CreatePaperworkResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)
      )
    );
    return await makeZapRequest('create paperwork', payload);
  };

  const updatePaperwork = async (
    parameters: Pick<UpdatePaperworkInput, 'appointmentID' | 'files' | 'paperwork' | 'timezone'>
  ): Promise<UpdatePaperworkResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)
      )
    );
    return await makeZapRequest('update paperwork', payload);
  };

  const getLocation = async (parameters: GetLocationRequestParams): Promise<GetLocationResponse> => {
    return await makeZapRequest('get location', parameters);
  };

  const getAppointments = async (
    parameters?: GetTelemedAppointmentsRequest
  ): Promise<GetTelemedAppointmentsResponse> => {
    return await makeZapRequest('get appointments', parameters);
  };

  const getTelemedStates = async (): Promise<GetTelemedLocationsResponse> => {
    return await makeZapRequest('get telemed states');
  };

  const getPaperwork = async (parameters: GetPaperworkRequestParams): Promise<PaperworkResponseWithResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getPaperworkPublic = async (
    parameters: GetPaperworkRequestParams
  ): Promise<PaperworkResponseWithoutResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getWaitStatus = async (
    parameters: Omit<WaitingRoomInput, 'secrets' | 'authorization'>
  ): Promise<WaitingRoomResponse> => {
    return await makeZapRequest('get wait status', parameters);
  };

  const joinCall = async (parameters: JoinCallRequestParameters): Promise<JoinCallResponse> => {
    return await makeZapRequest('join call', parameters);
  };

  const videoChatCreateInvite = async (
    parameters: InviteParticipantRequestParameters
  ): Promise<VideoChatCreateInviteResponse> => {
    return await makeZapRequest('video chat create invite', parameters);
  };

  const videoChatCancelInvite = async (
    parameters: CancelInviteParticipantRequestParameters
  ): Promise<CancelInviteParticipantResponse> => {
    return await makeZapRequest('video chat cancel invite', parameters);
  };

  const videoChatListInvites = async (
    parameters: ListInvitedParticipantsRequestParameters
  ): Promise<ListInvitedParticipantsResponse> => {
    return await makeZapRequest('video chat list invites', parameters);
  };

  const createZ3Object = async (
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    file: File
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
    createPaperwork,
    updatePaperwork,
    getPaperworkPublic,
    getPatients,
    getAppointments,
    getTelemedStates,
    createZ3Object,
    getLocation,
    getWaitStatus,
    joinCall,
    videoChatCreateInvite,
    videoChatCancelInvite,
    videoChatListInvites,
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
