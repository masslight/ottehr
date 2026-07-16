import { DetectedIssue, Medication, MedicationAdministration, MedicationRequest } from 'fhir/r4b';
import { CODE_SYSTEM_ACT_CODE_V3, CODE_SYSTEM_CPT, CODE_SYSTEM_HL7_HCPCS, CODE_SYSTEM_NDC } from '../helpers';
import {
  AllergyInteraction,
  DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
  DrugInteraction,
  ExtendedMedicationDataForResponse,
  INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
  INTERACTIONS_UNAVAILABLE,
  ISSUE_TYPE_CODE_SYSTEM,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_APPLIANCE_LOCATION_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
  MedicationApplianceLocation,
  medicationApplianceLocations,
  MedicationApplianceRoute,
  medicationApplianceRoutes,
  MedicationData,
  MedicationInteractions,
  MedicationOrderStatusesType,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
  TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
  UpdateMedicationOrderInput,
} from '../types';
import { getCoding } from './helpers';

// Local const so that DEPRECATED system doesn't get imported from utils
const CODE_SYSTEM_HCPCS = 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'; // formerly used by Ottehr clinical in-house meds

export type MedicationUnitOptions = 'mg' | 'ml' | 'g' | 'cc' | 'unit' | 'application';
export const UNIT_OPTIONS: { value: MedicationUnitOptions; label: string }[] = [
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'mL' },
  { value: 'g', label: 'g' },
  { value: 'cc', label: 'cc' },
  { value: 'unit', label: 'unit' },
  { value: 'application', label: 'application' },
];

export function mapFhirToOrderStatus(
  medicationAdministration: MedicationAdministration
): MedicationOrderStatusesType | undefined {
  switch (medicationAdministration.status) {
    case 'completed':
      return 'administered';
    case 'on-hold':
      return 'administered-partly';
    case 'not-done':
      return 'administered-not';
    case 'in-progress':
      return 'pending';
    case 'stopped':
      return 'cancelled';
  }
  return undefined;
}

export function mapOrderStatusToFhir(status: MedicationOrderStatusesType): MedicationAdministration['status'] {
  switch (status) {
    case 'pending':
      return 'in-progress';
    case 'administered-partly':
      return 'on-hold';
    case 'administered-not':
      return 'not-done';
    case 'administered':
      return 'completed';
    case 'cancelled':
      return 'stopped';
  }
}

export function getMedicationName(medication: Medication | undefined): string | undefined {
  return medication?.identifier?.find((idn) => idn.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value;
}

export function getMedicationTypeCode(medication: Medication): string | undefined {
  return medication.identifier?.find((idn) => idn.system === MEDICATION_TYPE_SYSTEM)?.value;
}

export function getDosageUnitsAndRouteOfMedication(medicationAdministration: MedicationAdministration): {
  dose: number | undefined;
  units: string | undefined;
  route: string | undefined;
} {
  return {
    dose: medicationAdministration.dosage?.dose?.value,
    units: medicationAdministration.dosage?.dose?.unit,
    route: medicationAdministration.dosage?.route?.coding?.find(
      (coding) => coding.system === MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM
    )?.code,
  };
}

export function getPractitionerIdThatOrderedMedication(
  medicationAdministration: MedicationAdministration
): string | undefined {
  return medicationAdministration.performer
    ?.find((performer) =>
      performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ORDERED_MEDICATION_CODE)
    )
    ?.actor.reference?.replace('Practitioner/', '');
}

export function getReasonAndOtherReasonForNotAdministeredOrder(medicationAdministration: MedicationAdministration): {
  reason: string | undefined;
  otherReason: string | undefined;
} {
  return {
    reason: medicationAdministration.note?.find((note) => note.authorString === MEDICATION_ADMINISTRATION_REASON_CODE)
      ?.text,
    otherReason: medicationAdministration.note?.find(
      (note) => note.authorString === MEDICATION_ADMINISTRATION_OTHER_REASON_CODE
    )?.text,
  };
}

