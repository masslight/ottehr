/**
 * Utilities for questionnaire resource naming and key generation.
 */

export type QuestionnaireType = 'in-person' | 'virtual';

/**
 * Generates a consistent archive key for a questionnaire resource.
 * This key is used in archive JSON files and as the Terraform resource identifier.
 *
 * @param type - The questionnaire type ('in-person' or 'virtual')
 * @param version - The semantic version string (e.g., '1.0.1')
 * @returns The archive key (e.g., 'questionnaire-in-person-previsit-1_0_1')
 */
export function generateQuestionnaireArchiveKey(type: QuestionnaireType, version: string): string {
  const versionKey = version.replace(/\./g, '_');
  if (type === 'in-person') {
    return `questionnaire-in-person-previsit-${versionKey}`;
  } else {
    return `questionnaire-virtual-previsit-${versionKey}`;
  }
}
