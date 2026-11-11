import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Immunization, MedicationAdministration, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import {
  IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM,
  IMMUNIZATION_DATE_UNKNOWN,
  IMMUNIZATION_ENTERING_PROVIDER_CODE,
  IMMUNIZATION_INFORMATION_SOURCE_SYSTEM,
  IMMUNIZATION_MARK_CLEARED_BY_URL,
  IMMUNIZATION_MARK_CLEARED_DATE_URL,
  IMMUNIZATION_MARK_CLEARED_EXTENSION_URL,
  IMMUNIZATION_MARK_REASON_SYSTEM,
  IMMUNIZATION_MARKS,
  IMMUNIZATION_ORIGIN_SYSTEM,
  IMMUNIZATION_OUTSIDE_SOURCES,
  IMMUNIZATION_SOURCE_UNSPECIFIED,
  immunizationFromMedicationAdministration,
  immunizationMarkToRecord,
  immunizationPerformer,
  immunizationToRecord,
  isImmunizationMark,
  isImmunizationMarkCleared,
  VACCINE_GROUP_CODE_SYSTEM,
  VACCINE_GROUPS,
} from 'utils/lib/fhir/immunization';
import { CVX_CODE_SYSTEM_URL, MVX_CODE_SYSTEM_URL } from 'utils/lib/types/api/medication-administration.constants';
import { RoleType } from 'utils/lib/types/api/user.types';
import {
  GetPatientImmunizationsResponse,
  ImmunizationMarkType,
  OutsideImmunizationDetails,
  SaveImmunizationMarkRequest,
} from 'utils/lib/types/data/immunization/types';
import { APIError, APIErrorCode, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { callerHasRole } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';

/** Every active staff role: immunization records are read and written by clinical and front-desk staff alike. */
export const IMMUNIZATION_STAFF_ROLES = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.Clinician,
  RoleType.Provider,
  RoleType.Staff,
  RoleType.CustomerSupport,
];

export async function assertImmunizationStaff(input: ZambdaInput, action: string): Promise<void> {
  if (!(await callerHasRole(input.headers?.Authorization, input.secrets, IMMUNIZATION_STAFF_ROLES))) {
    const error: APIError = { code: APIErrorCode.NOT_AUTHORIZED, message: `You are not permitted to ${action}.` };
    throw error;
  }
}

// FHIR id: letters, digits, '-' and '.', 1–64 characters; the only client input the record queries are built from
const FHIR_ID = /^[A-Za-z0-9\-.]{1,64}$/;
const MAX_TEXT_LENGTH = 500;

export function validateFhirId(value: unknown, field: string): string {
  if (value === undefined || value === null || value === '') throw MISSING_REQUIRED_PARAMETERS([field]);
  if (typeof value !== 'string' || !FHIR_ID.test(value)) throw INVALID_INPUT_ERROR(`${field} is not a valid id`);
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw INVALID_INPUT_ERROR(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH)
    throw INVALID_INPUT_ERROR(`${field} is longer than ${MAX_TEXT_LENGTH} characters`);
  return trimmed || undefined;
}

function optionalCode(value: unknown, field: string): string | undefined {
  const text = optionalText(value, field);
  return text ? sanitizeStringForFhirCode(text) || undefined : undefined;
}

/** The external line's values, checked: the vaccine named, the date (when given) a real past date, the source known. */
export function validateOutsideImmunizationDetails(body: any): OutsideImmunizationDetails {
  const name = optionalText(body?.vaccine?.name, 'vaccine.name');
  if (!name) throw MISSING_REQUIRED_PARAMETERS(['vaccine.name']);
  const id = body?.vaccine?.id ? validateFhirId(body.vaccine.id, 'vaccine.id') : undefined;
  const dateGiven = optionalText(body?.dateGiven, 'dateGiven');
  if (dateGiven) {
    const date = DateTime.fromISO(dateGiven);
    if (!date.isValid || date.year < 1900 || !/^\d{4}-\d{2}-\d{2}$/.test(dateGiven)) {
      throw INVALID_INPUT_ERROR(`Invalid date given, "${dateGiven}" is not a valid date`);
    }
    if (date.startOf('day') > DateTime.now().startOf('day')) {
      throw INVALID_INPUT_ERROR('The date given cannot be in the future');
    }
  }
  const source = optionalText(body?.source, 'source');
  if (source && !IMMUNIZATION_OUTSIDE_SOURCES.some((option) => option.value === source)) {
    throw INVALID_INPUT_ERROR(`Unknown source "${source}"`);
  }
  return {
    vaccine: { ...(id && { id }), name },
    cvx: optionalCode(body?.cvx, 'cvx'),
    dateGiven,
    place: optionalText(body?.place, 'place'),
    source: source as OutsideImmunizationDetails['source'],
    lot: optionalText(body?.lot, 'lot'),
    manufacturer: optionalText(body?.manufacturer, 'manufacturer'),
    mvx: optionalCode(body?.mvx, 'mvx'),
  };
}

