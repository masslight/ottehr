import { AppClient, FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  GetTelemedAppointmentsInput,
  GetTelemedAppointmentsResponse,
  TelemedAppointmentInformation,
  TelemedCallStatuses,
  getVisitStatusHistory,
} from 'ehr-utils';
import { sameEstimatedTimeStatesGroups } from '../shared/appointment/constants';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { filterAppointmentsFromResources, filterPatientForAppointment } from './helpers/fhir-resources-filters';
import {
  getAllPrefilteredFhirResources,
  getAllVirtualLocationsMap,
  getOldestAppointmentForEachLocationsGroup,
} from './helpers/fhir-utils';
import {
  createSmsModel,
  getAppointmentWaitingTime,
  getPhoneNumberFromQuestionnaire,
  groupAppointmentsLocations,
} from './helpers/helpers';
import { mapAppointmentToLocationId, relatedPersonAndCommunicationMaps } from './helpers/mappers';
import { AppointmentPackage, EstimatedTimeToLocationIdMap, LocationIdToAbbreviationMap } from './helpers/types';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    console.log('Parameters: ' + JSON.stringify(validatedParameters));

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);
    const fhirClient = createFhirClient(m2mtoken, validatedParameters.secrets);
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
  console.log('Received all appointments with type "virtual":', allPackages.length);

  const resultAppointments: TelemedAppointmentInformation[] = [];

  if (allResources.length > 0) {
    const [allRelatedPersonMaps, estimatedTimeMap] = await Promise.all([
      relatedPersonAndCommunicationMaps(fhirClient, allResources),
      calculateEstimatedTimeForLocations(fhirClient, allPackages, virtualLocationsMap, statusesFilter, 15),
    ]);

    allPackages.forEach((appointmentPackage) => {
      const { appointment, telemedStatus, providers, groups, telemedStatusHistory, location, encounter } =
        appointmentPackage;

      const patient = filterPatientForAppointment(appointment, allResources);
      console.log('patienttt', patient);
      const patientPhone = appointmentPackage.paperwork
        ? getPhoneNumberFromQuestionnaire(appointmentPackage.paperwork)
        : undefined;
      const cancellationReason = appointment.cancelationReason?.coding?.[0].code;
      console.log('location?.locationID', location?.locationID);
      const estimatedTime = location?.locationID ? estimatedTimeMap[location?.locationID] : undefined;
      const smsModel = createSmsModel(patient.id!, allRelatedPersonMaps);

      const appointmentTemp: TelemedAppointmentInformation = {
        id: appointment.id!,
        start: appointment.start,
        patient: {
          id: patient.id!,
          firstName: patient?.name?.[0].given?.[0],
          lastName: patient?.name?.[0].family,
          dateOfBirth: patient.birthDate!,
          sex: patient.gender,
          phone: patientPhone,
        },
        smsModel,
        reasonForVisit: appointment.description,
        comment: appointment.comment,
        appointmentStatus: appointment.status,
        provider: providers,
        group: groups,
        location: {
          locationID: location?.locationID ? `Location/${location.locationID}` : undefined,
          state: location?.state,
        },
        encounter,
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

    // const conversationModels = getConversationModelsFromResourceList(allResources);
    // const relatedPersons = getRelatedPersonsFromResourceList(allResources);
    console.log('Got conversation models and related persons from all resources.');
  }
  return {
    message: 'Successfully retrieved all appointments',
    appointments: resultAppointments,
    // appointments: mapAppointmentInformationToConversationModel(resultAppointments, relatedPersons, []),
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
    const locationID = locationsIdsGroup.find((locationID) => locationToAppointmentMap[locationID]);
    if (locationID) {
      const oldestApptInGroup = locationToAppointmentMap[locationID];
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
// function mapAppointmentInformationToConversationModel(
//   resultAppointments: TelemedAppointmentInformation[],
//   relatedPersons: Record<string, import('fhir/r4').RelatedPerson[]>,
//   arg2: never[]
// ): TelemedAppointmentInformation[] {
//   throw new Error('Function not implemented.');
// }
