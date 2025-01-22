import { FhirClient } from '@zapehr/sdk';
import {
  AllergyIntolerance,
  ClinicalImpression,
  CodeableConcept,
  Communication,
  Condition,
  DocumentReference,
  Encounter,
  FhirResource,
  MedicationStatement,
  Meta,
  Observation,
  Procedure,
  Resource,
  ServiceRequest,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  AllergyDTO,
  BooleanValueDTO,
  CPTCodeDTO,
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
  FreeTextNoteDTO,
  GetChartDataResponse,
  MedicalConditionDTO,
  MedicationDTO,
  PRIVATE_EXTENSION_BASE_URL,
  ProcedureDTO,
  ProviderChartDataFieldsNames,
  SCHOOL_WORK_NOTE,
  SCHOOL_WORK_NOTE_TYPE_META_SYSTEM,
  SNOMEDCodeConceptInterface,
  SaveChartDataResponse,
  SchoolWorkNoteExcuseDocFileDTO,
  SchoolWorkNoteType,
} from 'ehr-utils/lib/types';
import { followUpToPerformerMap } from '../../save-chart-data/helpers';
import { removePrefix } from '../appointment/helpers';
import { PdfInfo } from '../pdf/pdfUtils';

const getMetaWFieldName = (fieldName: ProviderChartDataFieldsNames): Meta => {
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

export function createCodingCode(code: string, display?: string, system?: string): CodeableConcept {
  return {
    coding: [
      {
        code: code,
        display: display ?? undefined,
        system: system ?? undefined,
      },
    ],
  };
}

export function makeConditionResource(
  encounterId: string,
  patientId: string,
  data: MedicalConditionDTO | FreeTextNoteDTO,
  fieldName: ProviderChartDataFieldsNames,
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
    note: (data as FreeTextNoteDTO).text ? [{ text: (data as FreeTextNoteDTO).text || '' }] : [],
    meta: getMetaWFieldName(fieldName),
  };
}

export function makeConditionDTO(condition: Condition): MedicalConditionDTO {
  return {
    resourceId: condition.id,
    code: condition.code?.coding?.[0]?.code,
    display: condition.code?.coding?.[0]?.display,
  };
}

export function makeAllergyResource(
  encounterId: string,
  patientId: string,
  data: AllergyDTO,
  fieldName: ProviderChartDataFieldsNames,
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
  };
}

export function makeMedicationResource(
  encounterId: string,
  patientId: string,
  data: MedicationDTO,
  fieldName: ProviderChartDataFieldsNames,
): MedicationStatement {
  return {
    id: data.resourceId,
    identifier: [{ value: data.id }],
    resourceType: 'MedicationStatement',
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    status: 'active',
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
    effectiveDateTime: DateTime.utc().toISO()!,
  };
}

export function makeMedicationDTO(medication: MedicationStatement): MedicationDTO {
  return {
    resourceId: medication.id,
    id: medication.medicationCodeableConcept?.coding?.[0].code || '',
    name: medication.medicationCodeableConcept?.coding?.[0].display,
  };
}

