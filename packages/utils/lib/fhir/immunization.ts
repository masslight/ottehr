import { Coding, Extension, Immunization, MedicationAdministration, Organization, Reference } from 'fhir/r4b';
import { FORECAST_GROUPS } from '../immunization-forecast/groups';
import { ImmunizationGroupId } from '../immunization-forecast/types';
import {
  CVX_CODE_SYSTEM_URL,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MVX_CODE_SYSTEM_URL,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
} from '../types/api/medication-administration.constants';
import {
  ImmunizationActor,
  ImmunizationMark,
  ImmunizationMarkType,
  ImmunizationOutsideSource,
  PatientImmunizationRecord,
} from '../types/data/immunization/types';
import { getCoding } from './helpers';
import { getMedicationName } from './medication-administration';
import { getIdFromReference } from './reference';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from './systemUrls';
import { getVaccineDoseFunding, immunizationFundingFields } from './vfc';

/**
 * The FHIR Immunization record of a dose. The order/MAR workflow keeps its MedicationAdministration; a dose given here
 * ALSO gets an Immunization (FHIR R4: "SHOULD also create and expose an equivalent Immunization instance"), linked to
 * the administration by this identifier. An outside dose and a per-vaccine mark are Immunizations only. The forecast
 * engine, Flowsheets, the shot record and the registry read Immunization only.
 */
export const IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM = ottehrIdentifierSystem(
  'immunization-medication-administration'
);

/** Immunization.performer.function: HL7 v2 table 0443 (the FHIR immunization-function value set draws on it). */
export const IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0443';
export const IMMUNIZATION_ADMINISTERING_PROVIDER_CODE = 'AP';
export const IMMUNIZATION_ORDERING_PROVIDER_CODE = 'OP';
/** Who recorded a mark; v2-0443 "Entering Provider". */
export const IMMUNIZATION_ENTERING_PROVIDER_CODE = 'EP';

/** CDC NIP001 "Immunization Information Source" (codes 00–08, PHIN VADS value set 2.16.840.1.114222.4.11.7450):
 * what registries take in RXA-9 for historical doses. */
export const IMMUNIZATION_INFORMATION_SOURCE_SYSTEM = 'urn:oid:2.16.840.1.114222.4.5.293';
/** The OID first written by mistake (it is CDC's PHC code system); doses saved with it still read. */
const LEGACY_IMMUNIZATION_INFORMATION_SOURCE_SYSTEM = 'urn:oid:2.16.840.1.114222.4.5.274';

const informationSourceCode = (immunization: Immunization): string | undefined =>
  getCoding(immunization.reportOrigin, IMMUNIZATION_INFORMATION_SOURCE_SYSTEM)?.code ??
  getCoding(immunization.reportOrigin, LEGACY_IMMUNIZATION_INFORMATION_SOURCE_SYSTEM)?.code;

/** HL7 Immunization Origin: FHIR's own, coarser list for reportOrigin, written next to the NIP001 code. */
export const IMMUNIZATION_ORIGIN_SYSTEM = 'http://terminology.hl7.org/CodeSystem/immunization-origin';

export interface ImmunizationSourceOption {
  value: ImmunizationOutsideSource;
  /** The NIP001 code and its display. */
  code: string;
  display: string;
  /** How the source blank reads it, suiting children and adults alike. */
  label: string;
  /** The HL7 Immunization Origin code, where one matches. */
  origin?: { code: string; display: string };
}

export const IMMUNIZATION_OUTSIDE_SOURCES: readonly ImmunizationSourceOption[] = [
  {
    value: 'written-record',
    code: '03',
    display: "Historical information - from parent's written record",
    label: 'a written record',
    origin: { code: 'record', display: 'Written Record' },
  },
  {
    value: 'other-provider',
    code: '02',
    display: 'Historical information - from other provider',
    label: "another provider's records",
    origin: { code: 'provider', display: 'Other Provider' },
  },
  {
    value: 'recall',
    code: '04',
    display: "Historical information - from parent's recall",
    label: "the patient's or family's recall",
    origin: { code: 'recall', display: 'Parent/Guardian/Patient Recall' },
  },
  {
    value: 'other-registry',
    code: '05',
    display: 'Historical information - from other registry',
    label: 'another registry',
    origin: { code: 'jurisdiction', display: 'Jurisdictional IIS' },
  },
  {
    value: 'school-record',
    code: '07',
    display: 'Historical information - from school record',
    label: 'a school record',
    origin: { code: 'school', display: 'School Record' },
  },
  {
    value: 'birth-certificate',
    code: '06',
    display: 'Historical information - from birth certificate',
    label: 'a birth certificate',
    origin: { code: 'record', display: 'Written Record' },
  },
  {
    value: 'public-agency',
    code: '08',
    display: 'Historical information - from public agency',
    label: 'a public agency',
  },
];

