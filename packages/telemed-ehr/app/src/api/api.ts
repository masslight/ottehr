import { AppClient, User, ZambdaClient } from '@zapehr/sdk';
import { Address, ContactPoint, LocationHoursOfOperation } from 'fhir/r4';
import { ConversationMessage } from 'ehr-utils';
import {
  CancelAppointmentParameters,
  CreateAppointmentParameters,
  DeactivateUserParameters,
  GetAppointmentsParameters,
  GetEmployeesResponse,
  GetUserParameters,
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
const CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID;
const INVITE_PARTICIPANT_ZAMBDA_ID = import.meta.env.VITE_APP_INVITE_PARTICIPANT_ZAMBDA_ID;
const UPDATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_USER_ZAMBDA_ID;
const GET_USER_ZAMBDA_ID = import.meta.env.VITE_APP_GET_USER_ZAMBDA_ID;
const DEACTIVATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_DEACTIVATE_USER_ZAMBDA_ID;
const GET_CONVERSATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_CONVERSATION_ZAMBDA_ID;
const GET_LOCATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LOCATION_ZAMBDA_ID;
const CANCEL_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_APPOINTMENT_ID;
const GET_EMPLOYEES_ZAMBDA_ID = import.meta.env.VITE_APP_GET_EMPLOYEES_ZAMBDA_ID;

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

    // we currently have two different visit type conventions on telemed and ehr, one with '-'
    // separating the distinct words / prefix adn word and one where it's just continuous chars
    const translatedParams = {
      ...parameters,
      visitType: parameters.visitType?.replace('-', ''),
    };

    const response = await zambdaClient?.invokeZambda({
      zambdaId: CREATE_APPOINTMENT_ZAMBDA_ID,
      payload: translatedParams,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const cancelTelemedAppointment = async (
  zambdaClient: ZambdaClient,
  parameters: {
    appointmentID: string;
    cancellationReason: string;
    cancellationReasonAdditional?: string | undefined;
  },
): Promise<any> => {
  try {
    if (CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error, 'error');
    throw new Error(JSON.stringify(error));
  }
};

export const inviteParticipant = async (
  zambdaClient: ZambdaClient,
  parameters: {
    appointmentId: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber: string;
  },
): Promise<void> => {
  try {
    if (INVITE_PARTICIPANT_ZAMBDA_ID == null) {
      throw new Error('invite participant environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: INVITE_PARTICIPANT_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error, 'Error occurred trying to invite participant');
    throw new Error(JSON.stringify(error));
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

export const getUserDetails = async (zambdaClient: ZambdaClient, parameters: GetUserParameters): Promise<any> => {
  try {
    if (GET_USER_ZAMBDA_ID == null) {
      throw new Error('get user details environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_USER_ZAMBDA_ID,
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

interface GetConversationParams {
  smsNumbers: string[];
  timezone: string;
}
export const getConversation = async (
  zambdaClient: ZambdaClient,
  parameters: GetConversationParams,
): Promise<ConversationMessage[]> => {
  try {
    if (GET_CONVERSATION_ZAMBDA_ID == null) {
      throw new Error('GET_CONVERSATION_ZAMBDA_ID environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_CONVERSATION_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  timezone: string | undefined;
  otherOffices: { display: string; url: string }[];
}

export interface GetLocationResponse {
  message: string;
  state: string;
  name: string;
  slug: string;
  locationID?: string;
  providerID?: string;
  groupID?: string;
  availableSlots: string[];
  available: boolean;
  timezone: string;
}

export interface GetLocationParameters {
  slug?: string;
  scheduleType?: 'location' | 'provider' | 'group';
  locationState?: string;
  fetchAll?: boolean;
}

export const getLocations = async (
  zambdaClient: ZambdaClient,
  parameters: GetLocationParameters,
): Promise<GetLocationResponse> => {
  try {
    if (GET_LOCATION_ZAMBDA_ID == null || VITE_APP_IS_LOCAL == null) {
      throw new Error('get location environment variable could not be loaded');
    }
    console.log(import.meta.env);
    const response = await zambdaClient?.invokePublicZambda({
      zambdaId: GET_LOCATION_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cancelAppointment = async (
  zambdaClient: ZambdaClient,
  parameters: CancelAppointmentParameters,
): Promise<any> => {
  try {
    if (CANCEL_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokePublicZambda({
      zambdaId: CANCEL_APPOINTMENT_ZAMBDA_ID,
      payload: parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getEmployees = async (zambdaClient: ZambdaClient): Promise<GetEmployeesResponse> => {
  try {
    if (GET_EMPLOYEES_ZAMBDA_ID == null) {
      throw new Error('get employees environment variable could not be loaded');
    }

    const response = await zambdaClient?.invokeZambda({
      zambdaId: GET_EMPLOYEES_ZAMBDA_ID,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
