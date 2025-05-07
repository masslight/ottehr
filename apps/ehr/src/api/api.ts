import Oystehr, { User } from '@oystehr/sdk';
import { Address, ContactPoint, LocationHoursOfOperation, Schedule, Slot } from 'fhir/r4b';
import {
  chooseJson,
  ConversationMessage,
  SubmitLabOrderInput,
  CreateScheduleParams,
  CreateUserOutput,
  CreateUserParams,
  GetEmployeesResponse,
  GetScheduleParams,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetUserParams,
  GetUserResponse,
  PaginatedLabOrderResponse,
  CreateLabOrderParameters,
  GetCreateLabOrderResources,
  LabOrderResourcesRes,
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  ScheduleDTO,
  UpdateScheduleParams,
  CreateRadiologyZambdaOrderInput,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOutput,
  GetLabOrdersParameters,
  DeleteLabOrderParams,
  SubmitLabOrderDTO,
  CreateAppointmentInputParams,
  UpdateLabOrderResourcesParameters,
  CreateSlotParams,
  apiErrorToThrow,
} from 'utils';
import {
  CancelAppointmentParameters,
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
const SUBMIT_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_SUBMIT_LAB_ORDER_ZAMBDA_ID;
const GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID;
const CREATE_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;
const CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID;
const INVITE_PARTICIPANT_ZAMBDA_ID = import.meta.env.VITE_APP_INVITE_PARTICIPANT_ZAMBDA_ID;
const CREATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_USER_ZAMBDA_ID;
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
const CREATE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_LAB_ORDER_ZAMBDA_ID;
const GET_CREATE_LAB_ORDER_RESOURCES = import.meta.env.VITE_APP_GET_CREATE_LAB_ORDER_RESOURCES;
const GET_LAB_ORDERS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LAB_ORDERS_ZAMBDA_ID;
const DELETE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_DELETE_LAB_ORDER_ZAMBDA_ID;
const UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID;
const EHR_GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_EHR_GET_SCHEDULE_ZAMBDA_ID;
const UPDATE_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_SCHEDULE_ZAMBDA_ID;
const LIST_SCHEDULE_OWNERS_ZAMBDA_ID = import.meta.env.VITE_APP_LIST_SCHEDULE_OWNERS_ZAMBDA_ID;
const CREATE_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_SCHEDULE_ZAMBDA_ID;
const CREATE_SLOT_ZAMBDA_ID = 'create-slot';

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

export const submitLabOrder = async (oystehr: Oystehr, parameters: SubmitLabOrderInput): Promise<SubmitLabOrderDTO> => {
  try {
    if (SUBMIT_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('submit lab order zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SUBMIT_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw new Error(JSON.stringify(error));
  }
};

export const getAppointments = async (oystehr: Oystehr, parameters: GetAppointmentsParameters): Promise<any> => {
  try {
    if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
      throw new Error('get appointments environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_APPOINTMENTS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const createAppointment = async (oystehr: Oystehr, parameters: CreateAppointmentInputParams): Promise<any> => {
  try {
    if (CREATE_APPOINTMENT_ZAMBDA_ID == null) {
      throw new Error('create appointment environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_APPOINTMENT_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error, 'Error occurred trying to invite participant');
    throw new Error(JSON.stringify(error));
  }
};

export const createUser = async (oystehr: Oystehr, parameters: CreateUserParams): Promise<CreateUserOutput> => {
  try {
    if (CREATE_USER_ZAMBDA_ID == null) {
      throw new Error('create user environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_USER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
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
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listScheduleOwners = async (
  params: ListScheduleOwnersParams,
  oystehr: Oystehr
): Promise<ListScheduleOwnersResponse> => {
  try {
    if (LIST_SCHEDULE_OWNERS_ZAMBDA_ID == null) {
      throw new Error('list-schedule-owners zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: LIST_SCHEDULE_OWNERS_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getSchedule = async (params: GetScheduleParams, oystehr: Oystehr): Promise<ScheduleDTO> => {
  try {
    if (EHR_GET_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('ehr-get-schedule zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: EHR_GET_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateSchedule = async (params: UpdateScheduleParams, oystehr: Oystehr): Promise<Schedule> => {
  try {
    if (UPDATE_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('update-schedule zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: UPDATE_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createSchedule = async (params: CreateScheduleParams, oystehr: Oystehr): Promise<Schedule> => {
  try {
    if (CREATE_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('create-schedule zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: CREATE_SCHEDULE_ZAMBDA_ID,
      ...params,
    });
    return chooseJson(response);
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

    const { presignedImageUrl } = chooseJson(urlSigningResponse);

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

    return chooseJson(urlSigningResponse);
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

    return chooseJson(urlSigningResponse);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export const createLabOrder = async (oystehr: Oystehr, parameters: CreateLabOrderParameters): Promise<any> => {
  try {
    if (CREATE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('create lab order environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getCreateLabOrderResources = async (
  oystehr: Oystehr,
  parameters: GetCreateLabOrderResources
): Promise<LabOrderResourcesRes> => {
  try {
    if (GET_CREATE_LAB_ORDER_RESOURCES == null) {
      throw new Error('get create lab resources order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: GET_CREATE_LAB_ORDER_RESOURCES,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getLabOrders = async <RequestParameters extends GetLabOrdersParameters>(
  oystehr: Oystehr,
  parameters: RequestParameters
): Promise<PaginatedLabOrderResponse<RequestParameters>> => {
  try {
    if (GET_LAB_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get lab orders zambda environment variable could not be loaded');
    }
    const { searchBy } = parameters;
    if (!searchBy) {
      throw new Error(
        `Missing one of the required parameters (serviceRequestId | encounterId | patientId): ${JSON.stringify(
          parameters
        )}`
      );
    }
    const response = await oystehr.zambda.execute({
      id: GET_LAB_ORDERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteLabOrder = async (oystehr: Oystehr, parameters: DeleteLabOrderParams): Promise<any> => {
  try {
    if (DELETE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('delete lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DELETE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateLabOrderResources = async (
  oystehr: Oystehr,
  parameters: UpdateLabOrderResourcesParameters
): Promise<any> => {
  try {
    if (UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID == null) {
      throw new Error('update lab order resources zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createRadiologyOrder = async (
  oystehr: Oystehr,
  parameters: CreateRadiologyZambdaOrderInput
): Promise<any> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-create-order',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getRadiologyOrders = async (
  oystehr: Oystehr,
  parameters: GetRadiologyOrderListZambdaInput
): Promise<GetRadiologyOrderListZambdaOutput> => {
  try {
    const searchBy = parameters.encounterId || parameters.patientId || parameters.serviceRequestId;
    if (!searchBy) {
      throw new Error(
        `Missing one of the required parameters (serviceRequestId | encounterId | patientId): ${JSON.stringify(
          parameters
        )}`
      );
    }
    const response = await oystehr.zambda.execute({
      id: 'radiology-order-list',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createSlot = async (input: CreateSlotParams, oystehr: Oystehr): Promise<Slot> => {
  try {
    const response = await oystehr.zambda.executePublic({ id: CREATE_SLOT_ZAMBDA_ID, ...input });
    const jsonToUse = chooseJson(response);
    return jsonToUse;
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
};
