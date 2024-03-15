import { FhirClient } from '@zapehr/sdk';
import {
  AllergyIntolerance,
  Condition,
  FhirResource,
  MedicationAdministration,
  Meta,
  Observation,
  Procedure,
  Resource,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  AllergyDTO,
  ChartDataFields,
  EXAM_OBSERVATION_META_SYSTEM,
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  FreeTextNoteDTO,
  MedicalConditionDTO,
  MedicationDTO,
  PRIVATE_EXTENSION_BASE_URL,
  ProcedureDTO,
  SNOMEDCodeConceptInterface,
} from '../../types';
import { HpiAndMedicalHistoryTabFieldsNames } from '../../types/api/chart-data/hpi-medical-history-fields';

const getMetaWFieldName = (fieldName: HpiAndMedicalHistoryTabFieldsNames): Meta => {
  return fillMeta(fieldName, fieldName);
};

const fillMeta = (code: string, system: string): Meta => ({
  tag: [
    {
      code: code,
      system: `${PRIVATE_EXTENSION_BASE_URL}/${system}`,
    },
  ],
});

export function makeConditionResource(
  encounterId: string,
  patientId: string,
  data: MedicalConditionDTO | FreeTextNoteDTO,
  fieldName: HpiAndMedicalHistoryTabFieldsNames,
): Condition {
  return {
    id: data.resourceId,
    resourceType: 'Condition',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    note:
      (data as MedicalConditionDTO).description || (data as FreeTextNoteDTO).text
        ? [{ text: (data as MedicalConditionDTO).description || (data as FreeTextNoteDTO).text || '' }]
        : [],
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeConditionDTO(condition: Condition): MedicalConditionDTO {
  return {
    resourceId: condition.id,
    description: condition.note?.[0]?.text || '',
  };
}

export function makeAllergyResource(
  encounterId: string,
  patientId: string,
  data: AllergyDTO,
  fieldName: HpiAndMedicalHistoryTabFieldsNames,
): AllergyIntolerance {
  const allergyType = data.type !== 'food' && data.type !== 'medication' ? undefined : data.type;
  return {
    id: data.resourceId,
    resourceType: 'AllergyIntolerance',
    patient: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    category: allergyType ? [allergyType] : undefined,
    note: [{ text: `${data.agentOrSubstance}` }],
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeAllergyDTO(allergy: AllergyIntolerance): AllergyDTO {
  const allergyDTOType =
    (allergy.category?.[0] &&
      (allergy.category[0] !== 'food' && allergy.category[0] !== 'medication' ? 'other' : allergy.category[0])) ??
    'other';
  return {
    resourceId: allergy.id,
    type: allergyDTOType,
    agentOrSubstance: allergy.note?.[0].text,
  };
}

export function makeMedicationResource(
  encounterId: string,
  patientId: string,
  data: MedicationDTO,
  fieldName: HpiAndMedicalHistoryTabFieldsNames,
): MedicationAdministration {
  return {
    id: data.resourceId,
    resourceType: 'MedicationAdministration',
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    status: 'in-progress',
    meta: getMetaWFieldName(fieldName),
    medicationCodeableConcept: {
      coding: [
        {
          system: 'medication',
          code: data.name,
        },
      ],
    },
    effectiveDateTime: DateTime.utc().toISO()!,
  };
}

export function makeMedicationDTO(medication: MedicationAdministration): MedicationDTO {
  return {
    resourceId: medication.id,
    name: medication.medicationCodeableConcept?.coding?.[0].code,
  };
}

export function makeProcedureResource(
  encounterId: string,
  patientId: string,
  data: FreeTextNoteDTO | ProcedureDTO,
  fieldName: HpiAndMedicalHistoryTabFieldsNames,
): Procedure {
  const nameOrText = (data as ProcedureDTO).name || (data as FreeTextNoteDTO).text || '';
  return {
    id: data.resourceId,
    resourceType: 'Procedure',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'completed',
    note: nameOrText ? [{ text: nameOrText }] : undefined,
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeProcedureDTO(procedure: Procedure): ProcedureDTO {
  return {
    resourceId: procedure.id,
    name: procedure.note?.[0]?.text,
  };
}

export function makeObservationResource(
  encounterId: string,
  patientId: string,
  data: FreeTextNoteDTO,
  fieldName: HpiAndMedicalHistoryTabFieldsNames,
): Observation {
  return {
    id: data.resourceId,
    resourceType: 'Observation',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'final',
    code: { text: data.text || 'unknown' },
    note: data.text ? [{ text: `${data.text}` }] : [],
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeFreeTextNoteDTO(resource: Procedure | Observation): FreeTextNoteDTO {
  return {
    resourceId: resource.id,
    text: resource.note?.[0]?.text || '',
  };
}

export function makeExamObservationResource(
  encounterId: string,
  patientId: string,
  data: ExamObservationDTO,
  snomedCodes: SNOMEDCodeConceptInterface,
): Observation {
  return {
    resourceType: 'Observation',
    id: data.resourceId,
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'final',
    valueBoolean: typeof data.value === 'boolean' ? Boolean(data.value) : undefined,
    note: data.note ? [{ text: data.note }] : undefined,
    bodySite: snomedCodes.bodySite,
    code: snomedCodes.code,
    meta: fillMeta(data.field, EXAM_OBSERVATION_META_SYSTEM),
  };
}

export function makeExamObservationDTO(observation: Observation): ExamObservationDTO {
  return {
    resourceId: observation.id,
    field: observation.meta?.tag?.[0].code as ExamFieldsNames | ExamCardsNames,
    note: observation.note?.[0].text,
    value: observation.valueBoolean,
  };
}

export async function saveOrUpdateResource<Savable extends Resource>(
  resource: Savable,
  fhirClient: FhirClient,
): Promise<Savable> {
  if (resource.id === undefined) return fhirClient.createResource(resource);
  return fhirClient.updateResource(resource);
}

const chartDataResourceHasMetaTagByCode = (
  resource: Resource,
  metaTagCode?: HpiAndMedicalHistoryTabFieldsNames,
): boolean => (metaTagCode ? Boolean(resource?.meta?.tag?.find((tag) => tag.code === metaTagCode)) : true);

export const chartDataResourceHasMetaTagBySystem = (resource: Resource, metaTagSystem?: string): boolean =>
  metaTagSystem ? Boolean(resource?.meta?.tag?.find((tag) => tag.system === metaTagSystem)) : true;

export const mapResourceToChartDataFields = (data: ChartDataFields, resource: FhirResource): ChartDataFields => {
  if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'medical-condition')) {
    data.conditions?.push(makeConditionDTO(resource));
  } else if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'chief-complaint')) {
    data.chiefComplaint = makeConditionDTO(resource);
  } else if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'ros')) {
    data.ros = makeConditionDTO(resource);
  } else if (
    resource?.resourceType === 'AllergyIntolerance' &&
    chartDataResourceHasMetaTagByCode(resource, 'known-allergy')
  ) {
    data.allergies?.push(makeAllergyDTO(resource));
  } else if (
    resource?.resourceType === 'MedicationAdministration' &&
    chartDataResourceHasMetaTagByCode(resource, 'current-medication')
  ) {
    data.medications?.push(makeMedicationDTO(resource));
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'surgical-history')
  ) {
    data.procedures?.push(makeProcedureDTO(resource));
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'surgical-history-note')
  ) {
    data.proceduresNote = makeFreeTextNoteDTO(resource);
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagByCode(resource, 'additional-question')
  ) {
    data.observations = makeFreeTextNoteDTO(resource);
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/${EXAM_OBSERVATION_META_SYSTEM}`)
  ) {
    data.examObservations?.push(makeExamObservationDTO(resource));
  }

  return data;
};
