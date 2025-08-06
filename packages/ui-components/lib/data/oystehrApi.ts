// cSpell:ignore fhirify
import Oystehr, { ZambdaExecuteResult } from '@oystehr/sdk';
import { QuestionnaireItemAnswerOption, QuestionnaireResponse } from 'fhir/r4b';
import {
  APIError,
  BookableItemListResponse,
  CancelAppointmentRequestParams,
  CancelInviteParticipantRequestParameters,
  CancelInviteParticipantResponse,
  chooseJson,
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  CreditCardInfo,
  GetAnswerOptionsRequest,
  GetAppointmentsRequest,
  GetBookableItemListParams,
  GetEligibilityParameters,
  GetEligibilityResponse,
  GetPaperworkRequestParams,
  GetPastVisitsResponse,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetTelemedAppointmentsRequest,
  GetTelemedAppointmentsResponseEhr,
  GetTelemedLocationsResponse,
  GetVisitDetailsRequest,
  GetVisitDetailsResponse,
  InviteParticipantRequestParameters,
  isoStringFromMDYString,
  JoinCallRequestParameters,
  JoinCallResponse,
  ListInvitedParticipantsRequestParameters,
  ListInvitedParticipantsResponse,
  PaperworkResponseWithoutResponses,
  PatchPaperworkParameters,
  PatientInfo,
  PaymentMethodDeleteParameters,
  PaymentMethodListParameters,
  PaymentMethodSetDefaultParameters,
  PaymentMethodSetupParameters,
  SubmitPaperworkParameters,
  UCGetPaperworkResponse,
  UpdateAppointmentRequestParams,
  UpdateAppointmentResponse,
  VideoChatCreateInviteResponse,
  WaitingRoomInput,
  WaitingRoomResponse,
} from 'utils';
import { GetOystehrAPIParams } from '../main';

type ZambdaName =
  | 'cancel appointment'
  | 'check in'
  | 'create appointment'
  | 'delete payment method'
  | 'get appointments'
  | 'get past visits'
  | 'get eligibility'
  | 'get visit details'
  | 'get answer options'
  | 'get schedule'
  | 'get paperwork'
  | 'get patients'
  | 'get payment methods'
  | 'get presigned file url'
  | 'get telemed states'
  | 'get wait status'
  | 'join call'
  | 'setup payment method'
  | 'set default payment method'
  | 'update appointment'
  | 'patch paperwork'
  | 'submit paperwork'
  | 'video chat cancel invite'
  | 'video chat create invite'
  | 'video chat list invites'
  | 'list bookables';

const zambdasPublicityMap: Record<ZambdaName, boolean> = {
  'cancel appointment': false,
  'check in': true,
  'create appointment': false,
  'delete payment method': false,
  'get appointments': false,
  'get past visits': false,
  'get eligibility': false,
  'get visit details': false,
  'get answer options': false,
  'get schedule': true,
  'get paperwork': true,
  'get patients': false,
  'get payment methods': false,
  'get presigned file url': true,
  'get telemed states': true,
  'get wait status': true,
  'join call': true,
  'setup payment method': false,
  'set default payment method': false,
  'update appointment': false,
  'patch paperwork': true,
  'submit paperwork': true,
  'video chat cancel invite': false,
  'video chat create invite': false,
  'video chat list invites': false,
  'list bookables': true,
};

export type OystehrAPIClient = ReturnType<typeof getOystehrAPI>;

