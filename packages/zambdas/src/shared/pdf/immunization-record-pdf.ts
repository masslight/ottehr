import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { IMMUNIZATION_OUTSIDE_SOURCES, IMMUNIZATION_SOURCE_UNSPECIFIED } from 'utils/lib/fhir/immunization';
import {
  EvaluatedDose,
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupStatus,
} from 'utils/lib/immunization-forecast/types';
import { Secrets } from 'utils/lib/secrets';
import { GetPatientImmunizationsResponse, PatientImmunizationRecord } from 'utils/lib/types/data/immunization/types';
import { IMMUNIZATION_RECORD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { createClinicalOystehrClient } from '../helpers';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from './clinical-document-theme';
import { DataComposer, generatePdf, PdfRenderConfig } from './pdf-common';
import { PdfInfo } from './pdf-utils';
import {
  composePatientInformationForDischargeSummary,
  createCompactPatientHeader,
} from './sections/discharge-summary/patientInfo';
import { composeVisitData, createVisitInfoSection } from './sections/visitInfo';
import { fetchServiceCategoryCatalog } from './service-category-catalog';
import {
  ImmunizationRecordData,
  ImmunizationRecordGroup,
  ImmunizationRecordInput,
  PdfResult,
  PdfSection,
} from './types';

const STATUS_TEXT: Record<ImmunizationGroupStatus, string> = {
  notyet: 'Not yet due',
  uptodate: 'Up to date',
  due: 'Due',
  pastdue: 'Past due',
  complete: 'Complete',
  notroutine: 'Not routine',
  immune: 'Immune',
  contraindicated: 'Contraindicated',
  declined: 'Declined',
};

const DATE_FORMAT = 'MM/dd/yyyy';

const formatDay = (isoDate: string): string => DateTime.fromISO(isoDate).toFormat(DATE_FORMAT);

/** A record's date given on the day it was given: in the practice's zone for a dose given here, as entered outside. */
const formatDateGiven = (record: PatientImmunizationRecord | undefined, timezone: string): string => {
  if (!record?.dateGiven) return 'Date unknown';
  const given = DateTime.fromISO(record.dateGiven, { setZone: true });
  return (record.outside ? given : given.setZone(timezone)).toFormat(DATE_FORMAT);
};

const sourceLabel = (record: PatientImmunizationRecord): string =>
  IMMUNIZATION_OUTSIDE_SOURCES.find((source) => source.value === record.source)?.label ??
  IMMUNIZATION_SOURCE_UNSPECIFIED.label;

/** "Outside: Mercy Pediatrics, from a written record" — where and from what source an outside dose is known. */
const outsideText = (record: PatientImmunizationRecord): string =>
  ['Outside', [record.place, `from ${sourceLabel(record)}`].filter(Boolean).join(', ')].join(': ');

/** "03/02/2026 — DTaP, dose 1 · Outside: Mercy Pediatrics, from a written record". */
export const doseLine = (
  dose: Pick<EvaluatedDose, 'doseNumber' | 'status' | 'reason'>,
  record: PatientImmunizationRecord | undefined,
  timezone: string
): string => {
  const name = record?.vaccineName || 'Vaccine';
  const number = dose.doseNumber != null ? `, dose ${dose.doseNumber}` : '';
  const parts = [`${formatDateGiven(record, timezone)} — ${name}${number}`];
  if (record?.outside) parts.push(outsideText(record));
  if (dose.status !== 'valid' && dose.reason)
    parts.push(dose.status === 'not-counted' ? dose.reason : `${dose.status}: ${dose.reason}`);
  return parts.join(' · ');
};

const markLine = (group: ImmunizationGroupForecast): string | undefined =>
  group.mark &&
  `${STATUS_TEXT[group.mark.type]} ${formatDay(group.mark.date)}${
    group.mark.by?.trim() ? ` · recorded by ${group.mark.by}` : ''
  }${group.mark.note ? ` — ${group.mark.note}` : ''}`;

const nextLine = (group: ImmunizationGroupForecast): string | undefined =>
  group.next
    ? `Next: dose ${group.next.n} — earliest ${formatDay(group.next.earliest)}, recommended ${formatDay(
        group.next.recommended
      )}${group.next.pastDue ? `, past due ${formatDay(group.next.pastDue)}` : ''}`
    : undefined;

/** Every vaccine group with its doses, mark and next dose, from the engine's result and the records behind it. */
export const composeImmunizationRecordGroups = (
  forecast: ImmunizationForecast,
  records: GetPatientImmunizationsResponse,
  timezone: string
): ImmunizationRecordGroup[] => {
  const recordById = new Map(records.immunizations.map((record) => [record.id, record]));
  return forecast.groups.map((group) => ({
    title: `${group.label} — ${STATUS_TEXT[group.status]}`,
    target: group.targetText ? `Target: ${group.targetText}` : undefined,
    doses: [...group.doses]
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
      .map((dose) => doseLine(dose, recordById.get(dose.id), timezone)),
    mark: markLine(group),
    next: nextLine(group),
    notes: group.notes,
  }));
};

/** Doses the engine could not place in a group: no CVX, or a CVX outside the forecast (travel vaccines). */
export const composeOtherDoses = (
  forecast: ImmunizationForecast,
  records: GetPatientImmunizationsResponse,
  timezone: string
): string[] => {
  const unmapped = new Set(forecast.unmappedDoses.map((dose) => dose.id));
  return records.immunizations
    .filter((record) => !record.cvx || unmapped.has(record.id))
    .sort((a, b) => (a.dateGiven ?? '9999').localeCompare(b.dateGiven ?? '9999'))
    .map((record) => doseLine({ doseNumber: null, status: 'not-counted' }, record, timezone));
};

export const composeImmunizationRecordData: DataComposer<ImmunizationRecordInput, ImmunizationRecordData> = (input) => {
  const { appointmentPackage, forecast, records, serviceCategories } = input;
  const { appointment, location, timezone } = appointmentPackage;
  return {
    patient: composePatientInformationForDischargeSummary({ appointmentPackage }),
    visit: composeVisitData({ appointment, location, timezone, serviceCategories }),
    groups: composeImmunizationRecordGroups(forecast, records, timezone),
    otherDoses: composeOtherDoses(forecast, records, timezone),
    asOf: `As of ${formatDay(forecast.asOf)}`,
  };
};

const createImmunizationGroupsSection = (): PdfSection<ImmunizationRecordData, ImmunizationRecordData> => ({
  title: 'Immunizations',
  dataSelector: (data) => data,
  shouldRender: (data) => data.groups.length > 0,
  render: (client, data, styles) => {
    client.drawText(data.asOf, styles.textStyles.muted);
    data.groups.forEach((group) => {
      client.drawText(group.title, styles.textStyles.bold);
      if (group.target) client.drawText(group.target, styles.textStyles.muted);
      if (group.doses.length === 0) client.drawText('No doses recorded', styles.textStyles.muted);
      group.doses.forEach((dose) => client.drawText(dose, styles.textStyles.regular));
      if (group.mark) client.drawText(group.mark, styles.textStyles.regular);
      if (group.next) client.drawText(group.next, styles.textStyles.regular);
      group.notes.forEach((note) => client.drawText(note, styles.textStyles.muted));
      client.drawSeparatedLine(styles.lineStyles.separator);
    });
  },
});

const createOtherDosesSection = (): PdfSection<ImmunizationRecordData, string[]> => ({
  title: 'Other vaccines',
  dataSelector: (data) => data.otherDoses,
  shouldRender: (otherDoses) => otherDoses.length > 0,
  render: (client, otherDoses, styles) => {
    otherDoses.forEach((dose) => client.drawText(dose, styles.textStyles.regular));
    client.drawSeparatedLine(styles.lineStyles.separator);
  },
});

const immunizationRecordRenderConfig: PdfRenderConfig<ImmunizationRecordData> = {
  header: {
    title: 'IMMUNIZATION RECORD',
    leftSection: createCompactPatientHeader(),
    rightSection: createVisitInfoSection(),
  },
  headerBodySeparator: true,
  assetPaths: clinicalDocumentAssetPaths,
  styleFactory: createClinicalDocumentStyles,
  sections: [createImmunizationGroupsSection(), createOtherDosesSection()],
};

/** The record PDF, filed beside the discharge summary. The text is drawn with pdf-lib: nothing becomes markup. */
export const createImmunizationRecordPdf = async (
  input: ImmunizationRecordInput,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  const serviceCategories = await fetchServiceCategoryCatalog(createClinicalOystehrClient(token, secrets));
  return generatePdf(
    { ...input, serviceCategories },
    composeImmunizationRecordData,
    immunizationRecordRenderConfig,
    {
      patientId: input.appointmentPackage.patient!.id!,
      fileName: 'ImmunizationRecord.pdf',
      bucketName: BUCKET_NAMES.DISCHARGE_SUMMARIES,
    },
    secrets,
    token
  );
};

/** As the discharge summary's: typed for the portal and the Docs folder, a re-print superseding the last one. */
export async function makeImmunizationRecordDocumentReference(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  appointmentId: string,
  encounterId: string,
  listResources: List[]
): Promise<DocumentReference> {
  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: {
      coding: [{ system: 'http://loinc.org', code: IMMUNIZATION_RECORD_CODE, display: 'Immunization record' }],
    },
    references: {
      subject: { reference: `Patient/${patientId}` },
      context: {
        related: [{ reference: `Appointment/${appointmentId}` }],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'type', value: IMMUNIZATION_RECORD_CODE },
    ],
    listResources,
  });
  return docRefs[0];
}
