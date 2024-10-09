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
import { Appointment } from 'fhir/r4';

if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters: GetTelemedAppointmentsInput = validateRequestParameters(input);
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
    const allRelatedPersonMaps = await relatedPersonAndCommunicationMaps(fhirClient, allResources);

    allPackages.forEach((appointmentPackage: AppointmentPackage) => {
      const { appointment, telemedStatus, telemedStatusHistory, location, practitioner, encounter } =
        appointmentPackage;

      const patient = filterPatientForAppointment(appointment, allResources);
      const patientPhone = appointmentPackage.paperwork
        ? getPhoneNumberFromQuestionnaire(appointmentPackage.paperwork)
        : undefined;
      const cancellationReason = extractCancellationReason(appointment);
      const smsModel = createSmsModel(patient.id!, allRelatedPersonMaps);

      const appointmentTemp: TelemedAppointmentInformation = {
        id: appointment.id || 'Unknown',
        start: appointment.start,
        patient: {
          id: patient.id || 'Unknown',
          firstName: patient?.name?.[0].given?.[0],
          lastName: patient?.name?.[0].family,
          // suffix: patient?.name?.[0].suffix?.[0] || '',
          dateOfBirth: patient.birthDate || 'Unknown',
          sex: patient.gender,
          phone: patientPhone,
        },
        smsModel,
        reasonForVisit: appointment.description,
        comment: appointment.comment,
        appointmentStatus: appointment.status,
        location: {
          locationID: location?.locationID ? `Location/${location.locationID}` : undefined,
          state: location?.state,
        },
        encounter,
        paperwork: appointmentPackage.paperwork,
        telemedStatus: telemedStatus,
        telemedStatusHistory: telemedStatusHistory,
        cancellationReason: cancellationReason,
        next: false,
        visitStatusHistory: getVisitStatusHistory(appointment),
        practitioner,
        encounterId: encounter.id || 'Unknown',
      };

      resultAppointments.push(appointmentTemp);
    });
    console.log('Appointments parsed and filtered from all resources.');
  }
  return {
    message: 'Successfully retrieved all appointments',
    appointments: resultAppointments,
  };
};

const extractCancellationReason = (appointment: Appointment): string | undefined => {
  const codingClause = appointment.cancelationReason?.coding?.[0];
  const cancellationReasonOptionOne = codingClause?.code;
  if ((cancellationReasonOptionOne ?? '').toLowerCase() === 'other') {
    return codingClause?.display;
  }
  if (cancellationReasonOptionOne) {
    return cancellationReasonOptionOne;
  }

  return codingClause?.display;
};
