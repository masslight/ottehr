import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Location, Patient, Practitioner, Slot, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentHistoryRow,
  appointmentTypeForAppointment,
  AppointmentTypeOptions,
  AppointmentTypeSchema,
  FHIR_RESOURCE_NOT_FOUND,
  getAttendingPractitionerId,
  getFirstName,
  getInPersonVisitStatus,
  getLastName,
  GetPatientVisitListInput,
  getReasonForVisitFromAppointment,
  getSecret,
  getTelemedLength,
  getTelemedVisitStatus,
  getVisitStatusHistory,
  getVisitTotalTime,
  INVALID_INPUT_ERROR,
  isTelemedAppointment,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  PatientVisitListResponse,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  Secrets,
  SecretsKeys,
  ServiceMode,
  TelemedAppointmentStatusEnum,
  TIMEZONES,
  VisitStatusLabel,
} from 'utils';
import { z } from 'zod';
import {
  createOystehrClient,
  getAuth0Token,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;

const ZAMBDA_NAME = 'get-patient-visit-history';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const secrets = input.secrets;
    const { patientId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      oystehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }

    const effectInput = await complexValidation(
      {
        ...validatedParameters,
        secrets: input.secrets,
      },
      oystehrClient
    );

    const response = await performEffect(effectInput, oystehrClient);

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<PatientVisitListResponse> => {
  const { patientId, type, status, from, to, serviceMode, sortDirection } = input;

  const params: SearchParam[] = [
    {
      name: 'patient._id',
      value: patientId,
    },
    {
      name: '_revinclude',
      value: 'Encounter:appointment',
    },
    {
      name: '_include:iterate',
      value: 'Appointment:patient',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:participant:Practitioner',
    },
    {
      name: '_include',
      value: 'Appointment:location',
    },
    {
      name: '_include:iterate',
      value: 'Appointment:slot',
    },
    {
      name: '_revinclude:iterate',
      value: 'Task:encounter',
    },
    {
      name: '_sort',
      value: sortDirection === 'asc' ? 'date' : '-date',
    },
  ];
  if (from) {
    params.push({ name: 'date', value: `ge${from}` });
  }
  if (to) {
    params.push({ name: 'date', value: `le${to}` });
  }

  const allResources = (
    await oystehr.fhir.search<Appointment | Encounter | Practitioner | Location | Slot | Task>({
      resourceType: 'Appointment',
      params,
    })
  ).unbundle();

  const appointments: Appointment[] = [];
  const encounters: Encounter[] = [];
  const practitioners: Practitioner[] = [];
  const locations: Location[] = [];
  const slots: Slot[] = [];
  const tasks: Task[] = [];
  allResources.forEach((res) => {
    switch (res.resourceType) {
      case 'Appointment':
        appointments.push(res as Appointment);
        break;
      case 'Encounter':
        encounters.push(res as Encounter);
        break;
      case 'Practitioner':
        practitioners.push(res as Practitioner);
        break;
      case 'Location':
        locations.push(res as Location);
        break;
      case 'Slot':
        slots.push(res as Slot);
        break;
      case 'Task':
        tasks.push(res as Task);
        break;
    }
  });

  const visitRows: AppointmentHistoryRow[] = appointments.flatMap((appointment: Appointment) => {
    // build out AppointmentHistoryRow here
    if (!appointment.id) {
      return [];
    }
    const slot = slots.find((slot) => appointment.slot?.some((s) => s.reference === `Slot/${slot.id}`));
    const location = locations.find(
      (location) => appointment?.participant?.some((p) => p.actor?.reference?.replace('Location/', '') === location.id)
    );
    const encounter = encounters.find(
      (encounter) => encounter.appointment?.[0]?.reference === `Appointment/${appointment.id}` && !encounter.partOf
    );
    const practitionerId = encounter ? getAttendingPractitionerId(encounter) : undefined;
    let providerResource: Practitioner | undefined;
    if (practitionerId) {
      providerResource = practitioners.find((practitioner) => practitioner.id === practitionerId);
    }
    let provider: { name: string; id: string } | undefined;

    if (providerResource && providerResource.id) {
      provider = {
        name: `${getFirstName(providerResource)} ${getLastName(providerResource)}`,
        id: providerResource.id,
      };
    }

    let timezone = TIMEZONES[0]; // default timezone
    if (slot && slot.start) {
      // we can just grab the tz from the slot rather than getting the schedule resource
      const slotDateTime = DateTime.fromISO(slot.start, { setZone: true });
      if (slotDateTime.isValid) {
        timezone = slotDateTime.zoneName;
      }
    }

    const dateTime = DateTime.fromISO(appointment.start!).setZone(timezone).toISO() || undefined;
    const serviceMode = isTelemedAppointment(appointment) ? ServiceMode.virtual : ServiceMode['in-person'];

    let telemedStatus: TelemedAppointmentStatusEnum | undefined;
    let inPersonStatus: VisitStatusLabel | undefined;
    if (encounter) {
      if (serviceMode === ServiceMode.virtual) {
        telemedStatus = getTelemedVisitStatus(encounter.status, appointment.status);
      } else {
        inPersonStatus = getInPersonVisitStatus(appointment, encounter);
      }
    }
    const type = appointmentTypeForAppointment(appointment);

    const sendInvoiceTask = encounter?.id
      ? tasks.find(
          (task) =>
            // todo: confirm task.code plan
            task.encounter?.reference === `Encounter/${encounter.id}` &&
            task.code?.coding?.some(
              (coding) => coding.system === RCM_TASK_SYSTEM && coding.code === RcmTaskCode.sendInvoiceToPatient
            )
        )
      : undefined;

    const baseRow = {
      appointmentId: appointment.id,
      type,
      visitReason: getReasonForVisitFromAppointment(appointment),
      office: location?.name,
      dateTime,
      provider,
      encounterId: encounter?.id,
      sendInvoiceTask,
      length:
        serviceMode === ServiceMode.virtual
          ? getTelemedLength(encounter?.statusHistory)
          : (encounter && getVisitTotalTime(appointment, getVisitStatusHistory(encounter), DateTime.now())) || 0,
    };
    if (serviceMode === ServiceMode.virtual) {
      return {
        ...baseRow,
        serviceMode: ServiceMode.virtual,
        status: telemedStatus,
      };
    } else {
      return {
        ...baseRow,
        serviceMode: ServiceMode['in-person'],
        status: inPersonStatus,
      };
    }
  });

  const visits = visitRows.filter((visit) => {
    let typeMatch = true;
    let statusMatch = true;
    let serviceModeMatch = true;

    if (type && type.length > 0) {
      typeMatch = !!visit.type && type.includes(visit.type);
    }

    if (status && status.length > 0) {
      statusMatch = status.includes(visit.status || '');
    }
    if (serviceMode) {
      serviceModeMatch = visit.serviceMode === serviceMode;
    }

    return typeMatch && statusMatch && serviceModeMatch;
  });

  return { visits, metadata: { totalCount: visitRows.length, sortDirection } };
};

const complexValidation = async (
  input: EffectInput & { secrets: Secrets | null },
  oystehrClient: Oystehr
): Promise<EffectInput> => {
  const { patientId } = input;

  const patient = await oystehrClient.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });

  if (!patient) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }

  return input;
};

