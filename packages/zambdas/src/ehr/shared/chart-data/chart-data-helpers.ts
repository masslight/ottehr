import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import {
  AllergyIntolerance,
  ClinicalImpression,
  CodeableConcept,
  Communication,
  Condition,
  DocumentReference,
  Encounter,
  EpisodeOfCare,
  FhirResource,
  List,
  MedicationRequest,
  MedicationStatement,
  Meta,
  Observation,
  Practitioner,
  Procedure,
  Reference,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  AllergyDTO,
  BirthHistoryDTO,
  BooleanValueDTO,
  CPTCodeDTO,
  CSS_NOTE_ID,
  ChartDataFields,
  ClinicalImpressionDTO,
  CommunicationDTO,
  DiagnosisDTO,
  DispositionDTO,
  DispositionFollowUpType,
  DispositionMetaFieldsNames,
  DispositionType,
  EXAM_OBSERVATION_META_SYSTEM,
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  FHIR_EXTENSION,
  FreeTextNoteDTO,
  GetChartDataResponse,
  HospitalizationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_ID,
  NoteDTO,
  ObservationBooleanFieldDTO,
  ObservationDTO,
  ObservationTextFieldDTO,
  PATIENT_VITALS_META_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  PrescribedMedicationDTO,
  ProviderChartDataFieldsNames,
  SCHOOL_WORK_NOTE,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_TYPE_META_SYSTEM,
  SNOMEDCodeConceptInterface,
  SchoolWorkNoteExcuseDocFileDTO,
  SchoolWorkNoteType,
  addEmptyArrOperation,
  addOperation,
  addOrReplaceOperation,
  createCodingCode,
  createFilesDocumentReferences,
  fillVitalObservationAttributes,
  isVitalObservation,
  makeVitalsObservationDTO,
  removeOperation,
} from 'utils';
import { followUpToPerformerMap } from '../../save-chart-data/helpers';
import { removePrefix } from '../appointment/helpers';
import { PdfDocumentReferencePublishedStatuses, PdfInfo, isDocumentPublished } from '../pdf/pdf-utils';
import { saveOrUpdateResourceRequest } from '../resources.helpers';
import { fillMeta } from '../helpers';

const getMetaWFieldName = (fieldName: ProviderChartDataFieldsNames): Meta => {
  return fillMeta(fieldName, fieldName);
};

export function makeConditionResource(
  encounterId: string,
  patientId: string,
  data: MedicalConditionDTO | FreeTextNoteDTO,
  fieldName: ProviderChartDataFieldsNames
): Condition {
  const dto = data as MedicalConditionDTO;
  return {
    id: data.resourceId,
    resourceType: 'Condition',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    code: dto.code
      ? {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              version: '2019',
              code: dto.code,
              display: dto.display,
            },
          ],
        }
      : undefined,
    note: (data as FreeTextNoteDTO).text
      ? [{ text: (data as FreeTextNoteDTO).text || '' }]
      : (data as MedicalConditionDTO).note
      ? [{ text: (data as MedicalConditionDTO).note || '' }]
      : [],
    clinicalStatus:
      typeof (data as MedicalConditionDTO).current === 'boolean'
        ? {
            coding: [
              {
                code: (data as MedicalConditionDTO).current ? 'active' : 'inactive',
                system: FHIR_EXTENSION.Condition.conditionClinical.url,
              },
            ],
          }
        : undefined,
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeConditionDTO(condition: Condition): MedicalConditionDTO {
  return {
    resourceId: condition.id,
    code: condition.code?.coding?.[0]?.code,
    display: condition.code?.coding?.[0]?.display,
    note: condition.note?.[0]?.text,
    current: condition.clinicalStatus?.coding?.[0]?.code === 'active',
  };
}

export function makeAllergyResource(
  encounterId: string,
  patientId: string,
  data: AllergyDTO,
  fieldName: ProviderChartDataFieldsNames
): AllergyIntolerance {
  // commenting type for now since zap and photon doesn't support it yet
  // const allergyType = data.type !== 'food' && data.type !== 'medication' ? undefined : data.type;
  return {
    id: data.resourceId,
    resourceType: 'AllergyIntolerance',
    patient: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    // category: allergyType ? [allergyType] : undefined,
    meta: getMetaWFieldName(fieldName),
    note: data.note ? [{ text: data.note }] : undefined,
    clinicalStatus:
      typeof data.current === 'boolean'
        ? {
            coding: [
              {
                code: data.current ? 'active' : 'inactive',
                system: FHIR_EXTENSION.AllergyIntolerance.allergyIntoleranceClinical.url,
              },
            ],
          }
        : undefined,
    code: {
      coding: [
        {
          system: 'http://api.zapehr.com/photon-allergy-id',
          code: data.id,
          display: data.name,
        },
      ],
    },
  };
}

