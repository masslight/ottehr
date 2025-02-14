import { Address, ContactPoint, LocationHoursOfOperation, QuestionnaireResponse } from 'fhir/r4b';
import { ZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import {
  Closure,
  CreateAppointmentInputParams,
  GetEligibilityParameters,
  GetEligibilityResponse,
  GetPresignedFileURLInput,
  GetScheduleRequestParams,
  GetScheduleResponse,
  PatchPaperworkParameters,
  PatientInfo,
  PresignUploadUrlResponse,
  ScheduleType,
  SubmitPaperworkParameters,
  UCGetPaperworkResponse,
  VisitType,
  isApiError,
  isoStringFromMDYString,
} from 'utils';
import {
  CancelAppointmentParameters,
  GetAppointmentParameters,
  GetPaperworkParameters,
  UpdateAppointmentParameters,
  UpdatePaperworkParameters,
} from '../types/types';
import { apiErrorToThrow } from './errorHelpers';

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

const REACT_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;
const CHECK_IN_ZAMBDA_ID = import.meta.env.VITE_APP_CHECK_IN_ZAMBDA_ID;
const CREATE_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;
const CANCEL_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_APPOINTMENT_ZAMBDA_ID;
const UPDATE_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_APPOINTMENT_ZAMBDA_ID;
const GET_PATIENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PATIENTS_ZAMBDA_ID;
const UPDATE_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_PAPERWORK_ZAMBDA_ID;
const GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_GET_SCHEDULE_ZAMBDA_ID;
const TELEMED_GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_APP_TELEMED_GET_APPOINTMENTS_ZAMBDA_ID;
const GET_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PAPERWORK_ZAMBDA_ID;
const GET_PRESIGNED_FILE_URL = import.meta.env.VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID;
const GET_APPOINTMENT_DETAILS = import.meta.env.VITE_APP_GET_APPOINTMENT_DETAILS;
const PATCH_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_PATCH_PAPERWORK_ZAMBDA_ID;
const SUBMIT_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_SUBMIT_PAPERWORK_ZAMBDA_ID;
const GET_ELIGIBILITY_ZAMBDA_ID = import.meta.env.VITE_APP_GET_ELIGIBILITY_ZAMBDA_ID;

export function chooseJson(json: any, isLocal: string): any {
  if (isLocal === 'true' || !json.output) {
    return json;
  } else {
    return json.output;
  }
}

export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  closures: Closure[];
  timezone: string | undefined;
  otherOffices: { display: string; url: string }[];
  scheduleType: ScheduleType;
}

export interface AppointmentBasicInfo {
  start: string;
  location: AvailableLocationInformation;
  visitType: string;
  status?: string;
}
interface GetAppointmentDetailsResponse {
  appointment: AppointmentBasicInfo;
  availableSlots: string[];
  displayTomorrowSlotsAtHour: number;
}

export interface CreateAppointmentResponse {
  message: string;
  appointment: string;
  fhirPatientId: string;
}

export interface CancelAppointmentResponse {
  appointment: string | null;
  location: AvailableLocationInformation;
  visitType: VisitType;
}

class API {
  async checkIn(zambdaClient: ZambdaClient, appointmentID: string, throwError = true): Promise<any> {
    try {
      if (CHECK_IN_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('check in environment variable could not be loaded');
      }
      const response = await zambdaClient.executePublic(CHECK_IN_ZAMBDA_ID, { appointment: appointmentID });
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: any) {
      if (throwError) {
        throw apiErrorToThrow(error, !isApiError(error));
      } else {
        // Fail silently
        console.error('Error checking in appointment', error);
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

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, !isApiError(error));
    }
  }

  async cancelAppointment(
    zambdaClient: ZambdaClient,
    parameters: CancelAppointmentParameters,
    throwError = true
  ): Promise<CancelAppointmentResponse | void> {
    try {
      if (CANCEL_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('cancel appointment environment variable could not be loaded');
      }

      const response = await zambdaClient.executePublic(CANCEL_APPOINTMENT_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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

  async updateAppointment(zambdaClient: ZambdaClient, parameters: UpdateAppointmentParameters): Promise<any> {
    try {
      if (UPDATE_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const response = await zambdaClient.executePublic(UPDATE_APPOINTMENT_ZAMBDA_ID, parameters);
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      console.log('error', error);
      throw apiErrorToThrow(error, !isApiError(error));
    }
  }

  async getPatients(zambdaClient: ZambdaClient): Promise<any> {
    try {
      if (GET_PATIENTS_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get patients environment variable could not be loaded');
      }

      const response = await zambdaClient.execute(GET_PATIENTS_ZAMBDA_ID);
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async updatePaperworkInProgress(
    zambdaClient: ZambdaClient,
    parameters: UpdatePaperworkParameters,
    throwError = true
  ): Promise<any> {
    try {
      if (UPDATE_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      // Exclude local file data from paperwork so it doesn't get saved in QuestionnaireResponse.
      const response = await zambdaClient.executePublic(UPDATE_PAPERWORK_ZAMBDA_ID, {
        ...parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      if (throwError) {
        throw apiErrorToThrow(error);
      } else {
        // Fail silently
        console.error('Error updating paperwork', error);
      }
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

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
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
      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      console.log('json from get eligibility', jsonToUse);
      return jsonToUse;
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
