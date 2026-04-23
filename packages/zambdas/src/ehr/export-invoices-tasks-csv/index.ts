import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  Appointment,
  Encounter as FhirEncounter,
  Location,
  Patient,
  RelatedPerson,
  Resource,
  Slot,
  Task as FhirTask,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EXPORT_INVOICES_TASKS_CSV_ZAMBDA_KEY,
  ExportInvoicesTasksCsvInput,
  formatDateConfigurable,
  getFullName,
  getLatestTaskOutput,
  getPatientReferenceFromAccount,
  getResponsiblePartyFromAccount,
  INVOICE_TASK_BUSINESS_STATUS_SYSTEM,
  InvoiceSortDirectionValues,
  InvoiceSortFieldValues,
  mapInvoiceTaskStatusToDisplay,
  parseInvoiceTaskInput,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  TIMEZONES,
  ZERO_BALANCE_BUSINESS_STATUS_CODE,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { getResponsiblePartyRelationship } from '../get-invoices-tasks';
import { accountMatchesType } from '../shared/harvest';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = EXPORT_INVOICES_TASKS_CSV_ZAMBDA_KEY;

const CSV_PAGE_SIZE = 200;

interface TaskGroup {
  task: FhirTask;
  encounter: FhirEncounter;
  patient: Patient;
  account?: Account;
  appointment?: Appointment;
  location?: Location;
  slot?: Slot;
  responsibleParty?: Patient | RelatedPerson;
  relatedPerson?: RelatedPerson;
}

interface CsvRow {
  rcmClaimId: string;
  patientId: string;
  patientName: string;
  dob: string;
  responsibleParty: string;
  responsiblePartyRelationship: string;
  dateOfService: string;
  finalizationDate: string;
  invoiceStatus: string;
  stripeInvoiceId: string;
}

const CSV_HEADERS: (keyof CsvRow)[] = [
  'rcmClaimId',
  'patientId',
  'patientName',
  'dob',
  'responsibleParty',
  'responsiblePartyRelationship',
  'dateOfService',
  'finalizationDate',
  'invoiceStatus',
  'stripeInvoiceId',
];

const CSV_HEADER_LABELS: Record<keyof CsvRow, string> = {
  rcmClaimId: 'RCM Claim ID',
  patientId: 'Patient ID',
  patientName: 'Patient Name',
  dob: 'Patient DOB',
  responsibleParty: 'Responsible Party Name',
  responsiblePartyRelationship: 'Responsible Party Relationship',
  dateOfService: 'Date of Service',
  finalizationDate: 'Finalization Date',
  invoiceStatus: 'Invoice Status',
  stripeInvoiceId: 'Stripe Invoice ID',
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParams = validateRequestParameters(input);
  const { secrets } = validatedParams;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const allRows: CsvRow[] = [];
  let offset = 0;
  let total: number | undefined;

  do {
    const { taskGroups, bundleTotal } = await getFhirResourcesPage(oystehr, validatedParams, offset);
    total = bundleTotal;
    const rows = taskGroupsToCsvRows(taskGroups);
    allRows.push(...rows);
    offset += CSV_PAGE_SIZE;
  } while (offset < (total ?? 0));

  const csv = buildCsv(allRows);

  return {
    statusCode: 200,
    body: JSON.stringify({ csv }),
  };
});