export function getLocationFromMedicationAdministration(
  medicationAdministration: MedicationAdministration
): { code: string; name: string } | undefined {
  const coding = medicationAdministration.dosage?.site?.coding?.find(
    (coding) => coding.system === MEDICATION_APPLIANCE_LOCATION_SYSTEM
  );
  if (!coding?.code) return undefined;
  // Match (code, display) to keep left/right apart; fall back to code-only on display drift.
  const match =
    medicationApplianceLocations.find((l) => l.code === coding.code && l.display === coding.display) ??
    medicationApplianceLocations.find((l) => l.code === coding.code);
  if (!match?.name) return undefined;
  return { code: match.code, name: match.name };
}

export function getProviderIdAndDateMedicationWasAdministered(medicationAdministration: MedicationAdministration):
  | {
      administeredProviderId: string;
      dateAdministered?: string;
      timeAdministered?: string;
    }
  | undefined {
  const administeredPerformer = medicationAdministration.performer?.find((performer) =>
    performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ADMINISTERED_MEDICATION_CODE)
  );

  const administeredProviderId = administeredPerformer?.actor.reference?.replace('Practitioner/', '');

  const dateAdministered = administeredPerformer?.extension?.find(
    (ext) => ext.url === DATE_OF_MEDICATION_ADMINISTERED_SYSTEM
  )?.valueDate;

  const timeAdministered = administeredPerformer?.extension?.find(
    (ext) => ext.url === TIME_OF_MEDICATION_ADMINISTERED_SYSTEM
  )?.valueTime;

  if (administeredProviderId) {
    return { administeredProviderId, dateAdministered, timeAdministered };
  }

  return undefined;
}

export function getCreatedTheOrderProviderId(medicationAdministration: MedicationAdministration): string | undefined {
  return medicationAdministration.performer
    ?.find((performer) =>
      performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ORDERED_MEDICATION_CODE)
    )
    ?.actor.reference?.replace('Practitioner/', '');
}

/**
 * Gets all "ordered by" providers in chronological order (history)
 */
export function getAllOrderedByProviderIds(medicationAdministration: MedicationAdministration): string[] {
  return (
    (medicationAdministration.performer
      ?.filter((performer) =>
        performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ORDERED_BY_MEDICATION_CODE)
      )
      ?.map((performer) => performer.actor.reference?.replace('Practitioner/', ''))
      ?.filter((id) => id !== undefined) as string[]) || []
  );
}

/**
 * Gets the current "ordered by" provider (last one in the history)
 */
export function getCurrentOrderedByProviderId(medicationAdministration: MedicationAdministration): string | undefined {
  const allOrderedByProviders = getAllOrderedByProviderIds(medicationAdministration);
  return allOrderedByProviders.length > 0 ? allOrderedByProviders[allOrderedByProviders.length - 1] : undefined;
}

export const searchRouteByCode = (
  code: keyof typeof medicationApplianceRoutes | undefined
): MedicationApplianceRoute | undefined => {
  return Object.values(medicationApplianceRoutes).find((route) => route.code === code);
};

export function searchMedicationLocation(
  code: string | undefined,
  name?: string | undefined
): MedicationApplianceLocation | undefined {
  return medicationApplianceLocations.find(
    (location) => location.code === code && (name ? location.name === name : true)
  );
}

export const medicationExtendedToMedicationData = (
  medicationExtendedData: ExtendedMedicationDataForResponse
): MedicationData => {
  return {
    patient: medicationExtendedData.patient,
    encounterId: medicationExtendedData.encounterId,
    medicationId: medicationExtendedData.medicationId,
    dose: medicationExtendedData.dose,
    route: medicationExtendedData.route,
    instructions: medicationExtendedData.instructions,
    reason: medicationExtendedData.reason,
    otherReason: medicationExtendedData.otherReason,
    associatedDx: medicationExtendedData.associatedDx,
    units: medicationExtendedData.units,
    manufacturer: medicationExtendedData.manufacturer,
    location: medicationExtendedData.location,
    lotNumber: medicationExtendedData.lotNumber,
    ndc: medicationExtendedData.ndc,
    expDate: medicationExtendedData.expDate,
    effectiveDateTime: medicationExtendedData.effectiveDateTime,
    cptCodes: medicationExtendedData.cptCodes,
  };
};