/**
 * An outside dose: an Immunization only (primarySource false, the source coded from CDC NIP001 and, where one matches, HL7 Immunization Origin), straight into the
 * history. No order, no stock, no billing. Without a date given, occurrenceString says the date is unknown.
 */
export function buildOutsideImmunization(
  details: OutsideImmunizationDetails,
  patient: Reference,
  encounter: Reference,
  recorder: Reference,
  now: DateTime = DateTime.now()
): Immunization {
  const source = IMMUNIZATION_OUTSIDE_SOURCES.find((option) => option.value === details.source);
  const origin = source ?? IMMUNIZATION_SOURCE_UNSPECIFIED;
  return {
    resourceType: 'Immunization',
    status: 'completed',
    primarySource: false,
    reportOrigin: {
      coding: [
        { system: IMMUNIZATION_INFORMATION_SOURCE_SYSTEM, code: origin.code, display: origin.display },
        ...(source?.origin ? [{ system: IMMUNIZATION_ORIGIN_SYSTEM, ...source.origin }] : []),
      ],
      text: origin.label,
    },
    vaccineCode: {
      ...(details.cvx && { coding: [{ system: CVX_CODE_SYSTEM_URL, code: details.cvx }] }),
      text: details.vaccine.name,
    },
    patient,
    encounter,
    ...(details.dateGiven
      ? { occurrenceDateTime: details.dateGiven }
      : { occurrenceString: IMMUNIZATION_DATE_UNKNOWN }),
    recorded: now.toISO()!,
    ...(details.place && { location: { display: details.place } }),
    ...(details.lot && { lotNumber: details.lot }),
    ...((details.manufacturer || details.mvx) && {
      manufacturer: {
        ...(details.manufacturer && { display: details.manufacturer }),
        ...(details.mvx && { identifier: { system: MVX_CODE_SYSTEM_URL, value: details.mvx } }),
      },
    }),
    performer: [immunizationPerformer(recorder, IMMUNIZATION_ENTERING_PROVIDER_CODE)],
  };
}

export function validateImmunizationMarkInput(body: any): SaveImmunizationMarkRequest {
  const patientId = validateFhirId(body?.patientId, 'patientId');
  const vaccineGroup = body?.vaccineGroup;
  if (!vaccineGroup) throw MISSING_REQUIRED_PARAMETERS(['vaccineGroup']);
  if (!VACCINE_GROUPS.some((group) => group.code === vaccineGroup)) {
    throw INVALID_INPUT_ERROR(`Unknown vaccine group "${String(vaccineGroup)}"`);
  }
  const mark = body?.mark;
  if (!mark) throw MISSING_REQUIRED_PARAMETERS(['mark']);
  if (!(mark in IMMUNIZATION_MARKS)) throw INVALID_INPUT_ERROR(`Unknown mark "${String(mark)}"`);
  return { patientId, vaccineGroup, mark: mark as ImmunizationMarkType, note: optionalText(body?.note, 'note') };
}

/**
 * A per-vaccine mark (Immune / Contraindicated / Declined): an Immunization not done, the reason from v3 ActReason,
 * the vaccine group as its vaccineCode, who recorded it as the entering provider and when as `recorded`.
 */
export function buildImmunizationMark(
  input: SaveImmunizationMarkRequest,
  patient: Reference,
  recorder: Reference,
  now: DateTime = DateTime.now()
): Immunization {
  const reason = IMMUNIZATION_MARKS[input.mark];
  const group = VACCINE_GROUPS.find((candidate) => candidate.code === input.vaccineGroup)!;
  return {
    resourceType: 'Immunization',
    status: 'not-done',
    statusReason: { coding: [{ system: IMMUNIZATION_MARK_REASON_SYSTEM, code: reason.code, display: reason.display }] },
    vaccineCode: { coding: [{ system: VACCINE_GROUP_CODE_SYSTEM, code: group.code }], text: group.display },
    patient,
    occurrenceDateTime: now.toISO()!,
    recorded: now.toISO()!,
    primarySource: true,
    performer: [immunizationPerformer(recorder, IMMUNIZATION_ENTERING_PROVIDER_CODE)],
    ...(input.note && { note: [{ text: input.note, authorReference: recorder, time: now.toISO()! }] }),
  };
}

