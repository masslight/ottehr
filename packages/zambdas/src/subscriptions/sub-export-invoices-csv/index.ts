import Oystehr, { SearchParam } from '@oystehr/sdk';
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
  BUCKET_NAMES,
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_INVOICES_CSV_TASK_SYSTEM,
  formatDateConfigurable,
  getFullName,
  getLatestTaskOutput,
  getPatientReferenceFromAccount,
  getResponsiblePartyFromAccount,
  getSecret,
  INVOICE_TASK_BUSINESS_STATUS_SYSTEM,
  InvoiceSortDirectionValues,
  InvoiceSortFieldValues,
  InvoiceTaskSource,
  InvoiceTaskSources,
  invoiceTaskSourceSearchParam,
  mapInvoiceTaskStatusToDisplay,
  parseInvoiceTaskInput,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  SecretsKeys,
  TIMEZONES,
  ZERO_BALANCE_BUSINESS_STATUS_CODE,
} from 'utils';
import { getResponsiblePartyRelationship } from '../../ehr/get-invoices-tasks';
import { accountMatchesType } from '../../ehr/shared/harvest';
import { wrapTaskHandler } from '../task/helpers';

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
  amount: string;
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
  'amount',
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
  amount: 'Invoice Amount',
  invoiceStatus: 'Invoice Status',
  stripeInvoiceId: 'Stripe Invoice ID',
};

interface ExportFilters {
  status?: string;
  sortField?: string;
  sortDirection?: string;
  hideZeroBalance?: boolean;
  source?: InvoiceTaskSource;
}

export const index = wrapTaskHandler('sub-export-invoices-csv', async (input, oystehr) => {
  const { task, secrets } = input;

  const filters = extractFilters(task);
  console.log('Export filters:', JSON.stringify(filters));

  // Paginate through all FHIR data
  const allRows: CsvRow[] = [];
  let offset = 0;
  let total: number | undefined;

  do {
    const { taskGroups, bundleTotal } = await getFhirResourcesPage(oystehr, filters, offset);
    total = bundleTotal;
    const rows = taskGroupsToCsvRows(taskGroups);
    allRows.push(...rows);
    offset += CSV_PAGE_SIZE;
    console.log(`Fetched ${allRows.length} of ${total} records`);
  } while (offset < (total ?? 0));

  console.log(`Total CSV rows: ${allRows.length}`);

  // Build CSV
  const csv = buildCsv(allRows);

  // Upload to Z3
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.REPORTS}`;
  const objectPath = `invoiceable-patients-export-${task.id}.csv`;

  const csvBlob = new Blob([csv], { type: 'text/csv' });
  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: csvBlob,
  });

  const z3Url = `${projectApi}/z3/${bucketName}/${objectPath}`;
  console.log(`CSV uploaded to Z3: ${z3Url}`);

  // Add the Z3 URL to the task output so the kick-off zambda can generate a download link
  await oystehr.fhir.patch({
    resourceType: 'Task',
    id: task.id!,
    operations: [
      {
        op: 'add',
        path: '/output',
        value: [
          {
            type: {
              coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: EXPORT_CSV_OUTPUT_URL_CODE }],
            },
            valueString: z3Url,
          },
        ],
      },
    ],
  });

  return { taskStatus: 'completed' as const, statusReason: `Exported ${allRows.length} records` };
});

function extractFilters(task: FhirTask): ExportFilters {
  const filters: ExportFilters = {};
  for (const inp of task.input ?? []) {
    const code = inp.type?.coding?.find((c) => c.system === EXPORT_INVOICES_CSV_TASK_SYSTEM)?.code;
    if (code === 'filter-status') filters.status = inp.valueString;
    if (code === 'sort-field') filters.sortField = inp.valueString;
    if (code === 'sort-direction') filters.sortDirection = inp.valueString;
    if (code === 'hide-zero-balance') filters.hideZeroBalance = inp.valueBoolean;
    if (code === 'filter-source') filters.source = InvoiceTaskSources.find((source) => source === inp.valueString);
  }
  return filters;
}

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
    const finalizationDate = formatDateConfigurable({ isoDate: taskInput.finalizationDate });
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
      finalizationDate: finalizationDate ?? '',
      amount: ((taskInput.amountCents ?? 0) / 100).toFixed(2),
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
  filters: ExportFilters,
  offset: number
): Promise<{ taskGroups: TaskGroup[]; bundleTotal: number }> {
  const { status, sortField, sortDirection, hideZeroBalance, source } = filters;
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
  const sourceParam = invoiceTaskSourceSearchParam(source);
  if (sourceParam) {
    params.push(sourceParam);
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