/** Billable units = ceil(dose / billable unit size), minimum 1. Defaults to 1 when either value is missing/invalid. */
export const computeBillableUnits = (dose: number | undefined, billableUnitSize: number | undefined): number => {
  const doseNum = Number(dose);
  if (
    billableUnitSize == null ||
    !Number.isFinite(billableUnitSize) ||
    billableUnitSize <= 0 ||
    !Number.isFinite(doseNum) ||
    doseNum <= 0
  ) {
    return 1;
  }
  return Math.max(1, Math.ceil(doseNum / billableUnitSize));
};

export const makeMedicationOrderUpdateRequestInput = ({
  id,
  newStatus,
  orderData,
}: {
  id?: string;
  newStatus?: MedicationOrderStatusesType;
  orderData?: Partial<MedicationData>;
}): UpdateMedicationOrderInput => {
  const request: UpdateMedicationOrderInput = {};
  if (id) {
    request.orderId = id;
  }
  if (newStatus) {
    request.newStatus = newStatus;
  }
  if (orderData) {
    request.orderData = orderData as MedicationData;
  }
  return request;
};

export const getMedicationInteractions = (
  medicationRequest: MedicationRequest | undefined
): MedicationInteractions | undefined => {
  const drugInteractions =
    medicationRequest?.contained
      ?.filter((resource) => {
        return (
          resource.resourceType === 'DetectedIssue' && getCoding(resource.code, CODE_SYSTEM_ACT_CODE_V3)?.code === 'DRG'
        );
      })
      ?.map<DrugInteraction>((resource) => {
        const issue = resource as DetectedIssue;
        const sourceReference = issue.evidence?.find((evidence) => evidence.detail != null)?.detail?.[0];
        const sourceReferenceString = sourceReference?.reference;
        const sourceDisplay = sourceReference?.display;
        return {
          drugs: (issue.evidence ?? []).flatMap((evidence) => {
            const coding = getCoding(evidence.code, MEDICATION_DISPENSABLE_DRUG_ID);
            const drugId = coding?.code;
            const drugName = coding?.display;
            if (drugId && drugName) {
              return [
                {
                  id: drugId,
                  name: drugName,
                },
              ];
            }
            return [];
          }),
          severity: issue.severity,
          message: issue.detail,
          overrideReason: getOverrideReason(issue),
          source:
            sourceReferenceString && sourceDisplay
              ? {
                  reference: sourceReferenceString,
                  display: sourceDisplay,
                }
              : undefined,
        };
      }) ?? [];
  const allergyInteractions =
    medicationRequest?.contained
      ?.filter((resource) => {
        return (
          resource.resourceType === 'DetectedIssue' &&
          // cSpell:disable-next al(ler)gy
          getCoding(resource.code, CODE_SYSTEM_ACT_CODE_V3)?.code === 'ALGY'
        );
      })
      ?.map<AllergyInteraction>((resource) => {
        const issue = resource as DetectedIssue;
        return {
          message: issue.detail,
          overrideReason: getOverrideReason(issue),
        };
      }) ?? [];
  const interactionUnavailableIssue = medicationRequest?.contained?.find((resource) => {
    return (
      resource.resourceType === 'DetectedIssue' &&
      getCoding(resource.code, ISSUE_TYPE_CODE_SYSTEM)?.code === INTERACTIONS_UNAVAILABLE
    );
  });
  if (interactionUnavailableIssue) {
    return undefined;
  }
  return {
    drugInteractions,
    allergyInteractions,
  };
};

const getOverrideReason = (issue: DetectedIssue): string | undefined => {
  for (const mitigation of issue.mitigation ?? []) {
    const overrideReason = getCoding(mitigation.action, INTERACTION_OVERRIDE_REASON_CODE_SYSTEM)?.code;
    if (overrideReason) {
      return overrideReason;
    }
  }
  return undefined;
};

export const medicationStatusDisplayLabelMap: Record<MedicationOrderStatusesType, string> = {
  pending: 'Pending',
  administered: 'Administered',
  'administered-partly': 'Partly Administered',
  'administered-not': 'Not Administered',
  cancelled: 'Cancelled',
};