interface EffectInput extends GetPatientVisitListInput {
  sortDirection: 'asc' | 'desc';
}

const validateRequestParameters = (input: ZambdaInput): EffectInput & { secrets: Secrets | null } => {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, type, status, from, to, serviceMode, sortDirection: maybeSortDirection } = JSON.parse(input.body);
  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (!isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }

  if (from && typeof from === 'string' && !DateTime.fromISO(from).isValid) {
    throw INVALID_INPUT_ERROR('"from" must be a valid ISO date string.');
  } else if (from && typeof from !== 'string') {
    throw INVALID_INPUT_ERROR('"from" must be a valid ISO date string.');
  }

  if (to && typeof to === 'string' && !DateTime.fromISO(to).isValid) {
    throw INVALID_INPUT_ERROR('"to" must be a valid ISO date string.');
  } else if (to && typeof to !== 'string') {
    throw INVALID_INPUT_ERROR('"to" must be a valid ISO date string.');
  }

  if (type) {
    try {
      AppointmentTypeSchema.parse(type);
    } catch {
      throw INVALID_INPUT_ERROR(`"type" must be an array of ${Object.values(AppointmentTypeOptions).join(', ')}.`);
    }
  }
  if (status) {
    try {
      // it would be nice to type this more strongly but difficult to do with current design
      z.array(z.string()).parse(status);
    } catch {
      throw INVALID_INPUT_ERROR('"status" must be an array of strings.');
    }
  }
  if (serviceMode) {
    try {
      z.enum([ServiceMode['in-person'], ServiceMode.virtual]).parse(serviceMode);
    } catch {
      throw INVALID_INPUT_ERROR(`"serviceMode" must be one of ${ServiceMode['in-person']} or ${ServiceMode.virtual}.`);
    }
  }
  const sortDirection: 'asc' | 'desc' = maybeSortDirection ?? 'desc';
  if (sortDirection !== 'asc' && sortDirection !== 'desc') {
    throw INVALID_INPUT_ERROR('"sortDirection" must be either "asc" or "desc".');
  }

  return {
    patientId,
    from,
    to,
    type,
    status,
    sortDirection,
    serviceMode,
    secrets: input.secrets ?? null,
  };
};
