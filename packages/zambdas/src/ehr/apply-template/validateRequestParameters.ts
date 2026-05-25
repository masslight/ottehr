import {
  ApplyTemplateZambdaInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUIRED_PARAMETERS,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TEMPLATE_SECTIONS_NO_APPEND,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionKey,
} from 'utils';
import { ZambdaInput } from '../../shared';

const VALID_ACTIONS: readonly TemplateSectionAction[] = ['skip', 'overwrite', 'append'];

const VALID_SECTION_KEYS: ReadonlySet<TemplateSectionKey> = new Set(
  Object.keys(TEMPLATE_SECTION_DEFAULT_ACTIONS) as TemplateSectionKey[]
);

const parseSectionActions = (raw: unknown): TemplateSectionActions => {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw INVALID_INPUT_ERROR('sectionActions must be an object');
  }

  const result: TemplateSectionActions = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_SECTION_KEYS.has(key as TemplateSectionKey)) {
      throw INVALID_INPUT_ERROR(`Unknown template section: ${key}`);
    }
    if (typeof value !== 'string' || !VALID_ACTIONS.includes(value as TemplateSectionAction)) {
      throw INVALID_INPUT_ERROR(
        `Invalid action for section ${key}: ${String(value)}. Must be one of: ${VALID_ACTIONS.join(', ')}`
      );
    }
    if (value === 'append' && TEMPLATE_SECTIONS_NO_APPEND.has(key as TemplateSectionKey)) {
      throw INVALID_INPUT_ERROR(`Section ${key} does not support the 'append' action`);
    }
    result[key as TemplateSectionKey] = value as TemplateSectionAction;
  }
  return result;
};

export function validateRequestParameters(input: ZambdaInput): ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  // Type guard to check if parsedInput is an object
  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { templateName, encounterId, sectionActions } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];
  if (templateName === undefined) {
    missingFields.push('templateName');
  }
  if (encounterId === undefined) {
    missingFields.push('encounterId');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  // Validate templateName is a string
  if (typeof templateName !== 'string') {
    throw INVALID_INPUT_ERROR('templateName must be a string');
  }

  if (typeof encounterId !== 'string') {
    throw INVALID_INPUT_ERROR('encounterId must be a string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  const validatedSectionActions = parseSectionActions(sectionActions);

  return {
    templateName,
    encounterId,
    sectionActions: validatedSectionActions,
    secrets: input.secrets,
  };
}