export const createMedicationString = (medication: ExtendedMedicationDataForResponse): string => {
  const name = medication.medicationName;
  const dose = medication.dose && `${medication.dose} ${medication.units}`;
  const route = searchRouteByCode(medication.route)?.display;
  const location = medication.location?.name;
  const givenBy = medication.administeredProvider && `given by ${medication.administeredProvider}`;
  const instructions = medication.instructions && `instructions: ${medication.instructions}`;
  const status = medicationStatusDisplayLabelMap[medication.status];

  return [name, dose, route, location, givenBy, instructions, status].filter(Boolean).join(', ');
};

export function getMedicationFromMA(medicationAdministration: MedicationAdministration): Medication | undefined {
  return medicationAdministration.contained?.find((res) => res.resourceType === 'Medication') as Medication;
}

export const MEDICATION_CPT_CODES_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/medication-cpt-codes';

export interface MedicationCptCodeEntry {
  code: string;
  display: string;
  isMedication?: boolean;
  billableUnitSize?: number;
  billableUnits?: number;
}

/** Parses the CPT/HCPCS codes (with optional billing unit data) stored on a MedicationAdministration extension. */
export function getCptCodesFromMA(
  medicationAdministration: MedicationAdministration
): MedicationCptCodeEntry[] | undefined {
  const ext = medicationAdministration.extension?.find((e) => e.url === MEDICATION_CPT_CODES_EXTENSION_URL);
  if (!ext?.valueString) return undefined;
  try {
    return JSON.parse(ext.valueString) as MedicationCptCodeEntry[];
  } catch {
    return undefined;
  }
}

export function getNdcCodeFromMedication(medication: Medication): string | undefined {
  const medicationCoding = medication.code;
  return getCoding(medicationCoding, CODE_SYSTEM_NDC)?.code;
}

export function getCptCodeFromMedication(medication: Medication): string | undefined {
  const medicationCoding = medication.code;
  return getCoding(medicationCoding, CODE_SYSTEM_CPT)?.code;
}

export function getHcpcsCodeFromMedication(medication: Medication): string | undefined {
  const medicationCoding = medication.code;
  return (
    getCoding(medicationCoding, CODE_SYSTEM_HL7_HCPCS)?.code ??
    // Legacy coding system
    getCoding(medicationCoding, CODE_SYSTEM_HCPCS)?.code
  );
}

export function getAllHcpcsCodesFromInHouseMedication(medication: Medication): string[] {
  const resultCodes: string[] = [];
  medication.code?.coding?.forEach((coding) => {
    if (
      (coding.system === CODE_SYSTEM_HL7_HCPCS ||
        // Legacy coding system
        coding.system === CODE_SYSTEM_HCPCS) &&
      coding.code
    ) {
      resultCodes.push(coding.code);
    }
  });
  return resultCodes;
}

export function getAllCptCodesFromInHouseMedication(medication: Medication): string[] {
  const resultCodes: string[] = [];
  medication.code?.coding?.forEach((coding) => {
    if (coding.system === CODE_SYSTEM_CPT && coding.code) {
      resultCodes.push(coding.code);
    }
  });
  return resultCodes;
}

export function getDosageFromMA(
  medicationAdministration: MedicationAdministration
): { units: MedicationUnitOptions; dose: number } | undefined {
  const dose = medicationAdministration.dosage?.dose?.value;
  const units = medicationAdministration.dosage?.dose?.unit as MedicationUnitOptions;
  if (!dose || !units) return undefined;
  return {
    units,
    dose,
  };
}

/**
 * Grabs the interaction specific medispan id when available, otherwise falls back to the
 * dispensable drug id when available
 * @param medication
 * @returns
 */
export const getMediSpanIdForInteraction = (medication: Medication): string | undefined => {
  const medicationCoding = medication.code?.coding;
  if (!medicationCoding) return undefined;

  // context on both of these: MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS is there because
  // sometimes the MEDICATION_DISPENSABLE_DRUG_ID selected by end users isn't a valid medication
  // in the interactions database anymore. but it's the one they want to use because it's what
  // is on their shelf. So we should use the interaction id when available
  const maybeMedicationDispensableDrugId = medicationCoding.find(
    (c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID
  )?.code;
  const maybeMedicationInteractionDrugId = medicationCoding.find(
    (c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS
  )?.code;

  return maybeMedicationInteractionDrugId ?? maybeMedicationDispensableDrugId;
};
