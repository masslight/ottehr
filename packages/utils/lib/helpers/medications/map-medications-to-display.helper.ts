import { Medication, PrescribedMedication } from '../../../../zambdas/src/shared/pdf/types';
import { searchRouteByCode } from '../../fhir';
import { LOCATION_CONFIG } from '../../ottehr-config';
import { ExtendedMedicationDataForResponse, PrescribedMedicationDTO } from '../../types';
import { formatDateTimeToZone } from '../../utils';

export const mapMedicationsToDisplay = (
  medications: ExtendedMedicationDataForResponse[],
  timezone?: string
): Medication[] => {
  return medications.map((med): Medication => {
    const { medicationName: name, dose, units, route: routeCode, dateTimeCreated } = med;
    const date = formatDateTimeToZone(dateTimeCreated, timezone ?? LOCATION_CONFIG.defaultTimezone);
    const route = searchRouteByCode(routeCode)?.display;

    return {
      name,
      dose: `${dose} ${units}`,
      route,
      date,
    };
  });
};

export const mapErxMedicationsToDisplay = (
  medications: PrescribedMedicationDTO[],
  timezone?: string
): PrescribedMedication[] => {
  return medications.map((med) => {
    const { name, added, instructions } = med;
    const date = formatDateTimeToZone(added, timezone ?? LOCATION_CONFIG.defaultTimezone);

    return {
      name,
      instructions,
      date,
    };
  });
};