/** Clearing keeps the mark, with who cleared it and when; a cleared mark cannot be cleared again. */
export function clearImmunizationMark(
  mark: Immunization,
  clearedBy: Reference,
  now: DateTime = DateTime.now()
): Immunization {
  if (!isImmunizationMark(mark)) throw INVALID_INPUT_ERROR('The record is not an immunization mark');
  if (isImmunizationMarkCleared(mark)) throw INVALID_INPUT_ERROR('The mark is already cleared');
  return {
    ...mark,
    extension: [
      ...(mark.extension ?? []),
      {
        url: IMMUNIZATION_MARK_CLEARED_EXTENSION_URL,
        extension: [
          { url: IMMUNIZATION_MARK_CLEARED_DATE_URL, valueDateTime: now.toISO()! },
          { url: IMMUNIZATION_MARK_CLEARED_BY_URL, valueReference: clearedBy },
        ],
      },
    ],
  };
}

/** The patient's Immunization records; the query is fixed here, the patient id its only input. */
export const searchPatientImmunizations = (oystehr: Oystehr, patientId: string): Promise<Immunization[]> =>
  getAllFhirSearchPages<Immunization>(
    { resourceType: 'Immunization', params: [{ name: 'patient', value: `Patient/${patientId}` }] },
    oystehr
  );

/** The active mark on a vaccine group, if any: at most one is active at a time. */
export const activeMarkForGroup = (immunizations: Immunization[], vaccineGroup: string): Immunization | undefined =>
  immunizations.find(
    (immunization) =>
      isImmunizationMark(immunization) &&
      !isImmunizationMarkCleared(immunization) &&
      immunization.vaccineCode.coding?.some(
        (coding) => coding.system === VACCINE_GROUP_CODE_SYSTEM && coding.code === vaccineGroup
      )
  );

const dateKey = (value: string | undefined): string => value ?? '';

/** Doses (given here and outside, newest first, undated last) and marks with their history (newest first). */
export function buildPatientImmunizationsResponse(immunizations: Immunization[]): GetPatientImmunizationsResponse {
  const marks = immunizations.filter(isImmunizationMark);
  const doses = immunizations.filter(
    (immunization) => !isImmunizationMark(immunization) && immunization.status === 'completed'
  );
  return {
    immunizations: doses
      .map(immunizationToRecord)
      .sort(
        (a, b) =>
          dateKey(b.dateGiven).localeCompare(dateKey(a.dateGiven)) ||
          dateKey(b.recorded).localeCompare(dateKey(a.recorded))
      ),
    marks: marks.map(immunizationMarkToRecord).sort((a, b) => b.markedAt.localeCompare(a.markedAt)),
  };
}

export async function findImmunizationForAdministration(
  oystehr: Oystehr,
  medicationAdministrationId: string
): Promise<Immunization | undefined> {
  const matches = (
    await oystehr.fhir.search<Immunization>({
      resourceType: 'Immunization',
      params: [
        { name: 'identifier', value: `${IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM}|${medicationAdministrationId}` },
      ],
    })
  ).unbundle();
  return matches[0];
}

/**
 * The transaction request that keeps an order's Immunization in step with its MedicationAdministration: created when
 * the order is administered, updated when it is edited or re-administered, entered-in-error when it is undone.
 * Nothing when the order was never administered.
 */
export async function immunizationSyncRequest(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration
): Promise<BatchInputRequest<Immunization> | undefined> {
  const existing = await findImmunizationForAdministration(oystehr, medicationAdministration.id!);
  const administered = ['completed', 'on-hold'].includes(medicationAdministration.status);
  if (!existing && !administered) return undefined;
  const immunization = immunizationFromMedicationAdministration(medicationAdministration, existing);
  return existing
    ? { method: 'PUT', url: `/Immunization/${existing.id}`, resource: immunization }
    : { method: 'POST', url: '/Immunization', resource: immunization };
}
