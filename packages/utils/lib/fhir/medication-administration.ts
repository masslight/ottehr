import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
  ExtendedMedicationDataForResponse,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_APPLIANCE_LOCATION_SYSTEM,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
  MedicationApplianceLocation,
  medicationApplianceLocations,
  MedicationApplianceRoute,
  medicationApplianceRoutes,
  MedicationData,
  MedicationOrderStatusesType,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
  TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
  UpdateMedicationOrderInput,
} from '../types';

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

export function getMedicationName(medication: Medication): string | undefined {
  return medication.identifier?.find((idn) => idn.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value;
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
    ?.find(
      (performer) => performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ORDERED_MEDICATION_CODE)
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

export function getLocationCodeFromMedicationAdministration(
  medicationAdministration: MedicationAdministration
): string | undefined {
  return medicationAdministration.dosage?.site?.coding?.find(
    (coding) => coding.system === MEDICATION_APPLIANCE_LOCATION_SYSTEM
  )?.code;
}

export function getProviderIdAndDateMedicationWasAdministered(medicationAdministration: MedicationAdministration):
  | {
      administeredProviderId: string;
      dateAdministered: string;
      timeAdministered: string;
    }
  | undefined {
  const administeredPerformer = medicationAdministration.performer?.find(
    (performer) =>
      performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ADMINISTERED_MEDICATION_CODE)
  );
  const administeredProviderId = administeredPerformer?.actor.reference?.replace('Practitioner/', '');
  const dateAdministered = administeredPerformer?.extension?.find(
    (ext) => ext.url === DATE_OF_MEDICATION_ADMINISTERED_SYSTEM
  )?.valueDate;
  const timeAdministered = administeredPerformer?.extension?.find(
    (ext) => ext.url === TIME_OF_MEDICATION_ADMINISTERED_SYSTEM
  )?.valueTime;
  if (administeredProviderId && dateAdministered && timeAdministered)
    return { administeredProviderId, dateAdministered, timeAdministered };
  else return undefined;
}

export function getCreatedTheOrderProviderId(medicationAdministration: MedicationAdministration): string | undefined {
  return medicationAdministration.performer
    ?.find(
      (performer) => performer.function?.coding?.find((coding) => coding.code === PRACTITIONER_ORDERED_MEDICATION_CODE)
    )
    ?.actor.reference?.replace('Practitioner/', '');
}

export const searchRouteByCode = (
  code: keyof typeof medicationApplianceRoutes
): MedicationApplianceRoute | undefined => {
  return Object.values(medicationApplianceRoutes).find((route) => route.code === code);
};

export function searchMedicationLocation(code: string): MedicationApplianceLocation | undefined {
  return medicationApplianceLocations.find((location) => location.code === code);
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
    expDate: medicationExtendedData.expDate,
    dateGiven: medicationExtendedData.dateGiven,
    timeGiven: medicationExtendedData.timeGiven,
  };
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
  id && (request.orderId = id);
  newStatus && (request.newStatus = newStatus);
  orderData && (request.orderData = orderData as MedicationData);
  return request;
};
