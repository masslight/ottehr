import Oystehr, { User } from '@oystehr/sdk';
import { Address, ContactPoint, LocationHoursOfOperation } from 'fhir/r4b';
import {
  ConversationMessage,
  GetEmployeesResponse,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetUserParams,
  GetUserResponse,
} from 'utils';
import {
  CancelAppointmentParameters,
  CreateAppointmentParameters,
  DeactivateUserParameters,
  GetAppointmentsParameters,
  SaveFollowupParameter,
  AssignPractitionerParameters,
  UnassignPractitionerParameters,
  ChangeInPersonVisitStatusParameters,
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
const ASSIGN_PRACTITIONER_ZAMBDA_ID = import.meta.env.VITE_APP_ASSIGN_PRACTITIONER_ZAMBDA_ID;
const UNASSIGN_PRACTITIONER_ZAMBDA_ID = import.meta.env.VITE_APP_UNASSIGN_PRACTITIONER_ZAMBDA_ID;
const CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID = import.meta.env.VITE_APP_CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID;
const GET_USER_ZAMBDA_ID = import.meta.env.VITE_APP_GET_USER_ZAMBDA_ID;
const DEACTIVATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_DEACTIVATE_USER_ZAMBDA_ID;
const GET_CONVERSATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_CONVERSATION_ZAMBDA_ID;
const GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_GET_SCHEDULE_ZAMBDA_ID;
const CANCEL_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_APPOINTMENT_ID;
const GET_EMPLOYEES_ZAMBDA_ID = import.meta.env.VITE_APP_GET_EMPLOYEES_ZAMBDA_ID;
const GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID;
const SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID = import.meta.env.VITE_APP_SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID;

function chooseJson(json: any, isLocal: string): any {
  return isLocal === 'true' ? json : json.output;
}

export const getUser = async (token: string): Promise<User> => {
  const oystehr = new Oystehr({
    accessToken: token,
    projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
  });
  return oystehr.user.me();
};

if (!VITE_APP_IS_LOCAL) {
  throw new Error('VITE_APP_IS_LOCAL is not defined');
}

export const getAppointments = async (oystehr: Oystehr, parameters: GetAppointmentsParameters): Promise<any> => {
  try {
    if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
      throw new Error('get appointments environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_APPOINTMENTS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const createAppointment = async (oystehr: Oystehr, parameters: CreateAppointmentParameters): Promise<any> => {
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

    const response = await oystehr.zambda.execute({
      id: CREATE_APPOINTMENT_ZAMBDA_ID,
      ...translatedParams,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const saveFollowup = async (oystehr: Oystehr, parameters: SaveFollowupParameter): Promise<any> => {
  try {
    if (SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID == null) {
      throw new Error('save followup environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw new Error(JSON.stringify(error));
  }
};

export const cancelTelemedAppointment = async (
  oystehr: Oystehr,
  parameters: {
    appointmentID: string;
    cancellationReason: string;
    cancellationReasonAdditional?: string | undefined;
  }
): Promise<any> => {
  try {
    if (CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.executePublic({
      id: CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error, 'error');
    throw new Error(JSON.stringify(error));
  }
};

export const inviteParticipant = async (
  oystehr: Oystehr,
  parameters: {
    appointmentId: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber: string;
  }
): Promise<void> => {
  try {
    if (INVITE_PARTICIPANT_ZAMBDA_ID == null) {
      throw new Error('invite participant environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: INVITE_PARTICIPANT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error, 'Error occurred trying to invite participant');
    throw new Error(JSON.stringify(error));
  }
};

export const updateUser = async (oystehr: Oystehr, parameters: UpdateUserParameters): Promise<any> => {
  try {
    if (UPDATE_USER_ZAMBDA_ID == null) {
      throw new Error('update user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UPDATE_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const assignPractitioner = async (oystehr: Oystehr, parameters: AssignPractitionerParameters): Promise<any> => {
  try {
    if (ASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
      throw new Error('assign practitioner environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: ASSIGN_PRACTITIONER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unassignPractitioner = async (
  oystehr: Oystehr,
  parameters: UnassignPractitionerParameters
): Promise<any> => {
  try {
    if (UNASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
      throw new Error('unassign practitioner environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UNASSIGN_PRACTITIONER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const changeInPersonVisitStatus = async (
  oystehr: Oystehr,
  parameters: ChangeInPersonVisitStatusParameters
): Promise<any> => {
  try {
    if (CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID == null) {
      throw new Error('change in person visit status environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const getUserDetails = async (oystehr: Oystehr, parameters: GetUserParams): Promise<GetUserResponse> => {
  try {
    if (GET_USER_ZAMBDA_ID == null) {
      throw new Error('get user details environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    throw new Error(JSON.stringify(error));
  }
};

export const deactivateUser = async (oystehr: Oystehr, parameters: DeactivateUserParameters): Promise<any> => {
  try {
    if (DEACTIVATE_USER_ZAMBDA_ID == null) {
      throw new Error('deactivate user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: DEACTIVATE_USER_ZAMBDA_ID,
      ...parameters,
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
  oystehr: Oystehr,
  parameters: GetConversationParams
): Promise<ConversationMessage[]> => {
  try {
    if (GET_CONVERSATION_ZAMBDA_ID == null) {
      throw new Error('GET_CONVERSATION_ZAMBDA_ID environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_CONVERSATION_ZAMBDA_ID,
      ...parameters,
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

export const getLocations = async (
  oystehr: Oystehr,
  parameters: GetScheduleRequestParams
): Promise<GetScheduleResponse> => {
  try {
    if (GET_SCHEDULE_ZAMBDA_ID == null || VITE_APP_IS_LOCAL == null) {
      throw new Error('get location environment variable could not be loaded');
    }
    console.log(import.meta.env);
    const response = await oystehr.zambda.executePublic({
      id: GET_SCHEDULE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cancelAppointment = async (oystehr: Oystehr, parameters: CancelAppointmentParameters): Promise<any> => {
  try {
    if (CANCEL_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('cancel appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.executePublic({
      id: CANCEL_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getEmployees = async (oystehr: Oystehr): Promise<GetEmployeesResponse> => {
  try {
    if (GET_EMPLOYEES_ZAMBDA_ID == null) {
      throw new Error('get employees environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_EMPLOYEES_ZAMBDA_ID,
    });
    return chooseJson(response, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface UploadPatientProfilePhotoParameters {
  patientId: string;
  patientPhotoFile: File;
}

export interface UploadPatientProfilePhotoResponse {
  z3ImageUrl: string;
  presignedImageUrl: string;
}

export const uploadPatientProfilePhoto = async (
  oystehr: Oystehr,
  parameters: UploadPatientProfilePhotoParameters
): Promise<UploadPatientProfilePhotoResponse> => {
  try {
    if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
      throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
    }

    const urlSigningResponse = await oystehr.zambda.execute({
      id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID,
      ...parameters,
      action: 'upload',
    });

    const { presignedImageUrl } = chooseJson(urlSigningResponse, VITE_APP_IS_LOCAL);

    const photoFile = parameters.patientPhotoFile;
    // Upload the file to S3
    const uploadResponse = await fetch(presignedImageUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': photoFile.type,
      },
      body: photoFile,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return chooseJson(urlSigningResponse, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export interface GetPatientProfilePhotoParameters {
  z3PhotoUrl: string;
}
export interface GetPatientProfilePhotoResponse {
  z3ImageUrl: string;
  presignedImageUrl: string;
}

export const getSignedPatientProfilePhotoUrl = async (
  oystehr: Oystehr,
  parameters: GetPatientProfilePhotoParameters
): Promise<GetPatientProfilePhotoResponse> => {
  try {
    if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
      throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
    }

    const urlSigningResponse = await oystehr.zambda.execute({
      id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID,
      ...parameters,
      action: 'download',
    });

    return chooseJson(urlSigningResponse, VITE_APP_IS_LOCAL);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};
