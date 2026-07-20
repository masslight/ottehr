import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ACTION_LOG_VIEWER_ROLES,
  ACTION_LOGS_DISPLAY_WINDOW_DAYS,
  ACTION_LOGS_PAGE_SIZE,
  ActionLogEntry,
  GetActionLogsInputValidated,
  GetActionLogsOutput,
  getFormattedPatientFullName,
  getOutboundDeliveryAttemptStatus,
  getOutboundDeliveryChannel,
  getOutboundDeliveryRecipientSnapshot,
  getReferenceId,
  OUTBOUND_DELIVERY_TASK_CODES,
  OUTBOUND_DELIVERY_TASK_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  requireUserWithRole,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-action-logs';
let m2mToken = '';

// FHIR search values use \, $, and | as syntax characters (list separator, chained-param
// separator, and OR separator); escape them so a literal value like "Last, First" isn't
// parsed as two search terms.
function escapeFhirSearchValue(value: string): string {
  return value.replace(/[\\,$|]/g, (char) => `\\${char}`);
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  await requireUserWithRole(
    input.headers.Authorization.replace('Bearer ', ''),
    parameters.secrets,
    ACTION_LOG_VIEWER_ROLES
  );
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
  const output = await performEffect(parameters, oystehr);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  input: GetActionLogsInputValidated,
  oystehr: Oystehr
): Promise<GetActionLogsOutput> {
  const { channel, patientId, patientName, visitId, visitDate, pageIndex } = input;
  const params: SearchParam[] = [
    { name: 'code', value: `${OUTBOUND_DELIVERY_TASK_SYSTEM}|${OUTBOUND_DELIVERY_TASK_CODES[channel]}` },
    { name: '_total', value: 'accurate' },
    { name: '_count', value: String(ACTION_LOGS_PAGE_SIZE) },
    { name: '_offset', value: String(pageIndex * ACTION_LOGS_PAGE_SIZE) },
    { name: '_sort', value: '-authored-on,-_id' },
    { name: '_include', value: 'Task:patient' },
    { name: '_include', value: 'Task:focus' },
  ];
  if (patientId) params.push({ name: 'patient', value: `Patient/${patientId}` });
  if (patientName) params.push({ name: 'patient:Patient.name', value: escapeFhirSearchValue(patientName) });
  if (visitId) params.push({ name: 'focus', value: `Appointment/${visitId}` });
  if (visitDate) {
    // visitDate is the start of a calendar day in the searcher's own offset. Search a UTC range
    // for that day rather than an exact date match, so the boundary matches the offset the
    // frontend used to display the date instead of assuming UTC day boundaries.
    const dayStart = DateTime.fromISO(visitDate, { setZone: true });
    const dayEnd = dayStart.plus({ days: 1 });
    params.push({ name: 'focus:Appointment.date', value: `ge${dayStart.toUTC().toISO()}` });
    params.push({ name: 'focus:Appointment.date', value: `lt${dayEnd.toUTC().toISO()}` });
  }
  if (!patientId && !patientName && !visitId && !visitDate) {
    params.push({
      name: 'authored-on',
      value: `ge${DateTime.now().minus({ days: ACTION_LOGS_DISPLAY_WINDOW_DAYS }).toUTC().toISO()}`,
    });
  }

  const bundle = await oystehr.fhir.search<Task | Patient | Appointment>({ resourceType: 'Task', params });
  const resources = bundle.unbundle();
  const tasks = resources.filter((resource): resource is Task => resource.resourceType === 'Task');
  const patients = new Map(
    resources
      .filter((resource): resource is Patient => resource.resourceType === 'Patient')
      .map((patient) => [patient.id, patient])
  );
  const appointments = new Map(
    resources
      .filter((resource): resource is Appointment => resource.resourceType === 'Appointment')
      .map((appointment) => [appointment.id, appointment])
  );
  const communications =
    channel === 'fax' ? await getFaxCommunications(tasks, oystehr) : new Map<string, Communication>();

  const logs = tasks.map((task) => composeEntry(task, patients, appointments, communications));
  return { logs, totalCount: bundle.total ?? 0 };
}

async function getFaxCommunications(tasks: Task[], oystehr: Oystehr): Promise<Map<string, Communication>> {
  const ids = [
    ...new Set(
      tasks
        .map((task) => getOutboundDeliveryRecipientSnapshot(task).communicationId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (!ids.length) return new Map();
  const resources = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: '_id', value: ids.join(',') },
        { name: '_count', value: String(ACTION_LOGS_PAGE_SIZE) },
      ],
    })
  ).unbundle();
  return new Map(resources.map((communication) => [communication.id!, communication]));
}

function composeEntry(
  task: Task,
  patients: Map<string | undefined, Patient>,
  appointments: Map<string | undefined, Appointment>,
  communications: Map<string, Communication>
): ActionLogEntry {
  const channel = getOutboundDeliveryChannel(task)!;
  const patientId = getReferenceId(task.for?.reference, 'Patient');
  const appointmentId = getReferenceId(task.focus?.reference, 'Appointment');
  const patient = patients.get(patientId);
  const appointment = appointments.get(appointmentId);
  const recipient = getOutboundDeliveryRecipientSnapshot(task);
  return {
    attemptId: task.id!,
    channel,
    status: getOutboundDeliveryAttemptStatus(
      task,
      recipient.communicationId ? communications.get(recipient.communicationId) : undefined
    ),
    attemptedAt: task.authoredOn,
    recipientAddress: recipient.address ?? '',
    recipientName: recipient.name,
    patientId,
    patientName: patient ? getFormattedPatientFullName(patient, { skipNickname: true }) : undefined,
    appointmentId,
    visitDate: appointment?.start,
  };
}
