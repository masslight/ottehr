export const QUESTIONNAIRE_ITEM_TYPES = [
  'attachment',
  'boolean',
  'choice',
  'date',
  'dateTime',
  'decimal',
  'display',
  'integer',
  'open-choice',
  'quantity',
  'reference',
  'string',
  'text',
  'time',
  'url',
] as const;

export type QuestionnaireItemType = (typeof QUESTIONNAIRE_ITEM_TYPES)[number];

export type QuestionnaireStatus = 'draft' | 'active' | 'retired' | 'unknown';

export interface QuestionnaireAnswerOption {
  valueString?: string;
  valueCoding?: { system?: string; code: string; display?: string };
  valueInteger?: number;
  initialSelected?: boolean;
  /** Raw FHIR extensions on the option (e.g. itemWeight, optionPrefix) */
  extension?: Record<string, unknown>[];
}

export interface QuestionnaireEnableWhen {
  question: string;
  operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=';
  answerBoolean?: boolean;
  answerString?: string;
  answerInteger?: number;
  answerCoding?: { system?: string; code: string; display?: string };
}

export const OTTEHR_DATA_TYPES = [
  'Phone Number',
  'Email',
  'ZIP',
  'DOB',
  'SSN',
  'Signature',
  'Image',
  'PDF',
  'Call Out',
] as const;

export type OttehrDataType = (typeof OTTEHR_DATA_TYPES)[number];

// Which Ottehr dataTypes are valid for each FHIR item type
export const DATA_TYPES_BY_ITEM_TYPE: Partial<Record<QuestionnaireItemType, readonly OttehrDataType[]>> = {
  string: ['Phone Number', 'Email', 'ZIP', 'SSN', 'Signature'],
  date: ['DOB'],
  attachment: ['Image', 'PDF'],
  display: ['Call Out'],
};

export const OTTEHR_INPUT_WIDTHS = ['s', 'm', 'l'] as const;
export type OttehrInputWidth = (typeof OTTEHR_INPUT_WIDTHS)[number];

export interface QuestionnaireItem {
  /** Internal key for stable identity in the builder UI — stripped from JSON output */
  _key: string;
  linkId: string;
  text?: string;
  type: QuestionnaireItemType;
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  enableWhen?: QuestionnaireEnableWhen[];
  enableBehavior?: 'all' | 'any';
  answerOption?: QuestionnaireAnswerOption[];
  initial?: { valueString?: string; valueBoolean?: boolean; valueInteger?: number }[];
  item?: QuestionnaireItem[];
  /** Ottehr extensions — stored in extension[] in the FHIR JSON */
  dataType?: OttehrDataType;
  inputWidth?: OttehrInputWidth;
  /** Raw FHIR extensions preserved from imported questionnaires (for preview rendering) */
  extension?: Record<string, unknown>[];
  /** LOINC or other code on the item */
  code?: { system?: string; code: string; display?: string }[];
}

export interface FhirQuestionnaire {
  resourceType: 'Questionnaire';
  id?: string;
  url?: string;
  name?: string;
  title?: string;
  status: QuestionnaireStatus;
  description?: string;
  item: QuestionnaireItem[];
  /** URLs of intake questionnaires this should be presented with */
  associatedQuestionnaires?: string[];
}

export function generateKey(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function createEmptyItem(): QuestionnaireItem {
  return {
    _key: generateKey(),
    linkId: '',
    type: 'string',
    text: '',
  };
}

export function createEmptyQuestionnaire(): FhirQuestionnaire {
  return {
    resourceType: 'Questionnaire',
    id: crypto.randomUUID(),
    status: 'draft',
    title: '',
    item: [],
  };
}

export const PRACTICE_MANAGED_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/questionnaire-type',
  code: 'practice-managed',
};

export const ASSOCIATED_QUESTIONNAIRE_EXTENSION_URL =
  'https://fhir.ottehr.com/StructureDefinitions/associated-questionnaire';

export interface IntakeQuestionnaireOption {
  url: string;
  title: string;
  id: string;
}

const EXTENSION_BASE = 'https://fhir.zapehr.com/r4/StructureDefinitions';

/** Convert a FHIR Questionnaire item (with extensions) back to builder format (with _key, dataType, inputWidth) */
function itemFromFhir(fhirItem: Record<string, unknown>): QuestionnaireItem {
  const extensions = (fhirItem.extension || []) as { url: string; valueString?: string }[];
  const dataType = extensions.find((e) => e.url === `${EXTENSION_BASE}/data-type`)?.valueString as
    | OttehrDataType
    | undefined;
  const inputWidth = extensions.find((e) => e.url === `${EXTENSION_BASE}/input-width`)?.valueString as
    | OttehrInputWidth
    | undefined;
  const children = fhirItem.item as Record<string, unknown>[] | undefined;

  return {
    _key: generateKey(),
    linkId: (fhirItem.linkId as string) || '',
    text: (fhirItem.text as string) || undefined,
    type: (fhirItem.type as QuestionnaireItemType) || 'string',
    required: (fhirItem.required as boolean) || undefined,
    repeats: (fhirItem.repeats as boolean) || undefined,
    readOnly: (fhirItem.readOnly as boolean) || undefined,
    maxLength: (fhirItem.maxLength as number) || undefined,
    answerOption: fhirItem.answerOption as QuestionnaireAnswerOption[] | undefined,
    enableWhen: fhirItem.enableWhen as QuestionnaireEnableWhen[] | undefined,
    enableBehavior: fhirItem.enableBehavior as 'all' | 'any' | undefined,
    item: children ? children.map(itemFromFhir) : undefined,
    dataType,
    inputWidth,
    extension: extensions.length > 0 ? (extensions as Record<string, unknown>[]) : undefined,
    code: fhirItem.code as { system?: string; code: string; display?: string }[] | undefined,
  };
}

/** Convert a FHIR Questionnaire resource into builder format */
export function fromFhirResource(resource: Record<string, unknown>): FhirQuestionnaire {
  const items = (resource.item || []) as Record<string, unknown>[];
  const extensions = (resource.extension || []) as { url: string; valueUri?: string }[];
  const associatedQuestionnaires = extensions
    .filter((e) => e.url === ASSOCIATED_QUESTIONNAIRE_EXTENSION_URL && e.valueUri)
    .map((e) => e.valueUri!);

  return {
    resourceType: 'Questionnaire',
    id: resource.id as string | undefined,
    url: resource.url as string | undefined,
    name: resource.name as string | undefined,
    title: resource.title as string | undefined,
    status: (resource.status as QuestionnaireStatus) || 'draft',
    description: resource.description as string | undefined,
    item: items.map(itemFromFhir),
    associatedQuestionnaires: associatedQuestionnaires.length > 0 ? associatedQuestionnaires : undefined,
  };
}
