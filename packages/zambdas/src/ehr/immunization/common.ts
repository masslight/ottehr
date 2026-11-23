import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Organization, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { codeableConcept, getCoding, sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import { searchMedicationLocation, searchRouteByCode } from 'utils/lib/fhir/medication-administration';
import { getFullName } from 'utils/lib/fhir/patient';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
  MVX_CODE_SYSTEM_URL,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import {
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { CvxVaccine } from 'utils/lib/types/data/immunization/vaccine-codes';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';

export const CONTAINED_MEDICATION_ID = 'medication';
export const CONTAINED_EMERGENCY_CONTACT_ID = 'emergencyContact';
export const CONTAINED_MANUFACTURER_ORG_ID = 'manufacturer-org';
export const IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL = ottehrExtensionUrl(
  'immunization-order-created-date-time'
);
export const IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL = ottehrExtensionUrl('immunization-order-medication-id');
// Administered date/time and VIS flag entered at order time; effectiveDateTime holds the creation time until administration
export const IMMUNIZATION_ORDER_ADMINISTERED_DATETIME_EXTENSION_URL = ottehrExtensionUrl(
  'immunization-order-administered-date-time'
);
export const IMMUNIZATION_ORDER_VIS_GIVEN_EXTENSION_URL = ottehrExtensionUrl('immunization-order-vis-given');

export async function updateOrderDetails(
  medicationAdministration: MedicationAdministration,
  orderDetails: InputImmunizationOrderDetails,
  oystehr: Oystehr
): Promise<void> {
  const { medication, dose, units, orderedProvider, route, location, instructions, associatedDx, manufacturer } =
    orderDetails;

  const containedMedication = getContainedMedication(medicationAdministration);
  const currentMedicationId = containedMedication?.extension?.find(
    (e) => e.url === IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL
  )?.valueString;

  // An order placed before the vaccine list keeps its vaccine (a copy of a retired config Medication) until
  // the user picks another one, which has to come from the list.
  if (medication.id !== currentMedicationId) {
    const vaccine = getCvxVaccine(medication.id);
    if (!vaccine) {
      throw INVALID_INPUT_ERROR(`Vaccine "${medication.name ?? medication.id}" is not in the vaccine list`);
    }
    medicationAdministration.medicationReference = { reference: '#' + CONTAINED_MEDICATION_ID };
    medicationAdministration.contained = [createOrderVaccineMedication(vaccine)];
  }

  const containedMed = getContainedMedication(medicationAdministration);
  const manufacturerName = manufacturer?.trim();
  if (containedMed) {
    if (manufacturerName) {
      const manufacturerOrg: Organization = {
        resourceType: 'Organization',
        id: CONTAINED_MANUFACTURER_ORG_ID,
        name: manufacturerName,
      };
      medicationAdministration.contained = [
        ...(medicationAdministration.contained ?? []).filter((r) => r.id !== CONTAINED_MANUFACTURER_ORG_ID),
        manufacturerOrg,
      ];
      containedMed.manufacturer = { reference: '#' + CONTAINED_MANUFACTURER_ORG_ID };
    } else {
      medicationAdministration.contained = (medicationAdministration.contained ?? []).filter(
        (r) => r.id !== CONTAINED_MANUFACTURER_ORG_ID
      );
      containedMed.manufacturer = undefined;
    }
  }

  if (associatedDx?.resourceId) {
    medicationAdministration.reasonReference = [
      { reference: `Condition/${associatedDx.resourceId}`, display: associatedDx.display },
    ];
  } else {
    medicationAdministration.reasonReference = undefined;
  }

  const routeCoding = route ? searchRouteByCode(route) : undefined;
  const locationCoding = location ? searchMedicationLocation(location.code, location.name) : undefined;
  medicationAdministration.dosage = {
    dose: {
      unit: units,
      value: parseFloat(dose),
      system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
    },
    route: routeCoding
      ? {
          coding: [
            {
              code: routeCoding.code,
              system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
              display: routeCoding.display,
            },
          ],
        }
      : undefined,
    site: locationCoding
      ? {
          coding: [
            {
              system: locationCoding.system,
              code: locationCoding.code,
              display: locationCoding.name,
            },
          ],
        }
      : undefined,
    text: instructions?.trim() || undefined,
  };

  const orderedProviderResource = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: orderedProvider.id,
  });

  medicationAdministration.performer = [
    ...(medicationAdministration.performer ?? []).filter(
      (performer) =>
        getCoding(performer.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code !==
        PRACTITIONER_ORDERED_BY_MEDICATION_CODE
    ),
    {
      actor: {
        reference: `Practitioner/${orderedProvider.id}`,
        display: getFullName(orderedProviderResource),
      },
      function: {
        coding: [
          {
            system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
            code: PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
          },
        ],
      },
    },
  ];
}

/** The order's own Medication for a vaccine from the list: its name, its CVX code and the id the order form reads back. */
export function createOrderVaccineMedication(vaccine: CvxVaccine): Medication {
  return {
    resourceType: 'Medication',
    id: CONTAINED_MEDICATION_ID,
    identifier: [
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: vaccine.name },
    ],
    code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: vaccine.cvx, display: vaccine.fullName }] },
    extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: vaccine.cvx }],
  };
}

