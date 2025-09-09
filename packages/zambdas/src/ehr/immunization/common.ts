import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Practitioner } from 'fhir/r4b';
import {
  getCoding,
  getFullName,
  InputImmunizationOrderDetails,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  ottehrExtensionUrl,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import { createMedicationCopy } from '../create-update-medication-order/helpers';

export const CONTAINED_MEDICATION_ID = 'medication';
export const CONTAINED_EMERGENCY_CONTACT_ID = 'emergencyContact';
export const MVX_CODE_SYSTEM_URL = 'http://hl7.org/fhir/sid/mvx';
export const CVX_CODE_SYSTEM_URL = 'http://hl7.org/fhir/sid/cvx';
export const VACCINE_ADMINISTRATION_CODES_EXTENSION_URL = ottehrExtensionUrl('vaccine-administration-codes');
export const VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL = ottehrExtensionUrl('vaccine-administration-vis-date');
export const IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL = ottehrExtensionUrl(
  'immunization-order-created-date-time'
);
export const IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL = ottehrExtensionUrl('immunization-order-medication-id');

export async function updateOrderDetails(
  medicationAdministration: MedicationAdministration,
  orderDetails: InputImmunizationOrderDetails,
  oystehr: Oystehr
): Promise<void> {
  const { medicationId, dose, units, orderedProviderId, route, location, instructions } = orderDetails;

  if (medicationId !== CONTAINED_MEDICATION_ID) {
    const medication = await oystehr.fhir.get<Medication>({
      resourceType: 'Medication',
      id: medicationId,
    });
    const medicationLocalCopy = createMedicationCopy(medication, {});
    if (medicationLocalCopy.extension == null) {
      medicationLocalCopy.extension = [];
    }
    medicationLocalCopy.extension.push({
      url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
      valueString: medicationId,
    });
    medicationAdministration.medicationReference = { reference: '#' + CONTAINED_MEDICATION_ID };
    medicationAdministration.contained = [
      {
        ...medicationLocalCopy,
        id: CONTAINED_MEDICATION_ID,
      },
    ];
  }

  const routeCoding = route ? searchRouteByCode(route) : undefined;
  const locationCoding = location ? searchMedicationLocation(location) : undefined;
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
              display: locationCoding.display,
            },
          ],
        }
      : undefined,
    text: instructions,
  };

  const orderedProvider = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: orderedProviderId,
  });

  medicationAdministration.performer = [
    ...(medicationAdministration.performer ?? []).filter(
      (performer) =>
        getCoding(performer.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code !==
        PRACTITIONER_ORDERED_BY_MEDICATION_CODE
    ),
    {
      actor: {
        reference: `Practitioner/${orderedProviderId}`,
        display: getFullName(orderedProvider),
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

export function validateOrderDetails(orderDetails: any): string[] {
  const { medicationId, dose, units, orderedProviderId } = orderDetails;
  const missingFields: string[] = [];
  if (!medicationId) missingFields.push('orderDetails.medicationId');
  if (!dose) missingFields.push('orderDetails.dose');
  if (!units) missingFields.push('orderDetails.units');
  if (!orderedProviderId) missingFields.push('orderDetails.orderedProviderId');
  return missingFields;
}

export function getContainedMedication(medicationAdministration: MedicationAdministration): Medication | undefined {
  return medicationAdministration.contained?.find((resource) => resource.id === CONTAINED_MEDICATION_ID) as
    | Medication
    | undefined;
}