function taskGroupsToCsvRows(taskGroups: TaskGroup[]): CsvRow[] {
  return taskGroups.map((group) => {
    const { task, patient, appointment, responsibleParty, slot } = group;
    const taskInput = parseInvoiceTaskInput(task);
    const lastTaskOutput = getLatestTaskOutput(task);
    const stripeInvoiceId = lastTaskOutput?.type === 'success' ? lastTaskOutput.message ?? '' : '';

    let timezone = TIMEZONES[0];
    if (slot && slot.start) {
      const slotDateTime = DateTime.fromISO(slot.start, { setZone: true });
      if (slotDateTime.isValid) {
        timezone = slotDateTime.zoneName;
      }
    }

    const visitDate = formatDateConfigurable({ isoDate: appointment?.start, timezone });
    const patientDob = formatDateConfigurable({ isoDate: patient.birthDate });
    const responsiblePartyName = responsibleParty ? getFullName(responsibleParty) : '';
    const relationship = responsibleParty ? getResponsiblePartyRelationship(responsibleParty)?.toLowerCase() ?? '' : '';
    const displayStatus = mapInvoiceTaskStatusToDisplay(task.status);

    return {
      rcmClaimId: taskInput.claimId ?? '',
      patientId: patient.id ?? '',
      patientName: getFullName(patient),
      dob: patientDob ?? '',
      responsibleParty: responsiblePartyName,
      responsiblePartyRelationship: relationship,
      dateOfService: visitDate ?? '',
      finalizationDate: formatDateConfigurable({ isoDate: taskInput.finalizationDate }) ?? '',
      invoiceStatus: displayStatus,
      stripeInvoiceId,
    };
  });
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function buildCsv(rows: CsvRow[]): string {
  const headerLine = CSV_HEADERS.map((h) => escapeCsvField(CSV_HEADER_LABELS[h])).join(',');
  const dataLines = rows.map((row) => CSV_HEADERS.map((h) => escapeCsvField(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

async function getFhirResourcesPage(
  oystehr: Oystehr,
  input: ExportInvoicesTasksCsvInput,
  offset: number
): Promise<{ taskGroups: TaskGroup[]; bundleTotal: number }> {
  const { status, sortField, sortDirection, hideZeroBalance } = input;
  const resolvedSortField = sortField ?? InvoiceSortFieldValues.finalizationDate;
  const resolvedSortDirection = sortDirection ?? InvoiceSortDirectionValues.desc;
  const sortPrefix = resolvedSortDirection === InvoiceSortDirectionValues.desc ? '-' : '';
  const fhirSortParam =
    resolvedSortField === InvoiceSortFieldValues.finalizationDate
      ? `${sortPrefix}authored-on,${sortPrefix}_id`
      : `${sortPrefix}period,${sortPrefix}_id`;

  const params: SearchParam[] = [
    { name: '_sort', value: fhirSortParam },
    { name: '_total', value: 'accurate' },
    { name: '_count', value: CSV_PAGE_SIZE },
    { name: 'authored-on:missing', value: 'false' },
    { name: 'code', value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}` },
    { name: '_include', value: 'Task:encounter' },
    { name: '_include:iterate', value: 'Encounter:patient' },
    { name: '_include:iterate', value: 'Encounter:appointment' },
    { name: '_include:iterate', value: 'Appointment:location' },
    { name: '_include:iterate', value: 'Appointment:slot' },
    { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
    { name: '_revinclude:iterate', value: 'Account:patient' },
  ];

  if (offset > 0) {
    params.push({ name: '_offset', value: offset });
  }
  if (status) {
    params.push({ name: 'status', value: status });
  }
  if (hideZeroBalance) {
    params.push({
      name: 'business-status:not',
      value: `${INVOICE_TASK_BUSINESS_STATUS_SYSTEM}|${ZERO_BALANCE_BUSINESS_STATUS_CODE}`,
    });
  }

  const bundle = await oystehr.fhir.search({ resourceType: 'Task', params });
  const resources = bundle.unbundle() as Resource[];
  const tasks = resources.filter((r) => r.resourceType === 'Task') as FhirTask[];

  const resultGroups: TaskGroup[] = [];

  tasks.forEach((task) => {
    const encounterId = task.encounter?.reference?.replace('Encounter/', '');
    const encounter = findResourceById<FhirEncounter>('Encounter', encounterId, resources);
    if (!encounter) return;

    const patId = encounter.subject?.reference?.replace('Patient/', '');
    const pat = findResourceById<Patient>('Patient', patId, resources);
    if (!pat || !patId) return;

    const appointmentId = encounter.appointment
      ?.find((ref) => ref.reference?.includes('Appointment/'))
      ?.reference?.replace('Appointment/', '');
    const appt = findResourceById<Appointment>('Appointment', appointmentId, resources);

    const locationId = appt?.participant
      ?.find((p) => p.actor?.reference?.includes('Location/'))
      ?.actor?.reference?.replace('Location/', '');
    const location = findResourceById<Location>('Location', locationId, resources);

    const slotId = appt?.slot?.find((s) => s.reference?.includes('Slot/'))?.reference?.replace('Slot/', '');
    const slotRes = findResourceById<Slot>('Slot', slotId, resources);

    const account = resources.find(
      (res) =>
        res.resourceType === 'Account' &&
        accountMatchesType(res as Account, PATIENT_BILLING_ACCOUNT_TYPE) &&
        getPatientReferenceFromAccount(res as Account)?.includes(patId)
    ) as Account;
    const rp = account ? getResponsiblePartyFromAccount(account, resources) : undefined;

    const relatedPerson = resources.find(
      (resource) =>
        resource.resourceType === 'RelatedPerson' &&
        (resource as RelatedPerson).patient?.reference?.includes(patId) &&
        (resource as RelatedPerson).relationship?.find(
          (relationship) => relationship.coding?.find((code) => code.code === 'user-relatedperson')
        )
    ) as RelatedPerson;

    resultGroups.push({
      task,
      encounter,
      patient: pat,
      account,
      appointment: appt,
      responsibleParty: rp,
      relatedPerson,
      location,
      slot: slotRes,
    });
  });

  return { taskGroups: resultGroups, bundleTotal: bundle.total ?? resultGroups.length };
}

function findResourceById<T extends Resource>(
  resourceType: Resource['resourceType'],
  id: string | undefined,
  resources: Resource[]
): T | undefined {
  if (!id) return undefined;
  return resources.find((res) => res.resourceType === resourceType && res.id === id) as T;
}