/**
 * The CVX code recorded with an order vaccine's administration codes. A vaccine from the vaccine list has its CVX
 * code as its id, and that is the code. A vaccine ordered before the list existed has no code of its own, so it
 * keeps the one already recorded with it, if any.
 */
export function getOrderVaccineCvx(medication: Medication): string | undefined {
  const vaccineId = medication.extension?.find((e) => e.url === IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL)
    ?.valueString;
  const listedVaccine = getCvxVaccine(vaccineId);
  if (listedVaccine) return listedVaccine.cvx;
  for (const extension of medication.extension ?? []) {
    if (extension.url !== VACCINE_ADMINISTRATION_CODES_EXTENSION_URL) continue;
    const recorded = getCoding(extension.valueCodeableConcept, CVX_CODE_SYSTEM_URL)?.code;
    if (recorded) return recorded;
  }
  return undefined;
}

export function updateVaccineMedicationDetails(
  medication: Medication,
  administrationDetails: InputImmunizationOrderAdministrationDetails
): void {
  const { lot, expDate, mvx, ndc, cptCodes, visGivenDate } = administrationDetails;
  // read before the codes are rewritten: an order placed before the vaccine list keeps its recorded code
  const cvx = getOrderVaccineCvx(medication);
  medication.batch = lot || expDate ? { lotNumber: lot || undefined, expirationDate: expDate || undefined } : undefined;
  medication.extension = (medication.extension ?? []).filter(
    (ext) =>
      ext.url !== VACCINE_ADMINISTRATION_CODES_EXTENSION_URL &&
      ext.url !== VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL
  );
  for (const [code, system] of [
    [mvx, MVX_CODE_SYSTEM_URL],
    [cvx, CVX_CODE_SYSTEM_URL],
    [ndc, CODE_SYSTEM_NDC],
  ] as const) {
    if (code) {
      medication.extension.push({
        url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
        valueCodeableConcept: codeableConcept(code, system),
      });
    }
  }
  for (const cptCode of cptCodes ?? []) {
    medication.extension.push({
      url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
      valueCodeableConcept: {
        coding: [{ code: cptCode.code, system: CODE_SYSTEM_CPT, display: cptCode.display }],
      },
    });
  }
  if (visGivenDate) {
    medication.extension.push({ url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL, valueDate: visGivenDate });
  }
}

export function applyOrderAdministrationDetails(
  medicationAdministration: MedicationAdministration,
  administrationDetails: InputImmunizationOrderAdministrationDetails | undefined
): void {
  if (!administrationDetails) return;
  const medication = getContainedMedication(medicationAdministration);
  if (!medication) throw new Error('Contained Medication is missing');
  updateVaccineMedicationDetails(medication, administrationDetails);

  const { administeredDateTime, visGiven } = administrationDetails;
  medicationAdministration.extension = [
    ...(medicationAdministration.extension ?? []).filter(
      (ext) =>
        ext.url !== IMMUNIZATION_ORDER_ADMINISTERED_DATETIME_EXTENSION_URL &&
        ext.url !== IMMUNIZATION_ORDER_VIS_GIVEN_EXTENSION_URL
    ),
    ...(administeredDateTime
      ? [{ url: IMMUNIZATION_ORDER_ADMINISTERED_DATETIME_EXTENSION_URL, valueDateTime: administeredDateTime }]
      : []),
    ...(visGiven ? [{ url: IMMUNIZATION_ORDER_VIS_GIVEN_EXTENSION_URL, valueBoolean: true }] : []),
  ];
}

// Validates dates and normalises lot and codes in place
export function validateAdministrationDetailsValues(
  administrationDetails: InputImmunizationOrderAdministrationDetails | undefined
): void {
  if (!administrationDetails) return;
  for (const [field, label] of [
    ['expDate', 'expiration date'],
    ['administeredDateTime', 'administered date'],
    ['visGivenDate', 'VIS given date'],
  ] as const) {
    const value = administrationDetails[field];
    if (!value) continue;
    const dt = DateTime.fromISO(value);
    if (!dt.isValid || dt.year < 1900) {
      throw INVALID_INPUT_ERROR(`Invalid ${label}, "${value}" is not a valid date`);
    }
  }
  for (const field of ['mvx', 'ndc'] as const) {
    const value = administrationDetails[field];
    if (value) administrationDetails[field] = sanitizeStringForFhirCode(value) || undefined;
  }
  if (administrationDetails.lot) administrationDetails.lot = administrationDetails.lot.trim() || undefined;
}

export function validateOrderDetails(orderDetails: any): string[] {
  const { medication, dose, units, orderedProvider } = orderDetails;
  const missingFields: string[] = [];
  if (!medication?.id) missingFields.push('orderDetails.medication.id');
  if (!dose) missingFields.push('orderDetails.dose');
  if (!units) missingFields.push('orderDetails.units');
  if (!orderedProvider?.id) missingFields.push('orderDetails.orderedProvider.id');
  return missingFields;
}

export function getContainedMedication(medicationAdministration: MedicationAdministration): Medication | undefined {
  return medicationAdministration.contained?.find((resource) => resource.id === CONTAINED_MEDICATION_ID) as
    | Medication
    | undefined;
}
