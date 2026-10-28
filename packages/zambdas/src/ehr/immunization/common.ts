import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Organization, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { codeableConcept, getCoding } from 'utils/lib/fhir/helpers';
import { searchMedicationLocation, searchRouteByCode } from 'utils/lib/fhir/medication-administration';
import { getFullName } from 'utils/lib/fhir/patient';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  CVX_CODE_SYSTEM_URL,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MVX_CODE_SYSTEM_URL,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import {
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { createMedicationCopy } from '../create-update-medication-order/helpers';

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

  if (medication.id !== currentMedicationId) {
    const medicationResource = await oystehr.fhir.get<Medication>({
      resourceType: 'Medication',
      id: medication.id,
    });
    const medicationLocalCopy = createMedicationCopy(medicationResource, {});
    if (medicationLocalCopy.extension == null) {
      medicationLocalCopy.extension = [];
    }
    medicationLocalCopy.extension.push({
      url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
      valueString: medication.id,
    });
    medicationAdministration.medicationReference = { reference: '#' + CONTAINED_MEDICATION_ID };
    medicationAdministration.contained = [
      {
        ...medicationLocalCopy,
        id: CONTAINED_MEDICATION_ID,
      },
    ];
  }

  const containedMed = getContainedMedication(medicationAdministration);
  if (containedMed) {
    if (manufacturer) {
      const manufacturerOrg: Organization = {
        resourceType: 'Organization',
        id: CONTAINED_MANUFACTURER_ORG_ID,
        name: manufacturer,
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
    text: instructions,
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

export function updateVaccineMedicationDetails(
  medication: Medication,
  administrationDetails: InputImmunizationOrderAdministrationDetails
): void {
  const { lot, expDate, mvx, cvx, ndc, cptCodes, visGivenDate } = administrationDetails;
  medication.batch = lot || expDate ? { lotNumber: lot, expirationDate: expDate } : undefined;
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

// Validates dates and trims codes in place
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
  for (const field of ['mvx', 'cvx', 'ndc'] as const) {
    const value = administrationDetails[field];
    if (value) administrationDetails[field] = value.trim();
  }
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