export const getOystehrAPI = (
  params: GetOystehrAPIParams,
  oystehr: Oystehr
): {
  cancelAppointment: typeof cancelAppointment;
  checkIn: typeof checkIn;
  createAppointment: typeof createAppointment;
  createZ3Object: typeof createZ3Object;
  deletePaymentMethod: typeof deletePaymentMethod;
  getAppointments: typeof getAppointments;
  getPastVisits: typeof getPastVisits;
  getEligibility: typeof getEligibility;
  getVisitDetails: typeof getVisitDetails;
  getAnswerOptions: typeof getAnswerOptions;
  getSchedule: typeof getSchedule;
  getPaperworkPublic: typeof getPaperworkPublic;
  getPaperwork: typeof getPaperwork;
  getPatients: typeof getPatients;
  getPaymentMethods: typeof getPaymentMethods;
  getTelemedStates: typeof getTelemedStates;
  getWaitStatus: typeof getWaitStatus;
  joinCall: typeof joinCall;
  setDefaultPaymentMethod: typeof setDefaultPaymentMethod;
  setupPaymentMethod: typeof setupPaymentMethod;
  updateAppointment: typeof updateAppointment;
  patchPaperwork: typeof patchPaperwork;
  submitPaperwork: typeof submitPaperwork;
  videoChatCancelInvite: typeof videoChatCancelInvite;
  videoChatCreateInvite: typeof videoChatCreateInvite;
  videoChatListInvites: typeof videoChatListInvites;
  listBookables: typeof listBookables;
} => {
  const {
    cancelAppointmentZambdaID,
    checkInZambdaID,
    createAppointmentZambdaID,
    deletePaymentMethodZambdaID,
    getAppointmentsZambdaID,
    getPastVisitsZambdaID,
    getEligibilityZambdaID,
    getVisitDetailsZambdaID,
    getAnswerOptionsZambdaID,
    getScheduleZambdaID,
    getPaperworkZambdaID,
    getPatientsZambdaID,
    getPaymentMethodsZambdaID,
    getPresignedFileURLZambdaID,
    getTelemedStatesZambdaID,
    getWaitStatusZambdaID,
    joinCallZambdaID,
    setDefaultPaymentMethodZambdaID,
    setupPaymentMethodZambdaID,
    updateAppointmentZambdaID,
    patchPaperworkZambdaID,
    submitPaperworkZambdaID,
    videoChatCancelInviteZambdaID,
    videoChatCreateInviteZambdaID,
    videoChatListInvitesZambdaID,
    listBookablesZambdaID,
  } = params;

  const zambdasToIdsMap: Record<ZambdaName, string | undefined> = {
    'cancel appointment': cancelAppointmentZambdaID,
    'check in': checkInZambdaID,
    'create appointment': createAppointmentZambdaID,
    'delete payment method': deletePaymentMethodZambdaID,
    'get appointments': getAppointmentsZambdaID,
    'get past visits': getPastVisitsZambdaID,
    'get eligibility': getEligibilityZambdaID,
    'get visit details': getVisitDetailsZambdaID,
    'get answer options': getAnswerOptionsZambdaID,
    'get schedule': getScheduleZambdaID,
    'get paperwork': getPaperworkZambdaID,
    'get patients': getPatientsZambdaID,
    'get payment methods': getPaymentMethodsZambdaID,
    'get presigned file url': getPresignedFileURLZambdaID,
    'get telemed states': getTelemedStatesZambdaID,
    'get wait status': getWaitStatusZambdaID,
    'join call': joinCallZambdaID,
    'set default payment method': setDefaultPaymentMethodZambdaID,
    'setup payment method': setupPaymentMethodZambdaID,
    'update appointment': updateAppointmentZambdaID,
    'patch paperwork': patchPaperworkZambdaID,
    'submit paperwork': submitPaperworkZambdaID,
    'video chat cancel invite': videoChatCancelInviteZambdaID,
    'video chat create invite': videoChatCreateInviteZambdaID,
    'video chat list invites': videoChatListInvitesZambdaID,
    'list bookables': listBookablesZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;

  const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap
  ): zambdaID is Exclude<typeof zambdaID, undefined> => {
    if (zambdaID === undefined || !isAppLocalProvided) {
      throw new Error(`${zambdaName} zambda environment variable could not be loaded`);
    }
    return true;
  };

  const makeZapRequest = async <TResponse, TPayload>(
    zambdaName: ZambdaName,
    payload?: TPayload,
    additionalErrorHandler?: (error: unknown) => void
  ): Promise<TResponse> => {
    const zambdaId = zambdasToIdsMap[zambdaName];

    try {
      if (verifyZambdaProvidedAndNotLocalThrowErrorOtherwise(zambdaId, zambdaName)) {
        let zambdaPromise: Promise<ZambdaExecuteResult>;
        if (zambdasPublicityMap[zambdaName]) {
          zambdaPromise = oystehr.zambda.executePublic({ id: zambdaId, ...payload });
        } else {
          zambdaPromise = oystehr.zambda.execute({ id: zambdaId, ...payload });
        }

        const response = await zambdaPromise;
        const jsonToUse = chooseJson(response);
        return jsonToUse;
      }
      // won't be reached, but for TS to give the right return type
      throw Error();
    } catch (error) {
      if (additionalErrorHandler) {
        additionalErrorHandler(error);
      }
      throw apiErrorToThrow(error);
    }
  };

  // Zambdas

  const cancelAppointment = async (parameters: CancelAppointmentRequestParams): Promise<any> => {
    return await makeZapRequest('cancel appointment', parameters, NotFoundAppointmentErrorHandler);
  };

  const checkIn = async (appointmentId: string): Promise<any> => {
    return await makeZapRequest('check in', { appointment: appointmentId }, NotFoundAppointmentErrorHandler);
  };

  const createAppointment = async (
    parameters: CreateAppointmentUCTelemedParams
  ): Promise<CreateAppointmentUCTelemedResponse> => {
    const fhirParams = fhirifyAppointmentInputs({ ...parameters });
    return await makeZapRequest('create appointment', fhirParams);
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

  const deletePaymentMethod = async (parameters: PaymentMethodDeleteParameters): Promise<unknown> => {
    return await makeZapRequest('delete payment method', parameters);
  };

  const getAppointments = async (
    parameters?: GetTelemedAppointmentsRequest
  ): Promise<GetTelemedAppointmentsResponseEhr> => {
    return await makeZapRequest('get appointments', parameters);
  };

  const getPastVisits = async (parameters?: GetAppointmentsRequest): Promise<GetPastVisitsResponse> => {
    return await makeZapRequest('get past visits', parameters);
  };

  const getEligibility = async (parameters: GetEligibilityParameters): Promise<GetEligibilityResponse> => {
    return await makeZapRequest('get eligibility', parameters);
  };

  const getVisitDetails = async (parameters: GetVisitDetailsRequest): Promise<GetVisitDetailsResponse> => {
    return await makeZapRequest('get visit details', parameters, NotFoundAppointmentErrorHandler);
  };

  const getAnswerOptions = async (parameters: GetAnswerOptionsRequest): Promise<QuestionnaireItemAnswerOption[]> => {
    return await makeZapRequest('get answer options', parameters);
  };

  const getSchedule = async (parameters: GetScheduleRequestParams): Promise<GetScheduleResponse> => {
    return await makeZapRequest('get schedule', parameters);
  };

  const getPaperworkPublic = async (
    parameters: GetPaperworkRequestParams
  ): Promise<PaperworkResponseWithoutResponses> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundAppointmentErrorHandler);
  };

  const getPaperwork = async (parameters: GetPaperworkRequestParams): Promise<UCGetPaperworkResponse> => {
    return await makeZapRequest('get paperwork', parameters, NotFoundAppointmentErrorHandler);
  };

  const getPatients = async (): Promise<{ patients: PatientInfo[] }> => {
    return await makeZapRequest('get patients');
  };

  const getPaymentMethods = async (parameters: PaymentMethodListParameters): Promise<{ cards: CreditCardInfo[] }> => {
    return await makeZapRequest('get payment methods', parameters);
  };

  const getPresignedFileURL = async (appointmentID: string, fileType: string, fileFormat: string): Promise<any> => {
    const payload = {
      appointmentID,
      fileType,
      fileFormat,
    };
    return await makeZapRequest('get presigned file url', payload);
  };

  const getTelemedStates = async (): Promise<GetTelemedLocationsResponse> => {
    return await makeZapRequest('get telemed states');
  };

  const getWaitStatus = async (
    parameters: Omit<WaitingRoomInput, 'secrets' | 'authorization'>
  ): Promise<WaitingRoomResponse> => {
    return await makeZapRequest('get wait status', parameters);
  };

  const joinCall = async (parameters: JoinCallRequestParameters): Promise<JoinCallResponse> => {
    return await makeZapRequest('join call', parameters);
  };

  const setDefaultPaymentMethod = async (parameters: PaymentMethodSetDefaultParameters): Promise<unknown> => {
    return await makeZapRequest('set default payment method', parameters);
  };

  const setupPaymentMethod = async (parameters: PaymentMethodSetupParameters): Promise<string> => {
    return await makeZapRequest('setup payment method', parameters);
  };

  const updateAppointment = async (parameters: UpdateAppointmentRequestParams): Promise<UpdateAppointmentResponse> => {
    return await makeZapRequest('update appointment', parameters);
  };

  const patchPaperwork = async (parameters: PatchPaperworkParameters): Promise<QuestionnaireResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)
      )
    );
    return await makeZapRequest('patch paperwork', payload);
  };

  const submitPaperwork = async (parameters: SubmitPaperworkParameters): Promise<QuestionnaireResponse> => {
    const payload = Object.fromEntries(
      Object.entries(parameters).filter(
        ([_parameterKey, parameterValue]) =>
          parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)
      )
    );
    return await makeZapRequest('submit paperwork', payload);
  };

  const videoChatCancelInvite = async (
    parameters: CancelInviteParticipantRequestParameters
  ): Promise<CancelInviteParticipantResponse> => {
    return await makeZapRequest('video chat cancel invite', parameters);
  };

  const videoChatCreateInvite = async (
    parameters: InviteParticipantRequestParameters
  ): Promise<VideoChatCreateInviteResponse> => {
    return await makeZapRequest('video chat create invite', parameters);
  };

  const videoChatListInvites = async (
    parameters: ListInvitedParticipantsRequestParameters
  ): Promise<ListInvitedParticipantsResponse> => {
    return await makeZapRequest('video chat list invites', parameters);
  };

  const listBookables = async (parameters: GetBookableItemListParams): Promise<BookableItemListResponse> => {
    return await makeZapRequest('list bookables', parameters);
  };

  return {
    cancelAppointment,
    checkIn,
    createAppointment,
    createZ3Object,
    deletePaymentMethod,
    getAppointments,
    getPastVisits,
    getEligibility,
    getVisitDetails,
    getAnswerOptions,
    getSchedule,
    getPaperworkPublic,
    getPaperwork,
    getPatients,
    getPaymentMethods,
    getTelemedStates,
    getWaitStatus,
    joinCall,
    setDefaultPaymentMethod,
    setupPaymentMethod,
    updateAppointment,
    patchPaperwork,
    submitPaperwork,
    videoChatCancelInvite,
    videoChatCreateInvite,
    videoChatListInvites,
    listBookables,
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

const InternalError: APIError = {
  message: 'Internal Service Error',
};

const isApiError = (error: any): boolean => error instanceof Object && error && 'message' in error;

export const apiErrorToThrow = (error: any): APIError => {
  console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    return error;
  } else {
    console.error('An endpoint threw and did not provide a well formed ApiError');
    return InternalError;
  }
};

function NotFoundAppointmentErrorHandler(error: any): void {
  if (error.message === 'Appointment is not found') {
    throw error;
  }
}
