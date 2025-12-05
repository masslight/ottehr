import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Practitioner } from 'fhir/r4b';
import {
  getCoding,
  getFullName,
  InputImmunizationOrderDetails,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { createMedicationCopy } from '../create-update-medication-order/helpers';

export const CONTAINED_MEDICATION_ID = 'medication';
export const CONTAINED_EMERGENCY_CONTACT_ID = 'emergencyContact';
export const IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL = ottehrExtensionUrl(
  'immunization-order-created-date-time'
);
export const IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL = ottehrExtensionUrl('immunization-order-medication-id');

export async function updateOrderDetails(
  medicationAdministration: MedicationAdministration,
  orderDetails: InputImmunizationOrderDetails,
  oystehr: Oystehr
): Promise<void> {
  const { medication, dose, units, orderedProvider, route, location, instructions } = orderDetails;

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
