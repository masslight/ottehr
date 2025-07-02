// cSpell:ignore fhirify
import { Consent, QuestionnaireResponse, Slot } from 'fhir/r4b';
import {
  CancelAppointmentZambdaInput,
  CancelAppointmentZambdaOutput,
  CheckInInput,
  CheckInZambdaOutput,
  chooseJson,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  GetAppointmentDetailsResponse,
  GetEligibilityParameters,
  GetEligibilityResponse,
  GetPresignedFileURLInput,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetSlotDetailsParams,
  GetSlotDetailsResponse,
  HandleAnswerInput,
  isApiError,
  isoStringFromMDYString,
  PatchPaperworkParameters,
  PatientInfo,
  PersistConsentInput,
  PresignUploadUrlResponse,
  StartInterviewInput,
  SubmitPaperworkParameters,
  UCGetPaperworkResponse,
  UpdateAppointmentParameters,
  UpdateAppointmentZambdaOutput,
  WalkinAvailabilityCheckParams,
  WalkinAvailabilityCheckResult,
} from 'utils';
import { ZambdaClient } from '../hooks/useUCZambdaClient';
import { GetAppointmentParameters, GetPaperworkParameters } from '../types/types';
import { apiErrorToThrow } from './errorHelpers';

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

const REACT_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;
const CHECK_IN_ZAMBDA_ID = 'check-in';
const CREATE_APPOINTMENT_ZAMBDA_ID = 'create-appointment';
const CANCEL_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_APPOINTMENT_ZAMBDA_ID;
const UPDATE_APPOINTMENT_ZAMBDA_ID = 'update-appointment';
const GET_PATIENTS_ZAMBDA_ID = 'get-patients';
const GET_SCHEDULE_ZAMBDA_ID = 'get-schedule';
const TELEMED_GET_APPOINTMENTS_ZAMBDA_ID = 'telemed-get-appointments';
const GET_PAPERWORK_ZAMBDA_ID = 'get-paperwork';
const GET_PRESIGNED_FILE_URL = 'get-presigned-file-url';
const GET_APPOINTMENT_DETAILS = 'get-appointment-details';
const PATCH_PAPERWORK_ZAMBDA_ID = 'patch-paperwork';
const SUBMIT_PAPERWORK_ZAMBDA_ID = 'submit-paperwork';
const GET_ELIGIBILITY_ZAMBDA_ID = 'get-eligibility';
const AI_INTERVIEW_START_ZAMBDA_ID = 'ai-interview-start';
const AI_INTERVIEW_HANDLE_ANSWER_ZAMBDA_ID = 'ai-interview-handle-answer';
const AI_INTERVIEW_PERSIST_CONSENT_ZAMBDA_ID = 'ai-interview-persist-consent';
const GET_WALKIN_AVAILABILITY_ZAMBDA_ID = 'walkin-check-availability';
const CREATE_SLOT_ZAMBDA_ID = 'create-slot';
const GET_SLOT_DETAILS_ZAMBDA_ID = 'get-slot-details';

class API {
  async checkIn(
    zambdaClient: ZambdaClient,
    parameters: CheckInInput,
    throwError = true
  ): Promise<CheckInZambdaOutput | undefined> {
    try {
      if (CHECK_IN_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('check in environment variable could not be loaded');
      }
      const response = await zambdaClient.executePublic(CHECK_IN_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: any) {
      if (throwError) {
        throw apiErrorToThrow(error, !isApiError(error));
      } else {
        // Fail silently
        console.error('Error checking in appointment', error); // TODO this can't be a good thing why fail silently?
        return undefined;
      }
    }
  }

  async createAppointment(
    zambdaClient: ZambdaClient,
    parameters: CreateAppointmentInputParams
  ): Promise<CreateAppointmentResponse> {
    try {
      if (CREATE_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('create appointment environment variable could not be loaded');
      }

      const fhirParams = fhirifyAppointmentInputs({ ...parameters });
      const response = await zambdaClient.execute(CREATE_APPOINTMENT_ZAMBDA_ID, fhirParams);

      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, !isApiError(error));
    }
  }