/** The source sent when the line's source blank is empty. */
export const IMMUNIZATION_SOURCE_UNSPECIFIED = {
  code: '01',
  display: 'Historical information - source unspecified',
  label: 'source unspecified',
} as const;

/** Written when the date an outside dose was given is not known: Immunization.occurrence[x] is required. */
export const IMMUNIZATION_DATE_UNKNOWN = 'unknown';

/** The vaccine groups a mark can name: the v1 forecast coverage, one group per series. */
export const VACCINE_GROUP_CODE_SYSTEM = ottehrCodeSystemUrl('vaccine-group');
// The forecast engine's lanes, so a mark names exactly the group the engine reports.
export const VACCINE_GROUPS: readonly { code: ImmunizationGroupId; display: string }[] = FORECAST_GROUPS.map(
  (group) => ({
    code: group.id,
    display: group.label,
  })
);

/** A mark is an Immunization with status not-done and the reason from v3 ActReason. */
export const IMMUNIZATION_MARK_REASON_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActReason';
export const IMMUNIZATION_MARKS: Record<ImmunizationMarkType, { code: string; display: string }> = {
  immune: { code: 'IMMUNE', display: 'immunity' },
  contraindicated: { code: 'MEDPREC', display: 'medical precaution' },
  declined: { code: 'PATOBJ', display: 'patient objection' },
};

/** A cleared mark is kept, with when and by whom it was cleared, instead of being deleted. */
export const IMMUNIZATION_MARK_CLEARED_EXTENSION_URL = ottehrExtensionUrl('immunization-mark-cleared');
export const IMMUNIZATION_MARK_CLEARED_DATE_URL = 'date';
export const IMMUNIZATION_MARK_CLEARED_BY_URL = 'by';

const ADMINISTERED_MEDICATION_ADMINISTRATION_STATUSES: MedicationAdministration['status'][] = ['completed', 'on-hold'];

export const getImmunizationAdministrationId = (immunization: Immunization): string | undefined =>
  immunization.identifier?.find((identifier) => identifier.system === IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM)
    ?.value;

export const isImmunizationMark = (immunization: Immunization): boolean =>
  immunization.status === 'not-done' &&
  getCoding(immunization.statusReason, IMMUNIZATION_MARK_REASON_SYSTEM) !== undefined &&
  getCoding(immunization.vaccineCode, VACCINE_GROUP_CODE_SYSTEM) !== undefined;

const actorFromReference = (reference: Reference | undefined): ImmunizationActor | undefined =>
  reference ? { id: getIdFromReference(reference.reference), name: reference.display ?? '' } : undefined;

const performerActor = (immunization: Immunization, functionCode: string): ImmunizationActor | undefined =>
  actorFromReference(
    immunization.performer?.find(
      (performer) => getCoding(performer.function, IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM)?.code === functionCode
    )?.actor
  );

export const immunizationPerformer = (
  actor: Reference,
  functionCode: string
): NonNullable<Immunization['performer']>[number] => ({
  function: { coding: [{ system: IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM, code: functionCode }] },
  actor,
});

const vaccineCodeFrom = (name: string | undefined, cvx: string | undefined): Immunization['vaccineCode'] => ({
  ...(cvx && { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] }),
  ...(name && { text: name }),
});

const manufacturerFrom = (name: string | undefined, mvx: string | undefined): Reference | undefined =>
  name || mvx
    ? {
        ...(name && { display: name }),
        ...(mvx && { identifier: { system: MVX_CODE_SYSTEM_URL, value: mvx } }),
      }
    : undefined;

