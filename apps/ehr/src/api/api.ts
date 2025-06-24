import Oystehr, { User } from '@oystehr/sdk';
import { Schedule, Slot } from 'fhir/r4b';
import {
  apiErrorToThrow,
  AssignPractitionerInput,
  AssignPractitionerResponse,
  CancelAppointmentZambdaInput,
  CancelAppointmentZambdaOutput,
  CancelRadiologyOrderZambdaInput,
  CancelRadiologyOrderZambdaOutput,
  CancelTelemedAppointmentZambdaInput,
  CancelTelemedAppointmentZambdaOutput,
  ChangeInPersonVisitStatusInput,
  ChangeInPersonVisitStatusResponse,
  chooseJson,
  CollectInHouseLabSpecimenParameters,
  CollectInHouseLabSpecimenZambdaOutput,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateInHouseLabOrderParameters,
  CreateInHouseLabOrderResponse,
  CreateLabOrderParameters,
  CreateLabOrderZambdaOutput,
  CreateNursingOrderParameters,
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  CreateScheduleParams,
  CreateSlotParams,
  CreateUserOutput,
  CreateUserParams,
  DeactivateUserZambdaInput,
  DeactivateUserZambdaOutput,
  DeleteInHouseLabOrderParameters,
  DeleteInHouseLabOrderZambdaOutput,
  DeleteLabOrderZambdaInput,
  DeleteLabOrderZambdaOutput,
  GetAppointmentsZambdaInput,
  GetAppointmentsZambdaOutput,
  GetConversationInput,
  GetConversationZambdaOutput,
  GetCreateInHouseLabOrderResourcesParameters,
  GetCreateInHouseLabOrderResourcesResponse,
  GetEmployeesResponse,
  GetInHouseOrdersParameters,
  GetLabelPdfParameters,
  GetLabOrdersParameters,
  GetNursingOrdersInput,
  GetOrUploadPatientProfilePhotoZambdaInput,
  GetOrUploadPatientProfilePhotoZambdaResponse,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOutput,
  GetScheduleParams,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetUserParams,
  GetUserResponse,
  GetVisitLabelInput,
  HandleInHouseLabResultsParameters,
  HandleInHouseLabResultsZambdaOutput,
  InHouseGetOrdersResponseDTO,
  InviteParticipantRequestParameters,
  LabelPdf,
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  NursingOrdersSearchBy,
  PaginatedResponse,
  RadiologyLaunchViewerZambdaInput,
  RadiologyLaunchViewerZambdaOutput,
  SaveFollowupEncounterZambdaInput,
  SaveFollowupEncounterZambdaOutput,
  ScheduleDTO,
  SubmitLabOrderDTO,
  SubmitLabOrderInput,
  UnassignPractitionerZambdaInput,
  UnassignPractitionerZambdaOutput,
  UpdateLabOrderResourcesParameters,
  UpdateNursingOrderParameters,
  UpdateScheduleParams,
  UpdateUserParams,
  UpdateUserZambdaOutput,
} from 'utils';

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
const GET_LAB_ORDERS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LAB_ORDERS_ZAMBDA_ID;
const DELETE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_DELETE_LAB_ORDER_ZAMBDA_ID;
const UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID;
const EHR_GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_EHR_GET_SCHEDULE_ZAMBDA_ID;
const UPDATE_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_SCHEDULE_ZAMBDA_ID;
const LIST_SCHEDULE_OWNERS_ZAMBDA_ID = import.meta.env.VITE_APP_LIST_SCHEDULE_OWNERS_ZAMBDA_ID;
const CREATE_SCHEDULE_ZAMBDA_ID = 'create-schedule';
const CREATE_SLOT_ZAMBDA_ID = 'create-slot';
const CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID;
const GET_IN_HOUSE_ORDERS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_IN_HOUSE_ORDERS_ZAMBDA_ID;
const GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES = import.meta.env.VITE_APP_GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES;
const COLLECT_IN_HOUSE_LAB_SPECIMEN = import.meta.env.VITE_APP_COLLECT_IN_HOUSE_LAB_SPECIMEN;
const HANDLE_IN_HOUSE_LAB_RESULTS = import.meta.env.VITE_APP_HANDLE_IN_HOUSE_LAB_RESULTS;
const DELETE_IN_HOUSE_LAB_ORDER = import.meta.env.VITE_APP_DELETE_IN_HOUSE_LAB_ORDER;
const GET_NURSING_ORDERS_ZAMBDA_ID = 'get-nursing-orders';
const CREATE_NURSING_ORDER_ZAMBDA_ID = 'create-nursing-order';
const UPDATE_NURSING_ORDER = 'update-nursing-order';
const GET_LABEL_PDF_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LABEL_PDF_ZAMBDA_ID;
const GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID = import.meta.env.VITE_APP_GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID;

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
      throw new Error('submit external lab order zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SUBMIT_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getLabelPdf = async (oystehr: Oystehr, parameters: GetLabelPdfParameters): Promise<LabelPdf[]> => {
  try {
    if (GET_LABEL_PDF_ZAMBDA_ID == null) {
      throw new Error('get-label-pdf environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_LABEL_PDF_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export const getOrCreateVisitLabel = async (oystehr: Oystehr, parameters: GetVisitLabelInput): Promise<LabelPdf[]> => {
  try {
    if (GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID == null) {
      throw new Error('get-or-create-visit-label-pdf environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

export const getAppointments = async (
  oystehr: Oystehr,
  parameters: GetAppointmentsZambdaInput
): Promise<GetAppointmentsZambdaOutput> => {
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
    throw error;
  }
};

export const createAppointment = async (
  oystehr: Oystehr,
  parameters: CreateAppointmentInputParams
): Promise<CreateAppointmentResponse> => {
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
    throw error;
  }
};

export const saveFollowup = async (
  oystehr: Oystehr,
  parameters: SaveFollowupEncounterZambdaInput
): Promise<SaveFollowupEncounterZambdaOutput> => {
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
  parameters: CancelTelemedAppointmentZambdaInput
): Promise<CancelTelemedAppointmentZambdaOutput> => {
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
  parameters: InviteParticipantRequestParameters
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

export const updateUser = async (oystehr: Oystehr, parameters: UpdateUserParams): Promise<UpdateUserZambdaOutput> => {
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

export const assignPractitioner = async (
  oystehr: Oystehr,
  parameters: AssignPractitionerInput
): Promise<AssignPractitionerResponse> => {
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
  parameters: UnassignPractitionerZambdaInput
): Promise<UnassignPractitionerZambdaOutput> => {
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
  parameters: ChangeInPersonVisitStatusInput
): Promise<ChangeInPersonVisitStatusResponse> => {
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

export const deactivateUser = async (
  oystehr: Oystehr,
  parameters: DeactivateUserZambdaInput
): Promise<DeactivateUserZambdaOutput> => {
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

export const getConversation = async (
  oystehr: Oystehr,
  parameters: GetConversationInput
): Promise<GetConversationZambdaOutput> => {
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

export const cancelAppointment = async (
  oystehr: Oystehr,
  parameters: CancelAppointmentZambdaInput
): Promise<CancelAppointmentZambdaOutput> => {
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

export type UploadPatientProfilePhotoParameters = Omit<
  GetOrUploadPatientProfilePhotoZambdaInput,
  'z3PhotoUrl' | 'action'
> & {
  patientPhotoFile: File;
};

export const uploadPatientProfilePhoto = async (
  oystehr: Oystehr,
  parameters: UploadPatientProfilePhotoParameters
): Promise<GetOrUploadPatientProfilePhotoZambdaResponse> => {
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

export type GetPatientProfilePhotoParameters = Omit<GetOrUploadPatientProfilePhotoZambdaInput, 'patientID' | 'action'>;

export const getSignedPatientProfilePhotoUrl = async (
  oystehr: Oystehr,
  parameters: GetPatientProfilePhotoParameters
): Promise<GetOrUploadPatientProfilePhotoZambdaResponse> => {
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

export const createExternalLabOrder = async (
  oystehr: Oystehr,
  parameters: CreateLabOrderParameters
): Promise<CreateLabOrderZambdaOutput> => {
  try {
    if (CREATE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('create external lab order environment variable could not be loaded');
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

export const getExternalLabOrders = async <RequestParameters extends GetLabOrdersParameters>(
  oystehr: Oystehr,
  parameters: RequestParameters
): Promise<PaginatedResponse<RequestParameters>> => {
  try {
    if (GET_LAB_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get external lab orders zambda environment variable could not be loaded');
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

export const deleteLabOrder = async (
  oystehr: Oystehr,
  parameters: DeleteLabOrderZambdaInput
): Promise<DeleteLabOrderZambdaOutput> => {
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
): Promise<CreateRadiologyZambdaOrderOutput> => {
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

export const cancelRadiologyOrder = async (
  oystehr: Oystehr,
  parameters: CancelRadiologyOrderZambdaInput
): Promise<CancelRadiologyOrderZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-cancel-order',
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const radiologyLaunchViewer = async (
  oystehr: Oystehr,
  parameters: RadiologyLaunchViewerZambdaInput
): Promise<RadiologyLaunchViewerZambdaOutput> => {
  try {
    const response = await oystehr.zambda.execute({
      id: 'radiology-launch-viewer',
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

export const createInHouseLabOrder = async (
  oystehr: Oystehr,
  parameters: CreateInHouseLabOrderParameters
): Promise<CreateInHouseLabOrderResponse> => {
  try {
    if (CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID == null) {
      throw new Error('create in house lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getInHouseOrders = async <RequestParameters extends GetInHouseOrdersParameters>(
  oystehr: Oystehr,
  parameters: RequestParameters
): Promise<InHouseGetOrdersResponseDTO<RequestParameters>> => {
  try {
    if (GET_IN_HOUSE_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get in house orders zambda environment variable could not be loaded');
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
      id: GET_IN_HOUSE_ORDERS_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getCreateInHouseLabOrderResources = async (
  oystehr: Oystehr,
  parameters: GetCreateInHouseLabOrderResourcesParameters
): Promise<GetCreateInHouseLabOrderResourcesResponse> => {
  try {
    if (GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES == null) {
      throw new Error('get create in house lab order resources zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const collectInHouseLabSpecimen = async (
  oystehr: Oystehr,
  parameters: CollectInHouseLabSpecimenParameters
): Promise<CollectInHouseLabSpecimenZambdaOutput> => {
  try {
    if (COLLECT_IN_HOUSE_LAB_SPECIMEN == null) {
      throw new Error('collect in house lab specimen zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: COLLECT_IN_HOUSE_LAB_SPECIMEN,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const handleInHouseLabResults = async (
  oystehr: Oystehr,
  parameters: HandleInHouseLabResultsParameters
): Promise<HandleInHouseLabResultsZambdaOutput> => {
  try {
    if (HANDLE_IN_HOUSE_LAB_RESULTS == null) {
      throw new Error('handle in house lab results zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: HANDLE_IN_HOUSE_LAB_RESULTS,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteInHouseLabOrder = async (
  oystehr: Oystehr,
  parameters: DeleteInHouseLabOrderParameters
): Promise<DeleteInHouseLabOrderZambdaOutput> => {
  try {
    if (DELETE_IN_HOUSE_LAB_ORDER == null) {
      throw new Error('delete in house lab order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DELETE_IN_HOUSE_LAB_ORDER,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getNursingOrders = async (
  oystehr: Oystehr,
  parameters: GetNursingOrdersInput & { searchBy?: NursingOrdersSearchBy }
): Promise<any> => {
  try {
    if (GET_NURSING_ORDERS_ZAMBDA_ID == null) {
      throw new Error('get nursing orders zambda environment variable could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_NURSING_ORDERS_ZAMBDA_ID,
      ...parameters,
    });

    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const createNursingOrder = async (oystehr: Oystehr, parameters: CreateNursingOrderParameters): Promise<any> => {
  try {
    if (CREATE_NURSING_ORDER_ZAMBDA_ID == null) {
      throw new Error('create nursing order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_NURSING_ORDER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateNursingOrder = async (oystehr: Oystehr, parameters: UpdateNursingOrderParameters): Promise<any> => {
  try {
    if (UPDATE_NURSING_ORDER == null) {
      throw new Error('update nursing order zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: UPDATE_NURSING_ORDER,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