export function makeProcedureResource(
  encounterId: string,
  patientId: string,
  data: FreeTextNoteDTO | CPTCodeDTO | ProcedureDTO,
  fieldName: ProviderChartDataFieldsNames,
): Procedure {
  const nameOrText = (data as ProcedureDTO).name || (data as FreeTextNoteDTO).text || '';
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
  if (text !== undefined) result.note = [{ text: text }];
  else {
    const cptCode = (data as CPTCodeDTO).code;
    const cptDisplay = (data as CPTCodeDTO).display;
    if (cptCode && cptDisplay) {
      result.code = {
        coding: [
          {
            code: cptCode,
            display: cptDisplay,
          },
        ],
      };
    }
  }
  return result;
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
  fieldName: ProviderChartDataFieldsNames,
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

export function makeClinicalImpressionResource(
  encounterId: string,
  patientId: string,
  data: ClinicalImpressionDTO,
  fieldName: ProviderChartDataFieldsNames,
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
  fieldName: ProviderChartDataFieldsNames,
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

export function updateEncounterDischargeDisposition(encounter: Encounter, data: DispositionDTO | undefined): Encounter {
  const encounterCopy = { ...encounter };
  encounterCopy.hospitalization = data
    ? {
        dischargeDisposition: {
          coding: [
            {
              code: data.type,
              system: `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition`,
            },
          ],
          text: data.note,
        },
      }
    : undefined;
  return encounterCopy;
}

export function makeServiceRequestResource(
  resourceId: string | undefined,
  encounterId: string,
  patientId: string,
  metaName: DispositionMetaFieldsNames,
  code: CodeableConcept,
  followUpIn?: number,
  orderDetail?: CodeableConcept[],
  performerType?: CodeableConcept,
  note?: string,
): ServiceRequest {
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
  };
}

export function makeDispositionDTO(
  dispositionCode: string,
  dispositionText: string,
  followUp: ServiceRequest,
  subFollowUp?: ServiceRequest[],
): DispositionDTO {
  const labService = followUp.orderDetail?.find((code) => code.coding?.[0].system === 'lab-service');
  const virusTest = followUp.orderDetail?.find((code) => code.coding?.[0].system === 'virus-test');

  const followUpArr = subFollowUp?.map((element) => {
    const performerCode = element.performerType?.coding?.[0].code;
    const followUpType = Object.keys(followUpToPerformerMap).find(
      (keyName) => performerCode === followUpToPerformerMap[keyName as DispositionFollowUpType]?.coding?.[0].code,
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
    labService: labService?.coding?.[0].code,
    virusTest: virusTest?.coding?.[0].code,
    followUp: followUpArr ?? undefined,
    followUpIn: followUpTime ? Math.floor(followUpTime / 1440) : undefined,
  };
}

export function makeDispositionDTOFromFhirResources(
  encounter?: Encounter,
  serviceRequests?: ServiceRequest[],
): DispositionDTO | undefined {
  // checking and creating dispositionDTO
  if (encounter) {
    const dischargeDisposition = encounter.hospitalization?.dischargeDisposition;
    const dispositionCode = dischargeDisposition?.coding?.find(
      (coding) => coding.system === `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition`,
    )?.code;
    const dispositionText = dischargeDisposition?.text;

    if (dispositionCode && dispositionText !== undefined) {
      const dispositionFollowUp = serviceRequests?.find((serviceRequest) =>
        chartDataResourceHasMetaTagByCode(serviceRequest, 'disposition-follow-up'),
      );

      const subFollowUps = serviceRequests?.filter((serviceRequest) =>
        chartDataResourceHasMetaTagByCode(serviceRequest, 'sub-follow-up'),
      );

      if (dispositionFollowUp) {
        return makeDispositionDTO(dispositionCode, dispositionText, dispositionFollowUp, subFollowUps);
      }
    }
  }
  return undefined;
}

export function updateEncounterDiagnosis(encounter: Encounter, conditionId: string, data: DiagnosisDTO): Encounter {
  const encounterCopy = { ...encounter };
  const conditionReference = `Condition/${conditionId}`;
  let foundDiagnosis = false;

  if (!encounterCopy.diagnosis) encounterCopy.diagnosis = [];
  encounterCopy.diagnosis?.forEach((element, index) => {
    if (element.condition.reference === conditionReference) {
      encounterCopy.diagnosis![index].rank = data.isPrimary ? 1 : undefined;
      foundDiagnosis = true;
    }
  });
  if (!foundDiagnosis) {
    encounterCopy.diagnosis?.push({
      condition: { reference: conditionReference },
      rank: data.isPrimary ? 1 : undefined,
    });
  }
  return encounterCopy;
}

export function updateEncounterPatientInfoConfirmed(encounter: Encounter, data: BooleanValueDTO): Encounter {
  const encounterCopy = { ...encounter };

  const patientInfoConfirmed = encounterCopy.extension?.find((extension) => extension.url === 'patient-info-confirmed');

  if (patientInfoConfirmed) {
    encounterCopy.extension = encounterCopy.extension?.map((extension) =>
      extension.url === 'patient-info-confirmed' ? { ...extension, valueBoolean: data.value } : extension,
    );
  } else {
    if (!encounterCopy.extension) {
      encounterCopy.extension = [];
    }
    encounterCopy.extension.push({ url: 'patient-info-confirmed', valueBoolean: data.value });
  }

  return encounterCopy;
}

export function updateEncounterAddendumNote(encounter: Encounter, data: FreeTextNoteDTO): Encounter {
  const encounterCopy = { ...encounter };

  const addendumNote = encounterCopy.extension?.find((extension) => extension.url === 'addendum-note');

  if (addendumNote) {
    encounterCopy.extension = encounterCopy.extension?.map((extension) =>
      extension.url === 'addendum-note' ? { ...extension, valueString: data.text } : extension,
    );
  } else {
    if (!encounterCopy.extension) {
      encounterCopy.extension = [];
    }
    encounterCopy.extension.push({ url: 'addendum-note', valueString: data.text });
  }

  return encounterCopy;
}

export function deleteEncounterDiagnosis(encounter: Encounter, conditionId: string): Encounter {
  const encounterCopy = { ...encounter };
  if (encounter.diagnosis) {
    encounterCopy.diagnosis = encounterCopy.diagnosis?.filter(
      (element) => element.condition.reference !== `Condition/${conditionId}`,
    );
  }
  return encounterCopy;
}

export function deleteEncounterAddendumNote(encounter: Encounter): Encounter {
  const encounterCopy = { ...encounter };
  if (encounterCopy.extension?.find((extension) => extension.url === 'addendum-note')) {
    encounterCopy.extension = encounterCopy.extension.filter((extension) => extension.url !== 'addendum-note');
  }
  return encounterCopy;
}

export function makeDiagnosisConditionResource(
  encounterId: string,
  patientId: string,
  data: DiagnosisDTO,
  fieldName: ProviderChartDataFieldsNames,
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

export function makeDocumentReferenceResource(
  pdfInfo: PdfInfo,
  patientId: string,
  encounterId: string,
  type: SchoolWorkNoteType,
  metaTag: ProviderChartDataFieldsNames,
): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    meta: {
      tag: [
        { code: 'OTTEHR-TM' },
        { code: metaTag, system: `${PRIVATE_EXTENSION_BASE_URL}/${metaTag}` },
        { code: type, system: SCHOOL_WORK_NOTE_TYPE_META_SYSTEM },
      ],
    },
    date: DateTime.now().setZone('UTC').toISO() ?? '',
    status: 'current',
    // docStatus: PdfDocumentReferencePublishedStatuses.unpublished,
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '47420-5',
          display: 'School/Work note',
        },
      ],
    },
    content: [
      {
        attachment: { url: pdfInfo.uploadURL, title: pdfInfo.title, contentType: 'application/pdf' },
      },
    ],
    subject: {
      reference: `Patient/${patientId}`,
    },
    context: {
      encounter: [
        {
          reference: `Encounter/${encounterId}`,
        },
      ],
    },
  };
}