/** The administration codes an immunization order keeps on its contained Medication (CVX, MVX, NDC, CPT). */
const administrationCode = (medicationAdministration: MedicationAdministration, system: string): Coding | undefined => {
  const medication = medicationAdministration.contained?.find((resource) => resource.resourceType === 'Medication');
  for (const extension of medication?.extension ?? []) {
    if (extension.url !== VACCINE_ADMINISTRATION_CODES_EXTENSION_URL) continue;
    const coding = getCoding(extension.valueCodeableConcept, system);
    if (coding) return coding;
  }
  return undefined;
};

const maPerformerActor = (medicationAdministration: MedicationAdministration, code: string): Reference | undefined =>
  // the last one: a re-administration appends the administering nurse again
  [...(medicationAdministration.performer ?? [])]
    .reverse()
    .find((performer) => getCoding(performer.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code === code)
    ?.actor;

/**
 * The Immunization equivalent of an immunization order's MedicationAdministration: completed while the order is
 * administered or partly administered, entered-in-error once it is undone (not administered, cancelled). `existing`
 * keeps the record's id and when it was first recorded, so a re-administration updates it in place.
 */
export function immunizationFromMedicationAdministration(
  medicationAdministration: MedicationAdministration,
  existing?: Immunization
): Immunization {
  const medication = medicationAdministration.contained?.find((resource) => resource.resourceType === 'Medication');
  const manufacturerOrg = medication?.manufacturer?.reference?.startsWith('#')
    ? (medicationAdministration.contained?.find(
        (resource) => resource.id === medication.manufacturer?.reference?.slice(1)
      ) as Organization | undefined)
    : undefined;
  const administeredBy = maPerformerActor(medicationAdministration, PRACTITIONER_ADMINISTERED_MEDICATION_CODE);
  const orderedBy = maPerformerActor(medicationAdministration, PRACTITIONER_ORDERED_BY_MEDICATION_CODE);
  const dose = medicationAdministration.dosage?.dose;
  return {
    resourceType: 'Immunization',
    ...(existing?.id && { id: existing.id, meta: existing.meta }),
    identifier: [{ system: IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM, value: medicationAdministration.id! }],
    status: ADMINISTERED_MEDICATION_ADMINISTRATION_STATUSES.includes(medicationAdministration.status)
      ? 'completed'
      : 'entered-in-error',
    vaccineCode: vaccineCodeFrom(
      getMedicationName(medication) ?? medication?.code?.text,
      administrationCode(medicationAdministration, CVX_CODE_SYSTEM_URL)?.code
    ),
    patient: medicationAdministration.subject,
    ...(medicationAdministration.context && { encounter: medicationAdministration.context }),
    occurrenceDateTime:
      medicationAdministration.effectiveDateTime ?? existing?.occurrenceDateTime ?? new Date().toISOString(),
    recorded: existing?.recorded ?? new Date().toISOString(),
    primarySource: true,
    ...(manufacturerFrom(
      manufacturerOrg?.name,
      administrationCode(medicationAdministration, MVX_CODE_SYSTEM_URL)?.code
    ) && {
      manufacturer: manufacturerFrom(
        manufacturerOrg?.name,
        administrationCode(medicationAdministration, MVX_CODE_SYSTEM_URL)?.code
      ),
    }),
    ...(medication?.batch?.lotNumber && { lotNumber: medication.batch.lotNumber }),
    ...(medication?.batch?.expirationDate && { expirationDate: medication.batch.expirationDate }),
    ...(medicationAdministration.dosage?.site && { site: medicationAdministration.dosage.site }),
    ...(medicationAdministration.dosage?.route && { route: medicationAdministration.dosage.route }),
    ...(dose?.value != null && { doseQuantity: dose }),
    performer: [
      ...(administeredBy ? [immunizationPerformer(administeredBy, IMMUNIZATION_ADMINISTERING_PROVIDER_CODE)] : []),
      ...(orderedBy ? [immunizationPerformer(orderedBy, IMMUNIZATION_ORDERING_PROVIDER_CODE)] : []),
    ],
    // the stock the dose came from and the patient's VFC eligibility that day, as registries read them
    ...immunizationFundingFields(getVaccineDoseFunding(medicationAdministration)),
  };
}

const sourceFromReportOrigin = (immunization: Immunization): PatientImmunizationRecord['source'] | undefined => {
  const code = informationSourceCode(immunization);
  if (!code) return undefined;
  return IMMUNIZATION_OUTSIDE_SOURCES.find((source) => source.code === code)?.value ?? 'unspecified';
};

/** A dose record for the history, the engine and the shot record; undated outside doses say so. */
export function immunizationToRecord(immunization: Immunization): PatientImmunizationRecord {
  const outside = immunization.primarySource === false;
  const dateGiven = immunization.occurrenceDateTime;
  return {
    id: immunization.id!,
    vaccineName:
      immunization.vaccineCode.text ?? getCoding(immunization.vaccineCode, CVX_CODE_SYSTEM_URL)?.display ?? '',
    cvx: getCoding(immunization.vaccineCode, CVX_CODE_SYSTEM_URL)?.code,
    outside,
    dateGiven,
    dateUnknown: !dateGiven,
    administeredBy: performerActor(immunization, IMMUNIZATION_ADMINISTERING_PROVIDER_CODE),
    place: immunization.location?.display,
    source: outside ? sourceFromReportOrigin(immunization) ?? 'unspecified' : undefined,
    sourceCode: outside ? informationSourceCode(immunization) ?? IMMUNIZATION_SOURCE_UNSPECIFIED.code : undefined,
    lot: immunization.lotNumber,
    expirationDate: immunization.expirationDate,
    manufacturer: immunization.manufacturer?.display,
    mvx:
      immunization.manufacturer?.identifier?.system === MVX_CODE_SYSTEM_URL
        ? immunization.manufacturer.identifier.value
        : undefined,
    medicationAdministrationId: getImmunizationAdministrationId(immunization),
    encounterId: getIdFromReference(immunization.encounter?.reference, 'Encounter'),
    recorded: immunization.recorded,
  };
}

const clearedExtension = (immunization: Immunization): Extension | undefined =>
  immunization.extension?.find((extension) => extension.url === IMMUNIZATION_MARK_CLEARED_EXTENSION_URL);

/** The mark with its history, for the engine (an active mark takes the vaccine out of Due today) and the UI. */
export function immunizationMarkToRecord(immunization: Immunization): ImmunizationMark {
  const groupCoding = getCoding(immunization.vaccineCode, VACCINE_GROUP_CODE_SYSTEM);
  const reasonCode = getCoding(immunization.statusReason, IMMUNIZATION_MARK_REASON_SYSTEM)?.code;
  const mark = (Object.keys(IMMUNIZATION_MARKS) as ImmunizationMarkType[]).find(
    (type) => IMMUNIZATION_MARKS[type].code === reasonCode
  );
  const cleared = clearedExtension(immunization);
  const clearedAt = cleared?.extension?.find((e) => e.url === IMMUNIZATION_MARK_CLEARED_DATE_URL)?.valueDateTime;
  const clearedBy = actorFromReference(
    cleared?.extension?.find((e) => e.url === IMMUNIZATION_MARK_CLEARED_BY_URL)?.valueReference
  );
  return {
    id: immunization.id!,
    vaccineGroup: {
      code: groupCoding?.code ?? '',
      display:
        VACCINE_GROUPS.find((group) => group.code === groupCoding?.code)?.display ??
        immunization.vaccineCode.text ??
        groupCoding?.code ??
        '',
    },
    mark: mark ?? 'declined',
    markedAt: immunization.recorded ?? immunization.occurrenceDateTime ?? '',
    markedBy: performerActor(immunization, IMMUNIZATION_ENTERING_PROVIDER_CODE) ?? { name: '' },
    note: immunization.note?.[0]?.text,
    ...(clearedAt && clearedBy && { cleared: { at: clearedAt, by: clearedBy } }),
  };
}

export const isImmunizationMarkCleared = (immunization: Immunization): boolean =>
  clearedExtension(immunization) !== undefined;
