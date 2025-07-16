import {
  CodeableConcept,
  DetectedIssue,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
} from 'fhir/r4b';
import {
  AllergyInteraction,
  CODE_SYSTEM_ACT_CODE_V3,
  createReference,
  DrugInteraction,
  getCreatedTheOrderProviderId,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_SYSTEM,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MedicationApplianceLocation,
  MedicationApplianceRoute,
  MedicationData,
  MedicationInteractions,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_MEDICATION_CODE,
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
  if (orderData.encounterId) resource.context = { reference: `Encounter/${orderData.encounterId}` };
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
  // todo: check if we should validate effectiveDateTime to add performer
  if (administeredProviderId && orderData.effectiveDateTime)
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

export function createMedicationRequest(
  data: MedicationData,
  interactions: MedicationInteractions | undefined,
  medication: Medication
): MedicationRequest {
  const detectedIssues = [
    ...(interactions?.drugInteractions?.map((interaction, index) =>
      createDrugInteractionIssue('drg-' + index, interaction)
    ) ?? []),
    ...(interactions?.allergyInteractions?.map((interaction, index) =>
      createAllergyInteractionIssue('algy-' + index, interaction)
    ) ?? []),
  ];
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${data.patient}` },
    encounter: data.encounterId ? { reference: `Encounter/${data.encounterId}` } : undefined,
    detectedIssue:
      detectedIssues.length > 0
        ? detectedIssues.map((detectedIssue) => ({
            reference: '#' + detectedIssue.id,
          }))
        : undefined,
    medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
    contained: [{ ...medication, id: IN_HOUSE_CONTAINED_MEDICATION_ID }, ...detectedIssues],
  };
}

function createDrugInteractionIssue(resourceId: string, interaction: DrugInteraction): DetectedIssue {
  return {
    resourceType: 'DetectedIssue',
    id: resourceId,
    status: 'registered',
    code: {
      coding: [
        {
          system: CODE_SYSTEM_ACT_CODE_V3,
          code: 'DRG',
        },
      ],
    },
    severity: interaction.severity,
    detail: interaction.message,
    mitigation: [
      {
        action: {
          coding: [
            {
              system: INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
              code: interaction.overrideReason,
              display: interaction.overrideReason,
            },
          ],
        },
      },
    ],
    evidence: interaction.drugs.map((drug) => {
      return {
        code: [
          {
            coding: [
              {
                system: MEDICATION_DISPENSABLE_DRUG_ID,
                code: drug.id,
                display: drug.name,
              },
            ],
          },
        ],
      };
    }),
  };
}

function createAllergyInteractionIssue(resourceId: string, interaction: AllergyInteraction): DetectedIssue {
  return {
    resourceType: 'DetectedIssue',
    id: resourceId,
    status: 'registered',
    code: {
      coding: [
        {
          system: CODE_SYSTEM_ACT_CODE_V3,
          code: 'ALGY',
        },
      ],
    },
    detail: interaction.message,
    mitigation: [
      {
        action: {
          coding: [
            {
              system: INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
              code: interaction.overrideReason,
              display: interaction.overrideReason,
            },
          ],
        },
      },
    ],
  };
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
