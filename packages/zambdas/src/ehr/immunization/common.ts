import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  getCoding,
  InputOrderDetails,
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
export const IMMUNIZATION_ORDER_CREATED_DATE_EXTENSION_URL = ottehrExtensionUrl('immunization-order-created-date');

export async function updateOrderDetails(
  medicationAdministration: MedicationAdministration,
  orderDetails: InputOrderDetails,
  oystehr: Oystehr
): Promise<void> {
  const { medication: medicationData, dose, units, orderedProvider, route, location, instructions } = orderDetails;

  if (medicationData.id !== CONTAINED_MEDICATION_ID) {
    const medication = await oystehr.fhir.get<Medication>({
      resourceType: 'Medication',
      id: medicationData.id,
    });
    const medicationLocalCopy = createMedicationCopy(medication, {});
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

  medicationAdministration.performer = [
    ...(medicationAdministration.performer ?? []).filter(
      (performer) =>
        getCoding(performer.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code !==
        PRACTITIONER_ORDERED_BY_MEDICATION_CODE
    ),
    {
      actor: {
        reference: `Practitioner/${orderedProvider.id}`,
        display: orderedProvider.name,
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
  const { medication, dose, units, orderedProvider } = orderDetails;
  const missingFields: string[] = [];
  if (!medication.id) missingFields.push('orderDetails.medication.id');
  if (!medication.name) missingFields.push('orderDetails.medication.name');
  if (!dose) missingFields.push('orderDetails.dose');
  if (!units) missingFields.push('orderDetails.units');
  if (!orderedProvider.id) missingFields.push('orderDetails.orderedProvider.id');
  if (!orderedProvider.name) missingFields.push('orderDetails.orderedProvider.name');
  return missingFields;
}

export function getContainedMedication(medicationAdministration: MedicationAdministration): Medication | undefined {
  return medicationAdministration.contained?.find((resource) => resource.id === CONTAINED_MEDICATION_ID) as
    | Medication
    | undefined;
}
