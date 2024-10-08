import { ZambdaClient } from '@zapehr/sdk';

import {
  CancelAppointmentRequestParams,
  CancelInviteParticipantRequestParameters,
  CancelInviteParticipantResponse,
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  CreatePaperworkInput,
  CreatePaperworkResponse,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetPaperworkRequestParams,
  GetTelemedAppointmentsRequest,
  GetTelemedAppointmentsResponse,
  InviteParticipantRequestParameters,
  JoinCallRequestParameters,
  JoinCallResponse,
  ListInvitedParticipantsRequestParameters,
  ListInvitedParticipantsResponse,
  PaperworkResponseWithResponses,
  PaperworkResponseWithoutResponses,
  PatientInfo,
  UpdateAppointmentRequestParams,
  UpdateAppointmentResponse,
  UpdatePaperworkInput,
  UpdatePaperworkResponse,
  VideoChatCreateInviteResponse,
  WaitingRoomInput,
  WaitingRoomResponse,
  isoStringFromMDYString,
} from 'ottehr-utils';
import { ApiError, GetZapEHRAPIParams } from '../types/data';
import { HealthcareService, Location, Practitioner } from 'fhir/r4';

enum ZambdaNames {
  'check in' = 'check in',
  'create appointment' = 'create appointment',
  'cancel appointment' = 'cancel appointment',
  'update appointment' = 'update appointment',
  'get appointments' = 'get appointments',
  'get patients' = 'get patients',
  'get paperwork' = 'get paperwork',
  'get groups' = 'get groups',
  'create paperwork' = 'create paperwork',
  'update paperwork' = 'update paperwork',
  'get schedule' = 'get schedule',
  'get wait status' = 'get wait status',
  'join call' = 'join call',
  'video chat create invite' = 'video chat create invite',
  'video chat cancel invite' = 'video chat cancel invite',
  'video chat list invites' = 'video chat list invites',
  'get presigned file url' = 'get presigned file url',
  'get providers' = 'get providers',
  'get locations' = 'get locations',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'check in': true,
  'create appointment': false,
  'cancel appointment': false,
  'update appointment': false,
  'get appointments': false,
  'get patients': false,
  'get paperwork': false,
  'create paperwork': false,
  'update paperwork': false,
  'get schedule': true,
  'get wait status': true,
  'join call': true,
  'video chat create invite': false,
  'video chat cancel invite': false,
  'video chat list invites': false,
  'get presigned file url': true,
  'get providers': true,
  'get locations': true,
  'get groups': true,
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
  getGroups: typeof getGroups;
  getProviders: typeof getProviders;
  getLocations: typeof getLocations;
  createPaperwork: typeof createPaperwork;
  updatePaperwork: typeof updatePaperwork;
  getSchedule: typeof getSchedule;
  getAppointments: typeof getAppointments;
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
    getPatientsZambdaID,
    getPaperworkZambdaID,
    createPaperworkZambdaID,
    updatePaperworkZambdaID,
    getScheduleZambdaID,
    getWaitStatusZambdaID,
    joinCallZambdaID,
    videoChatCreateInviteZambdaID,
    videoChatCancelInviteZambdaID,
    videoChatListInvitesZambdaID,
    getPresignedFileURLZambdaID,
    getProvidersZambdaID,
    getLocationsZambdaID,
    getGroupsZambdaID,
  } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'check in': checkInZambdaID,
    'create appointment': createAppointmentZambdaID,
    'cancel appointment': cancelAppointmentZambdaID,
    'update appointment': updateAppointmentZambdaID,
    'get appointments': getAppointmentsZambdaID,
    'get patients': getPatientsZambdaID,
    'get providers': getProvidersZambdaID,
    'get locations': getLocationsZambdaID,
    'get groups': getGroupsZambdaID,
    'get paperwork': getPaperworkZambdaID,
    'create paperwork': createPaperworkZambdaID,
    'update paperwork': updatePaperworkZambdaID,
    'get schedule': getScheduleZambdaID,
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

  const updateAppointment = async (parameters: UpdateAppointmentRequestParams): Promise<UpdateAppointmentResponse> => {
    return await makeZapRequest('update appointment', parameters);
  };

  const getPatients = async (): Promise<{ patients: PatientInfo[] }> => {
    return await makeZapRequest('get patients');
  };

  const getProviders = async (): Promise<Practitioner[]> => {
    return await makeZapRequest('get providers');
  };

  const getGroups = async (): Promise<HealthcareService[]> => {
    return await makeZapRequest('get groups');
  };

  const getLocations = async (): Promise<Location[]> => {
    return await makeZapRequest('get locations');
  };

  const createPaperwork = async (
    parameters: Pick<CreatePaperworkInput, 'appointmentID' | 'files' | 'paperwork' | 'paperworkComplete' | 'timezone'>,
  ): Promise<CreatePaperworkResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined),
      ),
    );
    return await makeZapRequest('create paperwork', payload);
  };

  const updatePaperwork = async (
    parameters: Pick<UpdatePaperworkInput, 'appointmentID' | 'files' | 'paperwork' | 'timezone'>,
  ): Promise<UpdatePaperworkResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined),
      ),
    );
    return await makeZapRequest('update paperwork', payload);
  };

  const getSchedule = async (parameters: GetScheduleRequestParams): Promise<GetScheduleResponse> => {
    return await makeZapRequest('get schedule', parameters);
  };

  const getAppointments = async (
    parameters?: GetTelemedAppointmentsRequest,
  ): Promise<GetTelemedAppointmentsResponse> => {
    return await makeZapRequest('get appointments', parameters);
  };

  const getPaperwork = async (parameters: GetPaperworkRequestParams): Promise<PaperworkResponseWithResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getPaperworkPublic = async (
    parameters: GetPaperworkRequestParams,
  ): Promise<PaperworkResponseWithoutResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundApointmentErrorHandler);
  };

  const getWaitStatus = async (
    parameters: Omit<WaitingRoomInput, 'secrets' | 'authorization'>,
  ): Promise<WaitingRoomResponse> => {
    return await makeZapRequest('get wait status', parameters);
  };

  const joinCall = async (parameters: JoinCallRequestParameters): Promise<JoinCallResponse> => {
    return await makeZapRequest('join call', parameters);
  };

  const videoChatCreateInvite = async (
    parameters: InviteParticipantRequestParameters,
  ): Promise<VideoChatCreateInviteResponse> => {
    return await makeZapRequest('video chat create invite', parameters);
  };

  const videoChatCancelInvite = async (
    parameters: CancelInviteParticipantRequestParameters,
  ): Promise<CancelInviteParticipantResponse> => {
    return await makeZapRequest('video chat cancel invite', parameters);
  };

  const videoChatListInvites = async (
    parameters: ListInvitedParticipantsRequestParameters,
  ): Promise<ListInvitedParticipantsResponse> => {
    return await makeZapRequest('video chat list invites', parameters);
  };

  const createZ3Object = async (
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    file: File,
  ): Promise<any> => {
    try {
      const presignedURLRequest = await getPresignedFileURL(appointmentID, fileType, fileFormat);

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
    getProviders,
    getLocations,
    getGroups,
    createZ3Object,
    getSchedule,
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
