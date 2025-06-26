import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment } from 'fhir/r4b';
import {
  appointmentTypeForAppointment,
  createSmsModel,
  GetTelemedAppointmentsInput,
  GetTelemedAppointmentsResponseEhr,
  getVisitStatusHistory,
  relatedPersonAndCommunicationMaps,
  TelemedAppointmentInformation,
} from 'utils';
import { checkOrCreateM2MClientToken, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { filterAppointmentsAndCreatePackages, filterPatientForAppointment } from './helpers/fhir-resources-filters';
import { getAllPartiallyPrefilteredFhirResources, getAllVirtualLocationsMap } from './helpers/fhir-utils';
import { getPhoneNumberFromQuestionnaire } from './helpers/helpers';
import { validateRequestParameters } from './validateRequestParameters';

if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters: ReturnType<typeof validateRequestParameters> = validateRequestParameters(input);
    console.log('Parameters: ' + JSON.stringify(validatedParameters));

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    const oystehrM2m = createOystehrClient(m2mToken, validatedParameters.secrets);
    console.log('Created zapToken, fhir and app clients.');

    const response = await performEffect(validatedParameters, oystehrM2m, oystehrCurrentUser);
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
  oystehrm2m: Oystehr,
  oystehrCurrentUser: Oystehr
): Promise<GetTelemedAppointmentsResponseEhr> => {
  const { statusesFilter, locationsIdsFilter, visitTypesFilter } = params;
  const virtualLocationsMap = await getAllVirtualLocationsMap(oystehrm2m);
  console.log('Created virtual locations map.');

  const allResources = await getAllPartiallyPrefilteredFhirResources(
    oystehrm2m,
    oystehrCurrentUser,
    params,
    virtualLocationsMap
  );
  if (!allResources) {
    return {
      message: 'Successfully retrieved all appointments',
      appointments: [],
    };
  }

  const allPackages = filterAppointmentsAndCreatePackages({
    allResources,
    statusesFilter,
    virtualLocationsMap,
    visitTypes: visitTypesFilter,
    locationsIdsFilter,
  });
  console.log('Received all appointments with type "virtual":', allPackages.length);

  const resultAppointments: TelemedAppointmentInformation[] = [];

  if (allResources.length > 0) {
    const allRelatedPersonMaps = await relatedPersonAndCommunicationMaps(oystehrm2m, allResources);

    for (let i = 0; i < allPackages.length; i++) {
      const appointmentPackage = allPackages[i];
      const { appointment, telemedStatus, telemedStatusHistory, locationVirtual, practitioner, encounter } =
        appointmentPackage;
      const patient = filterPatientForAppointment(appointment, allResources);

      // it handles the case if a patient was deleted - should we handle this case? (relevant for local environment sometimes)
      if (!patient) {
        console.log('No patient found for appointment', appointment?.id);
        continue;
      }

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
          dateOfBirth: patient.birthDate || 'Unknown',
          sex: patient.gender,
          phone: patientPhone,
        },
        smsModel,
        reasonForVisit: appointment.description,
        comment: appointment.comment,
        appointmentStatus: appointment.status,
        locationVirtual,
        encounter,
        paperwork: appointmentPackage.paperwork,
        telemedStatus: telemedStatus,
        telemedStatusHistory: telemedStatusHistory,
        cancellationReason: cancellationReason,
        next: false,
        visitStatusHistory: getVisitStatusHistory(encounter),
        practitioner,
        encounterId: encounter.id || 'Unknown',
        appointmentType: appointmentTypeForAppointment(appointment),
      };

      resultAppointments.push(appointmentTemp);
    }
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
