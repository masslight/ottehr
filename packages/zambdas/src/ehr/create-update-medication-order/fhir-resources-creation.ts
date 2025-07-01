import { CodeableConcept, Medication, MedicationAdministration, MedicationStatement } from 'fhir/r4b';
import {
  createReference,
  DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
  getCreatedTheOrderProviderId,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_SYSTEM,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MedicationApplianceLocation,
  MedicationApplianceRoute,
  MedicationData,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
  TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
} from 'utils';
import { fillMeta } from '../../shared';

export interface MedicationAdministrationData {
  orderData: MedicationData;
  status: MedicationAdministration['status'];
  route: MedicationApplianceRoute;
  location?: MedicationApplianceLocation;
  createdProviderId?: string;
  administeredProviderId?: string;
  existedMA?: MedicationAdministration;
  dateTimeCreated?: string;
  medicationResource?: Medication;
}

export function createMedicationAdministrationResource(data: MedicationAdministrationData): MedicationAdministration {
  const {
    orderData,
    status,
    route,
    location,
    createdProviderId,
    administeredProviderId,
    existedMA,
    dateTimeCreated,
    medicationResource,
  } = data;
  // we can set existed resource as base for new resource
  const resource: MedicationAdministration = existedMA
    ? { ...existedMA }
    : {
        resourceType: 'MedicationAdministration',
        subject: { reference: `Patient/${orderData.patient}` },
        medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
        status,
      };

  // and here we updating/creating all fields that we need
  resource.meta = {
    tag: [
      {
        system: MEDICATION_ADMINISTRATION_CSS_RESOURCE_SYSTEM,
        code: MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
      },
    ],
  };
  if (orderData.patient) resource.subject = { reference: `Patient/${orderData.patient}` };
  if (orderData.encounter) resource.context = { reference: `Encounter/${orderData.encounter}` };
  if (createdProviderId) {
    resource.performer = [
      {
        actor: { reference: `Practitioner/${createdProviderId}` },
        function: {
          coding: [
            {
              system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
              code: PRACTITIONER_ORDERED_MEDICATION_CODE,
            },
          ],
        },
      },
    ];
  }
  if (dateTimeCreated) resource.effectiveDateTime = dateTimeCreated; // todo: check if this is correct, effectiveDateTime is not date of creation, it's date of administration
  if (medicationResource) {
    resource.contained = [{ ...medicationResource, id: IN_HOUSE_CONTAINED_MEDICATION_ID }];
  }
  if (orderData.dose && orderData.units) {
    resource.dosage = {
      dose: {
        unit: orderData.units,
        value: orderData.dose,
        system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
      },
      route: {
        coding: [
          {
            code: route.code,
            system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
            display: route.display,
          },
        ],
      },
    };
  }

  if (orderData.reason) {
    if (!resource.note) resource.note = [];
    resource.note.push({
      authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
      text: orderData.reason,
    });
  }
  if (orderData.otherReason) {
    if (!resource.note) resource.note = [];
    resource.note.push({
      authorString: MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
      text: orderData.otherReason,
    });
  }
  if (administeredProviderId && orderData.dateGiven && orderData.timeGiven)
    resource.performer?.push({
      actor: { reference: `Practitioner/${administeredProviderId}` },
      function: {
        coding: [
          {
            system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
            code: PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
          },
        ],
      },

      // TODO: [TIMEZONE] Current approach loses timezone information.
      // Replace separate date/time fields with effectiveDateTime or add timezone extension.
      // Options:
      // 1) Use ISO effectiveDateTime instead of separate date/time extensions
      //    [good if medication timezone always corresponds to encounter timezone]
      // 2) Add timezone extension + UI selector if we need to handle
      //    cases where patient takes medication in different timezone than encounter timezone
      // 3) [current variant]: dateGiven is used without timeGiven as effective date,
      //    because using date without time is possible without timezone in FHIR
      extension: [
        {
          url: DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
          valueDate: orderData.dateGiven,
        },
        {
          url: TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
          valueTime: orderData.timeGiven,
        },
      ],
    });
  if (orderData.instructions && resource.dosage) resource.dosage.text = orderData.instructions;
  if (location && resource.dosage)
    resource.dosage.site = {
      coding: [
        {
          system: location.system,
          code: location.code,
          display: location.display,
        },
      ],
    };
  if (orderData.associatedDx) resource.reasonReference = [{ reference: `Condition/${orderData.associatedDx}` }];
  return resource;
}

export function createMedicationStatementResource(
  medicationAdministration: MedicationAdministration,
  medicationCodeableConcept: CodeableConcept,
  options: { effectiveDateTime?: string | undefined } = {}
): MedicationStatement {
  return {
    resourceType: 'MedicationStatement',
    status: 'active',
    partOf: [createReference(medicationAdministration)],
    medicationCodeableConcept,
    dosage: [
      {
        text: medicationAdministration.dosage?.text,
        doseAndRate: [
          {
            doseQuantity: medicationAdministration.dosage?.dose,
          },
        ],
        route: medicationAdministration.dosage?.route,
        site: medicationAdministration.dosage?.site,
      },
    ],
    subject: medicationAdministration.subject,
    informationSource: { reference: 'Practitioner/' + getCreatedTheOrderProviderId(medicationAdministration) },
    ...(options.effectiveDateTime && { effectiveDateTime: options.effectiveDateTime }),
    meta: fillMeta('in-house-medication', 'in-house-medication'),
  };
}