export function makeschoolWorkNoteDTO(resource: DocumentReference): SchoolWorkNoteExcuseDocFileDTO {
  const documentBaseUrl = resource.content?.[0].attachment.url;
  if (!documentBaseUrl) throw new Error("Attached DocumentReference don't have attached base file URL");
  const type = resource.meta?.tag?.find((tag) => tag.system === SCHOOL_WORK_NOTE_TYPE_META_SYSTEM)
    ?.code as SchoolWorkNoteType;
  return {
    id: resource.id!,
    name: documentBaseUrl.split('/').reverse()[0],
    url: documentBaseUrl,
    // published: isDocumentPublished(resource),
    date: resource.date!,
    type: type ?? 'work',
  };
}

export async function saveOrUpdateResource<Savable extends Resource>(
  resource: Savable,
  fhirClient: FhirClient,
): Promise<Savable> {
  if (resource.id === undefined) return fhirClient.createResource(resource);
  return fhirClient.updateResource(resource);
}

export const chartDataResourceHasMetaTagByCode = (
  resource: Resource,
  metaTagCode?: ProviderChartDataFieldsNames | DispositionMetaFieldsNames,
): boolean => (metaTagCode ? Boolean(resource?.meta?.tag?.find((tag) => tag.code === metaTagCode)) : true);