export function makeAllergyDTO(allergy: AllergyIntolerance): AllergyDTO {
  // const allergyDTOType =
  //   (allergy.category?.[0] &&
  //     (allergy.category[0] !== 'food' && allergy.category[0] !== 'medication' ? 'other' : allergy.category[0])) ??
  //   'other';
  return {
    resourceId: allergy.id,
    // type: allergyDTOType,
    name: allergy.code?.coding?.[0].display,
    id: allergy.code?.coding?.[0].code,
    note: allergy.note?.[0]?.text,
    current: allergy.clinicalStatus?.coding?.[0]?.code === 'active',
  };
}

export function makeMedicationResource(
  encounterId: string,
  patientId: string,
  practitioner: Practitioner,
  data: MedicationDTO,
  fieldName: ProviderChartDataFieldsNames
): MedicationStatement {
  return {
    id: data.resourceId,
    identifier: [{ value: data.id }],
    resourceType: 'MedicationStatement',
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    status: data.status,
    dosage: [{ text: data.intakeInfo.dose, asNeededBoolean: data.type === 'as-needed' }],
    effectiveDateTime: data.intakeInfo.date,
    informationSource: { reference: `Practitioner/${practitioner.id}` },
    meta: getMetaWFieldName(fieldName),
    medicationCodeableConcept: {
      coding: [
        {
          system: 'http://api.zapehr.com/photon-medication-id',
          code: data.id,
          display: data.name,
        },
      ],
    },
  };
}

export function makeMedicationDTO(medication: MedicationStatement): MedicationDTO {
  return {
    resourceId: medication.id,
    id: medication.medicationCodeableConcept?.coding?.[0].code || '',
    name: medication.medicationCodeableConcept?.coding?.[0].display || '',
    type: medication.dosage?.[0].asNeededBoolean ? 'as-needed' : 'scheduled',
    intakeInfo: {
      dose: medication.dosage?.[0].text || '',
      date: medication.effectiveDateTime,
    },
    status: ['active', 'completed'].includes(medication.status)
      ? (medication.status as 'active' | 'completed')
      : 'completed',
    practitioner: medication.informationSource,
  };
}

export function makePrescribedMedicationDTO(medRequest: MedicationRequest): PrescribedMedicationDTO {
  return {
    resourceId: medRequest.id,
    name: medRequest.medicationCodeableConcept?.coding?.find(
      (coding) => coding.system === 'http://api.zapehr.com/photon-treatment-id'
    )?.display,
    instructions: medRequest.dosageInstruction?.[0]?.patientInstruction,
    added: medRequest.extension?.find((extension) => extension.url === 'http://api.zapehr.com/photon-event-time')
      ?.valueDateTime,
    provider: medRequest.requester?.reference?.split('/')?.[1],
    status: medRequest.status,
    prescriptionId: medRequest.identifier?.find(
      (identifier) => identifier.system === 'http://api.zapehr.com/photon-prescription-id'
    )?.value,
  };
}

export function makeProcedureResource(
  encounterId: string,
  patientId: string,
  data: FreeTextNoteDTO | CPTCodeDTO,
  fieldName: ProviderChartDataFieldsNames
): Procedure {
  const nameOrText = (data as CPTCodeDTO).display || (data as FreeTextNoteDTO).text || '';
  const result: Procedure = {
    id: data.resourceId,
    resourceType: 'Procedure',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'completed',
    note: nameOrText ? [{ text: nameOrText }] : undefined,
    meta: getMetaWFieldName(fieldName),
  };
  const text = (data as FreeTextNoteDTO).text;
  if (text !== undefined) {
    result.note = [{ text: text }];
  } else if ('code' in data && 'display' in data) {
    result.code = {
      coding: [{ code: data.code, display: data.display }],
    };
  }
  return result;
}

export function makeObservationResource(
  encounterId: string,
  patientId: string,
  practitionerId: string,
  data: ObservationDTO,
  metaSystem: string
): Observation {
  const base: Observation = {
    id: data.resourceId,
    resourceType: 'Observation',
    subject: { reference: `Patient/${patientId}` },
    performer:
      practitionerId && practitionerId.length > 0 ? [{ reference: `Practitioner/${practitionerId}` }] : undefined,
    encounter: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: DateTime.utc().toISO()!,
    status: 'final',
    code: { text: data.field || 'unknown' },
    meta: fillMeta(data.field, metaSystem),
  };

  const fieldName = data.field;
  console.log(`makeObservationResource() fieldName=[${fieldName}]`);

  if (isVitalObservation(data)) {
    console.log(`isVitalObservation() == true`);
    return fillVitalObservationAttributes(base, data);
  }

  if (isObservationBooleanFieldDTO(data)) {
    return {
      ...base,
      valueBoolean: data.value,
    };
  }

  if (isObservationTextFieldDTO(data)) {
    if ('note' in data) {
      return {
        ...base,
        valueString: data.value,
        note: [{ text: data.note }],
      };
    } else {
      return {
        ...base,
        valueString: data.value,
      };
    }
  }

  throw new Error('Invalid ObservationDTO type');
}

