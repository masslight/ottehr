import { MedicationAdministration, MedicationStatement } from 'fhir/r4b';
import { ExtendedMedicationData } from './index';
import { createReference } from 'utils';
import {
  DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
  getCreatedTheOrderProviderId,
  IN_HOUSE_MEDICATION_STATEMENT_MEDICATION_SYSTEM,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_SYSTEM,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MedicationApplianceLocation,
  MedicationApplianceRoute,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
  TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
} from 'utils';

export function createMedicationAdministrationResource(
  data: ExtendedMedicationData,
  status: MedicationAdministration['status'],
  route: MedicationApplianceRoute,
  location: MedicationApplianceLocation | undefined,
  existedResource?: MedicationAdministration
): MedicationAdministration {
  // we can set existed resource as base for new resource
  const resource: MedicationAdministration = existedResource
    ? { ...existedResource }
    : {
        resourceType: 'MedicationAdministration',
        subject: { reference: `Patient/${data.patient}` },
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
  if (data.patient) resource.subject = { reference: `Patient/${data.patient}` };
  if (data.encounter) resource.context = { reference: `Encounter/${data.encounter}` };
  if (data.providerCreatedTheOrder) {
    resource.performer = [
      {
        actor: { reference: `Practitioner/${data.providerCreatedTheOrder}` },
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
  if (data.orderDateTimeCreated) resource.effectiveDateTime = data.orderDateTimeCreated ?? undefined;
  if (data.medicationCopyId) resource.medicationReference = { reference: `Medication/${data.medicationCopyId}` };
  if (data.dose && data.units) {
    resource.dosage = {
      text: data.instructions,
      dose: {
        unit: data.units,
        value: data.dose,
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

  if (data.reason) {
    if (!resource.note) resource.note = [];
    resource.note.push({
      authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
      text: data.reason,
    });
  }
  if (data.otherReason) {
    if (!resource.note) resource.note = [];
    resource.note.push({
      authorString: MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
      text: data.otherReason,
    });
  }
  if (data.administeredProvider && data.dateGiven && data.timeGiven)
    resource.performer?.push({
      actor: { reference: `Practitioner/${data.administeredProvider}` },
      function: {
        coding: [
          {
            system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
            code: PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
          },
        ],
      },
      extension: [
        {
          url: DATE_OF_MEDICATION_ADMINISTERED_SYSTEM,
          valueDate: data.dateGiven,
        },
        {
          url: TIME_OF_MEDICATION_ADMINISTERED_SYSTEM,
          valueTime: data.timeGiven,
        },
      ],
    });
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
  if (data.associatedDx) resource.reasonReference = [{ reference: `Condition/${data.associatedDx}` }];
  return resource;
}

export function createMedicationStatementResource(
  medicationAdministration: MedicationAdministration,
  medicationCopyId: string,
  medicationCopyName: string
): MedicationStatement {
  return {
    resourceType: 'MedicationStatement',
    status: 'active',
    partOf: [createReference(medicationAdministration)],
    medicationCodeableConcept: {
      coding: [
        {
          // i think this is not the right code for this particular statement
          system: IN_HOUSE_MEDICATION_STATEMENT_MEDICATION_SYSTEM,
          code: medicationCopyId,
          display: medicationCopyName,
        },
      ],
    },
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
  };
}