  async cancelAppointment(
    zambdaClient: ZambdaClient,
    parameters: CancelAppointmentZambdaInput,
    throwError = true
  ): Promise<CancelAppointmentZambdaOutput | void> {
    try {
      if (CANCEL_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('cancel appointment environment variable could not be loaded');
      }

      const response = await zambdaClient.executePublic(CANCEL_APPOINTMENT_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: any) {
      if (throwError) {
        throw apiErrorToThrow(error, !isApiError(error));
      } else {
        // Fail silently
        console.error('Error cancelling appointment', error);
        return;
      }
    }
  }

  async updateAppointment(
    zambdaClient: ZambdaClient,
    parameters: UpdateAppointmentParameters
  ): Promise<UpdateAppointmentZambdaOutput> {
    try {
      if (UPDATE_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const response = await zambdaClient.executePublic(UPDATE_APPOINTMENT_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      console.log('error', error);
      throw apiErrorToThrow(error, !isApiError(error));
    }
  }

  async getPatients(zambdaClient: ZambdaClient): Promise<{ patients: PatientInfo[] }> {
    try {
      if (GET_PATIENTS_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get patients environment variable could not be loaded');
      }

      const response = await zambdaClient.execute(GET_PATIENTS_ZAMBDA_ID);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async patchPaperwork(
    zambdaClient: ZambdaClient,
    parameters: PatchPaperworkParameters
  ): Promise<QuestionnaireResponse> {
    try {
      if (PATCH_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const { answers, questionnaireResponseId } = parameters;
      const response = await zambdaClient.executePublic(PATCH_PAPERWORK_ZAMBDA_ID, {
        answers,
        questionnaireResponseId,
      });

      const jsonToUse = chooseJson(response);
      return jsonToUse as QuestionnaireResponse;
    } catch (error: unknown) {
      console.error('Error updating paperwork', error);
      throw apiErrorToThrow(error, false);
    }
  }

  async submitPaperwork(
    zambdaClient: ZambdaClient,
    parameters: SubmitPaperworkParameters
  ): Promise<QuestionnaireResponse> {
    try {
      if (SUBMIT_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const { answers } = parameters;

      console.log('PAPERWORK SUBMIT ANSWERS', answers);

      const response = await zambdaClient.executePublic(SUBMIT_PAPERWORK_ZAMBDA_ID, parameters);

      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, false);
    }
  }

  async getSchedule(zambdaClient: ZambdaClient, parameters: GetScheduleRequestParams): Promise<GetScheduleResponse> {
    try {
      if (GET_SCHEDULE_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get locations environment variable could not be loaded');
      }

      const response = await zambdaClient.executePublic(GET_SCHEDULE_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, false);
    }
  }

  async getAppointmentDetails(
    zambdaClient: ZambdaClient,
    appointmentID: string
  ): Promise<GetAppointmentDetailsResponse> {
    try {
      if (GET_APPOINTMENT_DETAILS == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get appointment detail environment variable could not be loaded');
      }

      const response = await zambdaClient.executePublic(GET_APPOINTMENT_DETAILS, { appointmentID: appointmentID });
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, false);
    }
  }

  async getAppointments(zambdaClient: ZambdaClient, parameters?: GetAppointmentParameters): Promise<any> {
    try {
      if (TELEMED_GET_APPOINTMENTS_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get appointments environment variable could not be loaded');
      }
      const response = await zambdaClient.execute(TELEMED_GET_APPOINTMENTS_ZAMBDA_ID, parameters);

      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getPaperwork(zambdaClient: ZambdaClient, parameters: GetPaperworkParameters): Promise<UCGetPaperworkResponse> {
    try {
      if (GET_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get paperwork environment variable could not be loaded');
      }
      if (!zambdaClient) {
        throw new Error('zambda client not defined in getPaperwork');
      }
      if (!parameters) {
        throw new Error('get paperwork parameters missing');
      }

      const response = await zambdaClient.executePublic(GET_PAPERWORK_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: any) {
      console.log('error from get paperwork', error);
      if (isApiError(error)) {
        throw error;
      } else {
        console.log('api error not recognized');
        // todo: fix our awful error handling patterns
        throw apiErrorToThrow(error);
      }
    }
  }

  async createZ3Object(
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    zambdaClient: ZambdaClient,
    file: File
  ): Promise<any> {
    try {
      const presignedURLRequest = await this.getPresignedFileURL(
        {
          appointmentID,
          fileType: fileType as GetPresignedFileURLInput['fileType'],
          fileFormat: fileFormat as GetPresignedFileURLInput['fileFormat'],
        },
        zambdaClient
      );

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
  }

  async getZ3Object(url: string, token: string): Promise<string> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();
      const signedUrl = json.signedUrl;
      return signedUrl;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getPresignedFileURL(
    params: GetPresignedFileURLInput,
    zambdaClient: ZambdaClient
  ): Promise<PresignUploadUrlResponse> {
    try {
      if (GET_PRESIGNED_FILE_URL == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get presigned file url environment variable could not be loaded');
      }
      const { appointmentID, fileType, fileFormat } = params;

      const response = await zambdaClient.executePublic(GET_PRESIGNED_FILE_URL, {
        appointmentID,
        fileType,
        fileFormat,
      });
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }
  async getEligibility(input: GetEligibilityParameters, zambdaClient: ZambdaClient): Promise<GetEligibilityResponse> {
    try {
      if (GET_ELIGIBILITY_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get presigned file url environment variable could not be loaded');
      }

      const response = await zambdaClient.execute(GET_ELIGIBILITY_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }
  async getWalkinAvailability(
    input: WalkinAvailabilityCheckParams,
    zambdaClient: ZambdaClient
  ): Promise<WalkinAvailabilityCheckResult> {
    try {
      const response = await zambdaClient.executePublic(GET_WALKIN_AVAILABILITY_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async createSlot(input: CreateSlotParams, zambdaClient: ZambdaClient): Promise<Slot> {
    try {
      const response = await zambdaClient.executePublic(CREATE_SLOT_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getSlotDetails(input: GetSlotDetailsParams, zambdaClient: ZambdaClient): Promise<GetSlotDetailsResponse> {
    try {
      const response = await zambdaClient.executePublic(GET_SLOT_DETAILS_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async aIInterviewStart(input: StartInterviewInput, zambdaClient: ZambdaClient): Promise<QuestionnaireResponse> {
    try {
      if (AI_INTERVIEW_START_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('AI_INTERVIEW_START_ZAMBDA_ID environment variable is missing');
      }
      const response = await zambdaClient.execute(AI_INTERVIEW_START_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse as QuestionnaireResponse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async aIInterviewHandleAnswer(input: HandleAnswerInput, zambdaClient: ZambdaClient): Promise<QuestionnaireResponse> {
    try {
      if (AI_INTERVIEW_HANDLE_ANSWER_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('AI_INTERVIEW_HANDLE_ANSWER_ZAMBDA_ID environment variable is missing');
      }
      const response = await zambdaClient.execute(AI_INTERVIEW_HANDLE_ANSWER_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse as QuestionnaireResponse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async aIInterviewPersistConsent(input: PersistConsentInput, zambdaClient: ZambdaClient): Promise<Consent> {
    try {
      if (AI_INTERVIEW_PERSIST_CONSENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('AI_INTERVIEW_PERSIST_CONSENT_ZAMBDA_ID environment variable is missing');
      }
      const response = await zambdaClient.execute(AI_INTERVIEW_PERSIST_CONSENT_ZAMBDA_ID, input);
      const jsonToUse = chooseJson(response);
      return jsonToUse as Consent;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }
}

const api = new API();

export default api;

const fhirifyAppointmentInputs = (inputs: CreateAppointmentInputParams): CreateAppointmentInputParams => {
  const returnParams = { ...inputs };

  const { patient } = returnParams;

  const { dateOfBirth: patientBirthDate } = patient as PatientInfo;
  if (patient) {
    patient.dateOfBirth = isoStringFromMDYString(patientBirthDate ?? '');
  }

  returnParams.patient = patient;

  return returnParams;
};