function isObservationBooleanFieldDTO(data: ObservationDTO): data is ObservationBooleanFieldDTO {
  return typeof (data as ObservationBooleanFieldDTO).value === 'boolean';
}

function isObservationTextFieldDTO(data: ObservationDTO): data is ObservationTextFieldDTO {
  return typeof (data as ObservationTextFieldDTO).value === 'string';
}

export function makeFreeTextNoteDTO(resource: Procedure | Observation | Condition): FreeTextNoteDTO {
  return {
    resourceId: resource.id,
    text: resource.note?.[0]?.text || '',
  };
}

export function makeCPTCodeDTO(resource: Procedure): CPTCodeDTO | undefined {
  const coding = resource.code?.coding?.[0];
  if (coding?.code && coding?.display) {
    return {
      resourceId: resource.id,
      code: coding?.code,
      display: coding?.display,
    };
  }
  return undefined;
}

export function makeHospitalizationResource(
  patientId: string,
  data: HospitalizationDTO,
  fieldName: ProviderChartDataFieldsNames
): EpisodeOfCare {
  const result: EpisodeOfCare = {
    id: data.resourceId,
    resourceType: 'EpisodeOfCare',
    identifier: [{ value: data.code }],
    status: 'finished',
    patient: { reference: `Patient/${patientId}` },
    type: [createCodingCode(data.code, data.display)],
    meta: getMetaWFieldName(fieldName),
  };
  return result;
}

export function makeHospitalizationDTO(resource: EpisodeOfCare): HospitalizationDTO | undefined {
  const coding = resource.type;
  if (coding) {
    if (coding[0].coding?.[0]?.code && coding[0].coding?.[0]?.display) {
      return {
        resourceId: resource.id,
        code: coding[0].coding?.[0]?.code,
        display: coding[0].coding?.[0]?.display,
        snomedDescription: `${coding[0].coding?.[0]?.code} | ${coding[0].coding?.[0]?.display}`,
        snomedRegionDescription: '',
      };
    }
  }
  return undefined;
}