export const chartDataResourceHasMetaTagBySystem = (resource: Resource, metaTagSystem?: string): boolean =>
  metaTagSystem ? Boolean(resource?.meta?.tag?.find((tag) => tag.system === metaTagSystem)) : true;

const mapResourceToChartDataFields = (data: ChartDataFields, resource: FhirResource): ChartDataFields => {
  if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'medical-condition')) {
    data.conditions?.push(makeConditionDTO(resource));
  } else if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'chief-complaint')) {
    data.chiefComplaint = makeFreeTextNoteDTO(resource);
  } else if (resource?.resourceType === 'Condition' && chartDataResourceHasMetaTagByCode(resource, 'ros')) {
    data.ros = makeFreeTextNoteDTO(resource);
  } else if (
    resource?.resourceType === 'AllergyIntolerance' &&
    chartDataResourceHasMetaTagByCode(resource, 'known-allergy')
  ) {
    data.allergies?.push(makeAllergyDTO(resource));
  } else if (
    resource?.resourceType === 'MedicationStatement' &&
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
  } else if (resource?.resourceType === 'Procedure' && chartDataResourceHasMetaTagByCode(resource, 'cpt-code')) {
    const cptDto = makeCPTCodeDTO(resource);
    if (cptDto) data.cptCodes?.push(cptDto);
  } else if (
    resource?.resourceType === 'ClinicalImpression' &&
    chartDataResourceHasMetaTagByCode(resource, 'medical-decision')
  ) {
    data.medicalDecision = makeClinicalImpressionDTO(resource);
  } else if (
    resource.resourceType === 'Communication' &&
    chartDataResourceHasMetaTagByCode(resource, 'patient-instruction')
  ) {
    data.instructions?.push(makeCommunicationDTO(resource));
  }

  return data;
};

export function mapResourceToChartDataResponse(
  saveChartDataResponse: SaveChartDataResponse | GetChartDataResponse,
  resource: FhirResource,
): SaveChartDataResponse | GetChartDataResponse {
  saveChartDataResponse = mapResourceToChartDataFields(saveChartDataResponse, resource) as SaveChartDataResponse;

  if (resource.resourceType === 'DocumentReference' && chartDataResourceHasMetaTagByCode(resource, SCHOOL_WORK_NOTE)) {
    saveChartDataResponse.schoolWorkNotes?.push(makeschoolWorkNoteDTO(resource));
  }
  return saveChartDataResponse;
}

export function handleCustomDTOExtractions(data: ChartDataFields, resources: FhirResource[]): ChartDataFields {
  const encounterResource = resources.find((res) => res.resourceType === 'Encounter') as Encounter;

  // 1. Getting DispositionDTO
  const serviceRequests: ServiceRequest[] = resources.filter(
    (res) => res.resourceType === 'ServiceRequest',
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
    (extension) => extension.url === 'patient-info-confirmed',
  );
  if (patientInfoConfirmed) {
    data.patientInfoConfirmed = { value: patientInfoConfirmed.valueBoolean };
  }

  // 3. Getting AddendumNote
  const addendumNote = encounterResource.extension?.find((extension) => extension.url === 'addendum-note');
  if (addendumNote) {
    data.addendumNote = { text: addendumNote.valueString };
  }

  return data;
}
