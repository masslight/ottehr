import { AppClient, FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import {
  createFhirClient,
  getConversationModelsFromResourceList,
  getRelatedPersonsFromResourceList,
} from '../shared/helpers';
import { getAuth0Token } from '../shared';
import { createAppClient } from '../shared/helpers';
import {
  GetTelemedAppointmentsInput,
  GetTelemedAppointmentsResponse,
  TelemedAppointmentInformation,
  TelemedCallStatuses,
} from 'ehr-utils';
import { filterAppointmentsFromResources, filterPatientForAppointment } from './helpers/fhir-resources-filters';
import {
  getAllPrefilteredFhirResources,
  getAllVirtualLocationsMap,
  getOldestAppointmentForEachLocationsGroup,
} from './helpers/fhir-utils';
import { mapAppointmentInformationToConversationModel, mapAppointmentToLocationId } from './helpers/mappers';
import {
  getPhoneNumberFromQuestionnaire,
  getAppointmentWaitingTime,
  groupAppointmentsLocations,
} from './helpers/helpers';
import { getVisitStatusHistory } from '../shared/fhirStatusMappingUtils';
import { AppointmentPackage, LocationIdToAbbreviationMap, EstimatedTimeToLocationIdMap } from './helpers/types';
import { sameEstimatedTimeStatesGroups } from '../shared/appointment/constants';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    console.log('Parameters: ' + JSON.stringify(validatedParameters));

    const token = await getAuth0Token(validatedParameters.secrets);
    const fhirClient = createFhirClient(token, validatedParameters.secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), validatedParameters.secrets);
    console.log('Created zapToken, fhir and app clients.');

    const response = await performEffect(validatedParameters, fhirClient, appClient);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting appointments' }),
    };
  }
};

export const performEffect = async (
  params: GetTelemedAppointmentsInput,
  fhirClient: FhirClient,
  appClient: AppClient,
): Promise<GetTelemedAppointmentsResponse> => {
  const { statusesFilter } = params;
  const virtualLocationsMap = await getAllVirtualLocationsMap(fhirClient);
  console.log('Created virtual locations map.');

  const allResources = await getAllPrefilteredFhirResources(fhirClient, appClient, params, virtualLocationsMap);
  if (!allResources) {
    return {
      message: 'Successfully retrieved all appointments',
      appointments: [],
    };
  }

  const allPackages = filterAppointmentsFromResources(allResources, statusesFilter, virtualLocationsMap);
  console.log('Received all appointments with type "virtual".');

  const estimatedTimeMap = await calculateEstimatedTimeForLocations(
    fhirClient,
    allPackages,
    virtualLocationsMap,
    statusesFilter,
    15,
  );

  const resultAppointments: TelemedAppointmentInformation[] = [];
  allPackages.forEach((appointmentPackage) => {
    const { appointment, telemedStatus, telemedStatusHistory, location } = appointmentPackage;

    const patient = filterPatientForAppointment(appointment, allResources);
    const patientPhone = appointmentPackage.paperwork
      ? getPhoneNumberFromQuestionnaire(appointmentPackage.paperwork)
      : undefined;
    const cancellationReason = appointment.cancelationReason?.coding?.[0].code;
    const estimatedTime = location?.locationId ? estimatedTimeMap[location?.locationId] : undefined;

    const appointmentTemp: TelemedAppointmentInformation = {
      id: appointment.id!,
      start: appointment.start,
      patient: {
        id: patient.id,
        firstName: patient?.name?.[0].given?.[0],
        lastName: patient?.name?.[0].family,
        dateOfBirth: patient.birthDate,
        sex: patient.gender,
        phone: patientPhone,
      },
      reasonForVisit: appointment.description,
      comment: appointment.comment,
      appointmentStatus: appointment.status,
      location: {
        locationId: location?.locationId ? `Location/${location.locationId}` : undefined,
        state: location?.state,
      },
      estimated: estimatedTime,
      paperwork: appointmentPackage.paperwork,
      telemedStatus: telemedStatus,
      telemedStatusHistory: telemedStatusHistory,
      cancellationReason: cancellationReason,
      next: false,
      visitStatusHistory: getVisitStatusHistory(appointment),
    };

    resultAppointments.push(appointmentTemp);
  });
  console.log('Appointments parsed and filtered from all resources.');

  const conversationModels = getConversationModelsFromResourceList(allResources);
  const relatedPersons = getRelatedPersonsFromResourceList(allResources);
  console.log('Got conversation models and related persons from all resources.');

  return {
    message: 'Successfully retrieved all appointments',
    appointments: mapAppointmentInformationToConversationModel(resultAppointments, relatedPersons, conversationModels),
  };
};

export const calculateEstimatedTimeForLocations = async (
  fhirClient: FhirClient,
  allPackages: AppointmentPackage[],
  virtualLocationsMap: LocationIdToAbbreviationMap,
  statusesFilter: TelemedCallStatuses[],
  estimatedDeltaMinutes: number,
): Promise<EstimatedTimeToLocationIdMap> => {
  if (!statusesFilter.includes('ready')) return {};

  const readyStatusPackages = allPackages.filter((apptPackage) => apptPackage.telemedStatus === 'ready');
  const locationsIdsGroups = groupAppointmentsLocations(
    readyStatusPackages,
    virtualLocationsMap,
    sameEstimatedTimeStatesGroups,
  );
  const oldestAppointments = await getOldestAppointmentForEachLocationsGroup(fhirClient, locationsIdsGroups);
  const locationToAppointmentMap = mapAppointmentToLocationId(oldestAppointments);

  const estimatedTimeToLocationIdMap: EstimatedTimeToLocationIdMap = {};
  locationsIdsGroups.forEach((locationsIdsGroup) => {
    const locationId = locationsIdsGroup.find((locationId) => locationToAppointmentMap[locationId]);
    if (locationId) {
      const oldestApptInGroup = locationToAppointmentMap[locationId];
      const timeDifference = getAppointmentWaitingTime(oldestApptInGroup);
      if (timeDifference) {
        locationsIdsGroup.forEach((id) => {
          estimatedTimeToLocationIdMap[id] = timeDifference + estimatedDeltaMinutes * 60_000;
        });
      }
    }
  });
  return estimatedTimeToLocationIdMap;
};