export function makeExamObservationResource(
  encounterId: string,
  patientId: string,
  data: ExamObservationDTO,
  snomedCodes: SNOMEDCodeConceptInterface
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

export function makeClinicalImpressionResource(
  encounterId: string,
  patientId: string,
  data: ClinicalImpressionDTO,
  fieldName: ProviderChartDataFieldsNames
): ClinicalImpression {
  return {
    resourceType: 'ClinicalImpression',
    id: data.resourceId,
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    summary: data.text,
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeClinicalImpressionDTO(resource: ClinicalImpression): ClinicalImpressionDTO {
  return {
    resourceId: resource.id,
    text: resource.summary,
  };
}

export function makeCommunicationResource(
  encounterId: string,
  patientId: string,
  data: CommunicationDTO,
  fieldName: ProviderChartDataFieldsNames
): Communication {
  return {
    resourceType: 'Communication',
    id: data.resourceId,
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    payload: [
      {
        contentString: data.text,
      },
    ],
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeCommunicationDTO(resource: Communication): CommunicationDTO {
  return {
    resourceId: resource.id,
    text: resource.payload?.[0].contentString,
  };
}

export function makeNoteResource(encounterId: string, patientId: string | undefined, data: NoteDTO): Communication {
  const resource: Communication = {
    id: data.resourceId,
    resourceType: 'Communication',
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'completed',
    meta: fillMeta(CSS_NOTE_ID, data.type),
    subject: { reference: `Patient/${patientId}` },
    sender: {
      reference: `Practitioner/${data.authorId}`,
      display: data.authorName,
    },
    payload: [
      {
        contentString: data.text,
      },
    ],
  };

  return resource;
}

export function makeNoteDTO(resource: Communication): NoteDTO {
  const noteType = (resource.meta?.tag
    ?.find((tag) => tag.code)
    ?.system?.split('/')
    ?.at(-1) || 'unknown') as NoteDTO['type'];

  return {
    type: noteType || 'unknown',
    resourceId: resource.id,
    text: resource.payload?.[0]?.contentString ?? '',
    lastUpdated: resource.meta?.lastUpdated ?? '',
    authorId: resource.sender?.reference?.split('/')[1] ?? '',
    authorName: resource.sender?.display ?? '',
    patientId: resource.subject?.reference?.split('/')[1] ?? '',
    encounterId: resource.encounter?.reference?.split('/')[1] ?? '',
  };
}

export function updateEncounterDischargeDisposition(encounter: Encounter, data: DispositionDTO | undefined): Operation {
  if (!data) return removeOperation('/hospitalization');

  return addOrReplaceOperation(encounter.hospitalization, '/hospitalization', {
    dischargeDisposition: {
      coding: [
        {
          code: data.type,
          system: `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition`,
        },
      ],
      text: data.note,
    },
  });
}

export function makeServiceRequestResource({
  resourceId,
  encounterId,
  patientId,
  metaName,
  code,
  followUpIn,
  orderDetail,
  performerType,
  note,
  nothingToEatOrDrink,
}: {
  resourceId: string | undefined;
  encounterId: string;
  patientId: string;
  metaName: DispositionMetaFieldsNames;
  code: CodeableConcept;
  followUpIn?: number;
  orderDetail?: CodeableConcept[];
  performerType?: CodeableConcept;
  note?: string;
  [NOTHING_TO_EAT_OR_DRINK_FIELD]?: boolean;
}): ServiceRequest {
  return {
    id: resourceId,
    resourceType: 'ServiceRequest',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    intent: 'plan',
    status: 'active',
    orderDetail: orderDetail ?? undefined,
    performerType: performerType ?? undefined,
    occurrenceTiming: followUpIn
      ? {
          repeat: {
            offset: followUpIn,
          },
        }
      : undefined,
    note: note
      ? [
          {
            text: note,
          },
        ]
      : undefined,
    code,
    meta: fillMeta(metaName, metaName),
    extension:
      nothingToEatOrDrink === true
        ? [{ url: NOTHING_TO_EAT_OR_DRINK_ID, valueBoolean: nothingToEatOrDrink }]
        : undefined,
  };
}

const filterCodeableConcepts = <T extends string>(details: CodeableConcept[] | undefined, system: T): string[] => {
  const isValidDetail = (
    detail: CodeableConcept
  ): detail is CodeableConcept & { coding: [{ system: T; code: string }] } =>
    detail.coding?.[0]?.system === system && typeof detail.coding[0]?.code === 'string';

  return details?.filter(isValidDetail).map((detail) => detail.coding[0].code) ?? [];
};

export function makeDispositionDTO(
  dispositionCode: string,
  dispositionText: string,
  followUp: ServiceRequest,
  subFollowUp?: ServiceRequest[]
): DispositionDTO {
  const labServices = filterCodeableConcepts(followUp.orderDetail, 'lab-service');
  const virusTests = filterCodeableConcepts(followUp.orderDetail, 'virus-test');
  const reasonForTransfer = filterCodeableConcepts(followUp.orderDetail, 'reason-for-transfer')[0];

  const followUpArr = subFollowUp?.map((element) => {
    const performerCode = element.performerType?.coding?.[0].code;
    const followUpType = Object.keys(followUpToPerformerMap).find(
      (keyName) => performerCode === followUpToPerformerMap[keyName as DispositionFollowUpType]?.coding?.[0].code
    );

    return {
      type: followUpType as DispositionFollowUpType,
      note: element.note?.[0].text,
    };
  });

  const followUpTime = followUp.occurrenceTiming?.repeat?.offset;

  return {
    type: dispositionCode as DispositionType,
    note: dispositionText,
    labService: labServices,
    virusTest: virusTests,
    reason: reasonForTransfer,
    followUp: followUpArr ?? undefined,
    followUpIn: followUpTime ? Math.floor(followUpTime / 1440) : undefined,
    [NOTHING_TO_EAT_OR_DRINK_FIELD]: followUp.extension?.some(
      (ext) => ext.url === NOTHING_TO_EAT_OR_DRINK_ID && ext.valueBoolean === true
    ),
  };
}

export function makeDispositionDTOFromFhirResources(
  encounter?: Encounter,
  serviceRequests?: ServiceRequest[]
): DispositionDTO | undefined {
  // checking and creating dispositionDTO
  if (encounter) {
    const dischargeDisposition = encounter.hospitalization?.dischargeDisposition;
    const dispositionCode = dischargeDisposition?.coding?.find(
      (coding) => coding.system === `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition`
    )?.code;
    const dispositionText = dischargeDisposition?.text;

    if (dispositionCode && dispositionText !== undefined) {
      const dispositionFollowUp = serviceRequests?.find((serviceRequest) =>
        chartDataResourceHasMetaTagByCode(serviceRequest, 'disposition-follow-up')
      );

      const subFollowUps = serviceRequests?.filter((serviceRequest) =>
        chartDataResourceHasMetaTagByCode(serviceRequest, 'sub-follow-up')
      );

      if (dispositionFollowUp) {
        return makeDispositionDTO(dispositionCode, dispositionText, dispositionFollowUp, subFollowUps);
      }
    }
  }
  return undefined;
}

export function updateEncounterDiagnosis(encounter: Encounter, conditionId: string, data: DiagnosisDTO): Operation[] {
  const conditionReference = `Condition/${conditionId}`;
  let foundDiagnosis = false;
  const resultOperations: Operation[] = [];

  encounter.diagnosis?.forEach((element, index) => {
    if (element.condition.reference === conditionReference) {
      if (data.isPrimary) resultOperations.push(addOperation(`/diagnosis/${index}/rank`, 1));
      else if (!data.isPrimary && element.rank !== undefined)
        resultOperations.push(removeOperation(`/diagnosis/${index}/rank`));
      foundDiagnosis = true;
    }
  });
  if (!foundDiagnosis) {
    if (!encounter.diagnosis) resultOperations.push(addEmptyArrOperation('/diagnosis'));
    resultOperations.push(
      addOperation('/diagnosis/-', {
        condition: { reference: conditionReference },
        rank: data.isPrimary ? 1 : undefined,
      })
    );
  }
  return resultOperations;
}

export function updateEncounterPatientInfoConfirmed(encounter: Encounter, data: BooleanValueDTO): Operation[] {
  const resultOperations: Operation[] = [];
  const patientInfoConfirmed = encounter.extension?.find((extension) => extension.url === 'patient-info-confirmed');

  if (patientInfoConfirmed) {
    encounter.extension?.forEach((ext, index) => {
      if (ext.url === 'patient-info-confirmed') {
        resultOperations.push(addOrReplaceOperation(ext.valueBoolean, `/extension/${index}/valueBoolean`, data.value));
      }
    });
  } else {
    if (!encounter.extension) resultOperations.push(addEmptyArrOperation('/extension'));
    resultOperations.push(addOperation('/extension/-', { url: 'patient-info-confirmed', valueBoolean: data.value }));
  }

  return resultOperations;
}

export function updateEncounterAddToVisitNote(encounter: Encounter, data: BooleanValueDTO): Operation[] {
  const resultOperations: Operation[] = [];
  const addToVisitNote = encounter.extension?.find((extension) => extension.url === 'add-to-visit-note');

  if (addToVisitNote) {
    encounter.extension?.forEach((ext, index) => {
      if (ext.url === 'add-to-visit-note') {
        resultOperations.push(addOrReplaceOperation(ext.valueBoolean, `/extension/${index}/valueBoolean`, data.value));
      }
    });
  } else {
    if (!encounter.extension) resultOperations.push(addEmptyArrOperation('/extension'));
    resultOperations.push(addOperation('/extension/-', { url: 'add-to-visit-note', valueBoolean: data.value }));
  }

  return resultOperations;
}

export function updateEncounterAddendumNote(encounter: Encounter, data: FreeTextNoteDTO): Operation[] {
  const addendumNote = encounter.extension?.find((extension) => extension.url === 'addendum-note');
  const resultOperations: Operation[] = [];

  if (addendumNote) {
    encounter.extension?.forEach((ext, index) => {
      if (ext.url === 'addendum-note') {
        resultOperations.push(addOrReplaceOperation(ext.valueString, `/extension/${index}/valueString`, data.text));
      }
    });
  } else {
    if (!encounter.extension) resultOperations.push(addEmptyArrOperation('/extension'));
    resultOperations.push(addOperation('/extension/-', { url: 'addendum-note', valueString: data.text }));
  }

  return resultOperations;
}

export function deleteEncounterDiagnosis(encounter: Encounter, conditionId: string): Operation[] {
  const resultOperations: Operation[] = [];
  if (encounter.diagnosis) {
    encounter.diagnosis.find((diagnosis, index) => {
      if (diagnosis.condition.reference === `Condition/${conditionId}`)
        resultOperations.push(removeOperation(`/diagnosis/${index}`));
    });
  }
  return resultOperations;
}

export function deleteEncounterAddendumNote(encounter: Encounter): Operation[] {
  const resultOperations: Operation[] = [];
  encounter.extension?.find((ext, index) => {
    if (ext.url === 'addendum-note') resultOperations.push(removeOperation(`/extension/${index}`));
  });
  return resultOperations;
}

export function makeDiagnosisConditionResource(
  encounterId: string,
  patientId: string,
  data: DiagnosisDTO,
  fieldName: ProviderChartDataFieldsNames
): Condition {
  return {
    id: data.resourceId,
    resourceType: 'Condition',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    code: {
      coding: [
        {
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: data.code,
          display: data.display,
        },
      ],
    },
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeDiagnosisDTO(resource: Condition, isPrimary: boolean): DiagnosisDTO {
  return {
    resourceId: resource.id,
    code: resource.code?.coding?.[0].code || '',
    display: resource.code?.coding?.[0].display || '',
    isPrimary: isPrimary,
  };
}

const mapBirthHistoryFieldToCoding: {
  [field in BirthHistoryDTO['field']]: { system: string; code: string; display: string };
} = {
  age: {
    system: 'http://loinc.org',
    code: '76516-4',
    display: 'Gestational age--at birth',
  },
  weight: {
    system: 'http://loinc.org',
    code: '8339-4',
    display: 'Birth weight Measured',
  },
  length: {
    system: 'http://loinc.org',
    code: '89269-5',
    display: 'Body height Measured --at birth',
  },
  'preg-compl': {
    system: 'http://loinc.org',
    code: '65869-0',
    display: 'Pregnancy complication',
  },
  'del-compl': {
    system: 'http://loinc.org',
    code: '73781-7',
    display: 'Maternal morbidity',
  },
};

const mapBirthHistoryFieldToValueQuantity: {
  [field in BirthHistoryDTO['field']]: ((value: number) => { value: number; system: string; code: string }) | undefined;
} = {
  age: (value) => ({
    value,
    system: 'http://unitsofmeasure.org',
    code: 'wk',
  }),
  weight: (value) => ({
    value,
    system: 'http://unitsofmeasure.org',
    code: 'kg',
  }),
  length: (value) => ({
    value,
    system: 'http://unitsofmeasure.org',
    code: 'cm',
  }),
  'preg-compl': undefined,
  'del-compl': undefined,
};

export function makeBirthHistoryObservationResource(
  encounterId: string,
  patientId: string,
  data: BirthHistoryDTO,
  fieldName: ProviderChartDataFieldsNames
): Observation {
  const coding = mapBirthHistoryFieldToCoding[data.field];
  const valueQuantity = mapBirthHistoryFieldToValueQuantity[data.field]?.(data.value!);

  return {
    id: data.resourceId,
    resourceType: 'Observation',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    status: 'final',
    code: {
      coding: [coding],
    },
    note: data.note ? [{ text: data.note }] : undefined,
    valueBoolean: data.flag,
    valueQuantity,
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeBirthHistoryDTO(resource: Observation): BirthHistoryDTO {
  return {
    resourceId: resource.id,
    field: Object.keys(mapBirthHistoryFieldToCoding).find(
      (field) =>
        resource.code.coding?.[0]?.code === mapBirthHistoryFieldToCoding[field as BirthHistoryDTO['field']].code
    ) as BirthHistoryDTO['field'],
    note: resource.note?.[0]?.text,
    flag: resource.valueBoolean,
    value: resource.valueQuantity?.value,
  };
}

export async function makeSchoolWorkDR(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  appointmentId: string,
  encounterId: string,
  type: SchoolWorkNoteType,
  fieldName: ProviderChartDataFieldsNames,
  listResources: List[]
): Promise<DocumentReference> {
  const docRefs = await createFilesDocumentReferences({
    files: [
      {
        url: pdfInfo.uploadURL,
        title: pdfInfo.title,
      },
    ],
    docStatus: PdfDocumentReferencePublishedStatuses.unpublished,
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: SCHOOL_WORK_NOTE_CODE,
          display: 'School/Work note',
        },
      ],
      text: 'School/Work note',
    },
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: {
        related: [
          {
            reference: `Appointment/${appointmentId}`,
          },
        ],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    meta: {
      tag: [{ code: type, system: SCHOOL_WORK_NOTE_TYPE_META_SYSTEM }, ...(getMetaWFieldName(fieldName).tag || [])],
    },
    searchParams: [],
    listResources,
  });
  return docRefs[0];
}

export function makeSchoolWorkNoteDTO(resource: DocumentReference): SchoolWorkNoteExcuseDocFileDTO {
  const documentBaseUrl = resource.content?.[0].attachment.url;
  if (!documentBaseUrl) throw new Error("Attached DocumentReference don't have attached base file URL");
  const type = resource.meta?.tag?.find((tag) => tag.system === SCHOOL_WORK_NOTE_TYPE_META_SYSTEM)
    ?.code as SchoolWorkNoteType;
  return {
    id: resource.id!,
    name: documentBaseUrl.split('/').reverse()[0],
    url: documentBaseUrl,
    published: isDocumentPublished(resource),
    date: resource.date!,
    type: type ?? 'work',
  };
}

export function makeObservationDTO(observation: Observation): null | ObservationDTO {
  const field = observation.meta?.tag?.[0].code || '';

  if (typeof observation.valueBoolean === 'boolean') {
    return {
      resourceId: observation.id,
      field,
      value: observation.valueBoolean,
    } as ObservationBooleanFieldDTO;
  } else if (typeof observation.valueString === 'string') {
    return {
      resourceId: observation.id,
      field,
      value: observation.valueString,
      note: observation.note?.[0]?.text,
    } as ObservationTextFieldDTO;
  }

  console.error(`Invalid Observation field type: "${field}" ${JSON.stringify(observation)}`);
  return null;
}

export async function saveOrUpdateResource<Savable extends FhirResource>(
  resource: Savable,
  oystehr: Oystehr
): Promise<Savable> {
  if (resource.id === undefined) return oystehr.fhir.create(resource);
  return oystehr.fhir.update(resource);
}

export const chartDataResourceHasMetaTagByCode = (
  resource: Resource,
  metaTagCode?: ProviderChartDataFieldsNames | DispositionMetaFieldsNames
): boolean => (metaTagCode ? Boolean(resource?.meta?.tag?.find((tag) => tag.code === metaTagCode)) : true);

interface EncounterLinked extends Resource {
  encounter?: Reference | undefined;
}

const resourceReferencesEncounter = (resource: EncounterLinked, encounterId: string): boolean => {
  const encounterRef = resource.encounter?.reference?.replace('Encounter/', '');
  return encounterRef === encounterId;
};

export const chartDataResourceHasMetaTagBySystem = (resource: Resource, metaTagSystem?: string): boolean =>
  metaTagSystem ? Boolean(resource?.meta?.tag?.find((tag) => tag.system === metaTagSystem)) : true;

const mapResourceToChartDataFields = (
  data: ChartDataFields,
  resource: FhirResource,
  encounterId: string
): { chartDataFields: ChartDataFields; resourceMapped: boolean } => {
  let resourceMapped = false;
  if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'medical-condition')) {
    data.conditions?.push(makeConditionDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Condition' &&
    chartDataResourceHasMetaTagByCode(resource, 'chief-complaint') &&
    resourceReferencesEncounter(resource, encounterId)
  ) {
    data.chiefComplaint = makeFreeTextNoteDTO(resource);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Condition' &&
    chartDataResourceHasMetaTagByCode(resource, 'ros') &&
    resourceReferencesEncounter(resource, encounterId)
  ) {
    data.ros = makeFreeTextNoteDTO(resource);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'AllergyIntolerance' &&
    chartDataResourceHasMetaTagByCode(resource, 'known-allergy')
  ) {
    data.allergies?.push(makeAllergyDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'MedicationStatement' &&
    chartDataResourceHasMetaTagByCode(resource, 'current-medication')
  ) {
    data.medications?.push(makeMedicationDTO(resource));
    resourceMapped = true;
  } else if (resource?.resourceType === 'MedicationRequest') {
    data.prescribedMedications?.push(makePrescribedMedicationDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'surgical-history')
  ) {
    const cptDto = makeCPTCodeDTO(resource);
    if (cptDto) data.procedures?.push(cptDto);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'surgical-history-note')
  ) {
    data.proceduresNote = makeFreeTextNoteDTO(resource);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/${ADDITIONAL_QUESTIONS_META_SYSTEM}`)
  ) {
    const resourse = makeObservationDTO(resource);
    // TODO check edge cases if resourse is null
    if (resourse) data.observations?.push(resourse);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/${EXAM_OBSERVATION_META_SYSTEM}`)
  ) {
    data.examObservations?.push(makeExamObservationDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`)
  ) {
    const dto = makeVitalsObservationDTO(resource);
    if (dto) data.vitalsObservations?.push(dto);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Observation' &&
    chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/birth-history`)
  ) {
    data.birthHistory?.push(makeBirthHistoryDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'cpt-code') &&
    resourceReferencesEncounter(resource, encounterId)
  ) {
    const cptDto = makeCPTCodeDTO(resource);
    if (cptDto) data.cptCodes?.push(cptDto);
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'Procedure' &&
    chartDataResourceHasMetaTagByCode(resource, 'em-code') &&
    resourceReferencesEncounter(resource, encounterId)
  ) {
    const cptDto = makeCPTCodeDTO(resource);
    if (cptDto) data.emCode = cptDto;
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'ClinicalImpression' &&
    chartDataResourceHasMetaTagByCode(resource, 'medical-decision')
  ) {
    data.medicalDecision = makeClinicalImpressionDTO(resource);
    resourceMapped = true;
  } else if (
    resource.resourceType === 'Communication' &&
    chartDataResourceHasMetaTagByCode(resource, 'patient-instruction')
  ) {
    data.instructions?.push(makeCommunicationDTO(resource));
    resourceMapped = true;
  } else if (resource.resourceType === 'Communication' && chartDataResourceHasMetaTagByCode(resource, CSS_NOTE_ID)) {
    data.notes?.push(makeNoteDTO(resource));
    resourceMapped = true;
  } else if (
    resource?.resourceType === 'EpisodeOfCare' &&
    chartDataResourceHasMetaTagByCode(resource, 'hospitalization')
  ) {
    const hospitalizationDTO = makeHospitalizationDTO(resource);
    if (hospitalizationDTO) data.episodeOfCare?.push(hospitalizationDTO);
    resourceMapped = true;
  }
  return {
    chartDataFields: data,
    resourceMapped: resourceMapped,
  };
};

export function mapResourceToChartDataResponse(
  chartDataResponse: GetChartDataResponse,
  resource: FhirResource,
  encounterId: string
): { chartDataResponse: GetChartDataResponse; resourceMapped: boolean } {
  let resourceMapped = false;
  const updatedResponseData = mapResourceToChartDataFields(chartDataResponse, resource, encounterId);
  chartDataResponse = updatedResponseData.chartDataFields as GetChartDataResponse;
  resourceMapped = updatedResponseData.resourceMapped;

  if (resource.resourceType === 'DocumentReference' && chartDataResourceHasMetaTagByCode(resource, SCHOOL_WORK_NOTE)) {
    chartDataResponse.schoolWorkNotes?.push(makeSchoolWorkNoteDTO(resource));
    resourceMapped = true;
  }
  return {
    chartDataResponse,
    resourceMapped,
  };
}

export function handleCustomDTOExtractions(data: ChartDataFields, resources: FhirResource[]): ChartDataFields {
  const encounterResource = resources.find((res) => res.resourceType === 'Encounter') as Encounter;
  if (!encounterResource) return data;

  // 1. Getting DispositionDTO
  const serviceRequests: ServiceRequest[] = resources.filter(
    (res) => res.resourceType === 'ServiceRequest'
  ) as ServiceRequest[];
  data.disposition = makeDispositionDTOFromFhirResources(encounterResource, serviceRequests);

  // 2. Getting DiagnosisDTO
  encounterResource.diagnosis?.forEach((encounterDiagnosis) => {
    const conditionId = removePrefix('Condition/', encounterDiagnosis.condition.reference || '');
    const isPrimary = (encounterDiagnosis.rank ?? 0) === 1;
    if (conditionId) {
      const conditionResource = resources.find((element) => element.id === conditionId) as Condition;
      if (conditionResource) data.diagnosis?.push(makeDiagnosisDTO(conditionResource, isPrimary));
    }
  });

  // 3. Getting PatientInfoConfirmed
  const patientInfoConfirmed = encounterResource.extension?.find(
    (extension) => extension.url === 'patient-info-confirmed'
  );
  if (patientInfoConfirmed) {
    data.patientInfoConfirmed = { value: patientInfoConfirmed.valueBoolean };
  } else {
    data.patientInfoConfirmed = { value: false };
  }

  // 4. Getting AddToVisitNote
  const addToVisitNote = encounterResource.extension?.find((extension) => extension.url === 'add-to-visit-note');
  if (addToVisitNote) {
    data.addToVisitNote = { value: addToVisitNote.valueBoolean };
  }

  // 5. Getting AddendumNote
  const addendumNote = encounterResource.extension?.find((extension) => extension.url === 'addendum-note');
  if (addendumNote) {
    data.addendumNote = { text: addendumNote.valueString };
  }

  return data;
}

export const createDispositionServiceRequest = ({
  disposition,
  encounterId,
  followUpId,
  patientId,
}: {
  disposition: DispositionDTO;
  encounterId: string;
  followUpId?: string;
  patientId: string;
}): BatchInputPutRequest<ServiceRequest> | BatchInputPostRequest<ServiceRequest> => {
  let orderDetail: CodeableConcept[] | undefined = undefined;
  let dispositionFollowUpCode: CodeableConcept = createCodingCode('185389009', 'Follow-up visit (procedure)');

  if (disposition.type === 'ip-lab') {
    dispositionFollowUpCode = createCodingCode('15220000', 'Laboratory test (procedure)');
    orderDetail = [];
    disposition?.labService?.forEach?.((service) => {
      orderDetail?.push?.(createCodingCode(service, undefined, 'lab-service'));
    });
    disposition?.virusTest?.forEach?.((test) => {
      orderDetail?.push?.(createCodingCode(test, undefined, 'virus-test'));
    });
  }

  if (disposition.type === 'another' && disposition.reason) {
    orderDetail = [];
    orderDetail?.push?.(createCodingCode(disposition.reason, undefined, 'reason-for-transfer'));
  }

  const followUpDaysInMinutes = disposition.followUpIn ? disposition.followUpIn * 1440 : undefined;

  return saveOrUpdateResourceRequest(
    makeServiceRequestResource({
      resourceId: followUpId,
      encounterId,
      patientId,
      metaName: 'disposition-follow-up',
      code: dispositionFollowUpCode,
      followUpIn: followUpDaysInMinutes,
      orderDetail,
      [NOTHING_TO_EAT_OR_DRINK_FIELD]: disposition[NOTHING_TO_EAT_OR_DRINK_FIELD],
    })
  );
};
