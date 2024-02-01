import { ZambdaClient } from '@zapehr/sdk';
import { Address, ContactPoint, LocationHoursOfOperation } from 'fhir/r4';
import { Dispatch } from 'react';
import { isoStringFromMDYString } from '../helpers';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeAction, PatientInfo } from '../store/types';
import { CreateAppointmentParameters } from '../types';
import {
  CancelAppointmentParameters,
  GetLocationParameters,
  GetPaperworkParameters,
  PaperworkResponseWithResponses,
  UpdateAppointmentParameters,
  UpdatePaperworkParameters,
} from '../types/types';
import { apiErrorToThrow } from './apiErrorToThrow';

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
const GET_LOCATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LOCATION_ZAMBDA_ID;
const GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID;
const GET_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PAPERWORK_ZAMBDA_ID;
const GET_PRESIGNED_FILE_URL = import.meta.env.VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID;

function chooseJson(json: any, isLocal: string): any {
  return isLocal === 'true' ? json : json.output;
}

export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  timezone: string | undefined;
}

interface GetLocationResponse {
  message: string;
  location: AvailableLocationInformation;
  available: string[];
  waitingMinutes: number;
}

class API {
  async checkIn(zambdaClient: ZambdaClient, appointmentID: string, dispatch: Dispatch<IntakeAction>): Promise<any> {
    try {
      if (CHECK_IN_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('check in environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: CHECK_IN_ZAMBDA_ID,
        payload: { appointment: appointmentID },
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: any) {
      if (error.message === 'Appointment is not found') {
        throw error;
      }
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async createAppointment(
    zambdaClient: ZambdaClient,
    parameters: CreateAppointmentParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      if (CREATE_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('create appointment environment variable could not be loaded');
      }

      const fhirParams = fhirifyAppointmentInputs({ ...parameters });
      const response = await zambdaClient?.invokeZambda({
        zambdaId: CREATE_APPOINTMENT_ZAMBDA_ID,
        payload: fhirParams,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async cancelAppointment(
    zambdaClient: ZambdaClient,
    parameters: CancelAppointmentParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      if (CANCEL_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('cancel appointment environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: CANCEL_APPOINTMENT_ZAMBDA_ID,
        payload: parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: any) {
      if (error.message === 'Appointment is not found') {
        throw error;
      }
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async updateAppointment(
    zambdaClient: ZambdaClient,
    parameters: UpdateAppointmentParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      if (UPDATE_APPOINTMENT_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: UPDATE_APPOINTMENT_ZAMBDA_ID,
        payload: parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getPatients(zambdaClient: ZambdaClient, dispatch: Dispatch<IntakeAction>): Promise<any> {
    try {
      if (GET_PATIENTS_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get patients environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokeZambda({
        zambdaId: GET_PATIENTS_ZAMBDA_ID,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async updatePaperwork(
    zambdaClient: ZambdaClient,
    parameters: UpdatePaperworkParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      if (UPDATE_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('update appointment environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: UPDATE_PAPERWORK_ZAMBDA_ID,
        payload: parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getLocation(
    zambdaClient: ZambdaClient,
    parameters: GetLocationParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<GetLocationResponse> {
    try {
      if (GET_LOCATION_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get locations environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: GET_LOCATION_ZAMBDA_ID,
        payload: parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getAppointments(zambdaClient: ZambdaClient, dispatch: Dispatch<IntakeAction>): Promise<any> {
    try {
      if (GET_APPOINTMENTS_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get appointments environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokeZambda({
        zambdaId: GET_APPOINTMENTS_ZAMBDA_ID,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getPaperwork(
    zambdaClient: ZambdaClient,
    parameters: GetPaperworkParameters,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<PaperworkResponseWithResponses> {
    try {
      if (GET_PAPERWORK_ZAMBDA_ID == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get paperwork environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: GET_PAPERWORK_ZAMBDA_ID,
        payload: parameters,
      });

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: any) {
      if (error.message === 'Appointment is not found') {
        throw error;
      }
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async createZ3Object(
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    zambdaClient: ZambdaClient,
    file: File,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      const presignedURLRequest = await this.getPresignedFileURL(
        appointmentID,
        fileType,
        fileFormat,
        zambdaClient,
        dispatch,
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
        throw new Error('Failed to upload file', await uploadResponse.json());
      }

      return presignedURLRequest;
    } catch (error: unknown) {
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getZ3Object(url: string, token: string, dispatch: Dispatch<IntakeAction>): Promise<string> {
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
      throw apiErrorToThrow(error, dispatch);
    }
  }

  async getPresignedFileURL(
    appointmentID: string,
    fileType: string,
    fileFormat: string,
    zambdaClient: ZambdaClient,
    dispatch: Dispatch<IntakeAction>,
  ): Promise<any> {
    try {
      if (GET_PRESIGNED_FILE_URL == null || REACT_APP_IS_LOCAL == null) {
        throw new Error('get presigned file url environment variable could not be loaded');
      }
      console.log(1);
      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: GET_PRESIGNED_FILE_URL,
        payload: {
          appointmentID,
          fileType,
          fileFormat,
        },
      });
      console.log(1);

      const jsonToUse = chooseJson(response, REACT_APP_IS_LOCAL);
      return jsonToUse;
    } catch (error: unknown) {
      safelyCaptureException(error);
      throw apiErrorToThrow(error, dispatch);
    }
  }
}

const api = new API();

export default api;

const fhirifyAppointmentInputs = (inputs: CreateAppointmentParameters): CreateAppointmentParameters => {
  const returnParams = { ...inputs };

  const { patient } = returnParams;

  const { dateOfBirth: patientBirthDate } = patient as PatientInfo;
  if (patient) {
    patient.dateOfBirth = isoStringFromMDYString(patientBirthDate ?? '');
  }

  returnParams.patient = patient;

  return returnParams;
};
