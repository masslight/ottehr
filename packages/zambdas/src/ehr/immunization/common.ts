import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  getCoding,
  ImmunizationOrderDetails,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import { createMedicationCopy } from '../create-update-medication-order/helpers';

const CONTAINED_MEDICATION_ID = 'medication';

export async function updateOrderDetails(
  medicationAdministration: MedicationAdministration,
  orderDetails: ImmunizationOrderDetails,
  oystehr: Oystehr
): Promise<void> {
  const { medicationId, dose, units, orderedProviderId, route, location, instructions } = orderDetails;

  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationId,
  });
  const medicationLocalCopy = createMedicationCopy(medication, {});
  medicationAdministration.medicationReference = { reference: '#' + CONTAINED_MEDICATION_ID };
  medicationAdministration.contained = [
    {
      ...medicationLocalCopy,
      id: CONTAINED_MEDICATION_ID,
    },
  ];

  const routeCoding = route ? searchRouteByCode(route) : undefined;
  const locationCoding = location ? searchMedicationLocation(location) : undefined;
  medicationAdministration.dosage = {
    dose: {
      unit: units,
      value: dose,
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
      actor: { reference: `Practitioner/${orderedProviderId}` },
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
