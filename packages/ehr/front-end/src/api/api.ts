import { AppClient, User, ZambdaClient } from '@zapehr/sdk';
import {
  DeactivateUserParameters,
  GetAppointmentsParameters,
  CreateAppointmentParameters,
  GetPatientParameters,
  UpdateUserParameters,
} from '../types/types';

export interface PatchOperation {
  // https://www.hl7.org/fhir/fhirpatch.html
  op: 'add' | 'insert' | 'delete' | 'replace' | 'move';
  path: string;
  value: string | object | boolean;
}

const VITE_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;
const GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID;
const CREATE_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;
const GET_PATIENT_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PATIENT_ZAMBDA_ID;
const GET_PATIENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PATIENTS_ZAMBDA_ID;
const UPDATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_USER_ZAMBDA_ID;
const DEACTIVATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_DEACTIVATE_USER_ZAMBDA_ID;
const GET_TOKEN_FOR_CONVERSATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_TOKEN_FOR_CONVERSATION_ZAMBDA_ID;

function chooseJson(json: any, isLocal: string): any {
  return isLocal === 'true' ? json : json.output;
}

export const getUser = async (token: string): Promise<User> => {
  const appClient = new AppClient({
    apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
    accessToken: token,
  });
  return appClient.getMe();
};

if (!VITE_APP_IS_LOCAL) {
  throw new Error('VITE_APP_IS_LOCAL is not defined');
}

export const getAppointments = async (
  zambdaClient: ZambdaClient,
  parameters: GetAppointmentsParameters,
): Promise<any> => {
  try {
    if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
      throw new Error('get appointments environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_APPOINTMENTS_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const createAppointment = async (
  zambdaClient: ZambdaClient,
  parameters: CreateAppointmentParameters,
): Promise<any> => {
  try {
    if (CREATE_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('create appointment environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: CREATE_APPOINTMENT_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const getPatient = async (zambdaClient: ZambdaClient, parameters: GetPatientParameters): Promise<any> => {
  try {
    if (GET_PATIENT_ZAMBDA_ID == null) {
      throw new Error('get patient environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_PATIENT_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const getAllPatients = async (zambdaClient: ZambdaClient): Promise<any> => {
  try {
    if (GET_PATIENTS_ZAMBDA_ID == null) {
      throw new Error('get patient environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_PATIENTS_ZAMBDA_ID,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const updateUser = async (zambdaClient: ZambdaClient, parameters: UpdateUserParameters): Promise<any> => {
  try {
    if (UPDATE_USER_ZAMBDA_ID == null) {
      throw new Error('update user environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: UPDATE_USER_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const deactivateUser = async (
  zambdaClient: ZambdaClient,
  parameters: DeactivateUserParameters,
): Promise<any> => {
  try {
    if (DEACTIVATE_USER_ZAMBDA_ID == null) {
      throw new Error('deactivate user environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: DEACTIVATE_USER_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const getTokenForConversation = async (zambdaClient: ZambdaClient): Promise<any> => {
  try {
    if (GET_TOKEN_FOR_CONVERSATION_ZAMBDA_ID == null) {
      throw new Error('get token for conversation environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_TOKEN_FOR_CONVERSATION_ZAMBDA_ID,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};
