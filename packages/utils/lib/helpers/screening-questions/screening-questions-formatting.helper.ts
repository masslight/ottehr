import { DateTime } from 'luxon';
import { patientScreeningQuestionsConfig } from '../../configuration/questionnaire';
import { Field } from '../../types/data/screening-questions';

/**
 * Format field value for display based on field configuration
 * Can be used in both frontend and PDF generation
 */
export function formatScreeningQuestionValue(fieldId: string, rawValue: any): string {
  if (rawValue === null || rawValue === undefined) return '';

  const field = patientScreeningQuestionsConfig.fields.find((f) => f.fhirField === fieldId);

  if (!field) {
    // Fallback for fields not in config
    if (typeof rawValue === 'boolean') {
      return rawValue ? 'Yes' : 'No';
    }
    return String(rawValue);
  }

  switch (field.type) {
    case 'radio':
      if (typeof rawValue === 'boolean') {
        return rawValue ? 'Yes' : 'No';
      }
      // For string values, find corresponding label in options
      if (field.options && typeof rawValue === 'string') {
        const option = field.options.find((opt) => opt.fhirValue === rawValue);
        return option?.label || String(rawValue);
      }
      return String(rawValue);
    case 'select':
      if (field.options) {
        const option = field.options.find((opt) => opt.fhirValue === rawValue);
        return option?.label || String(rawValue);
      }
      return String(rawValue);

    case 'dateRange':
      if (Array.isArray(rawValue) && rawValue.length === 2) {
        const [start, end] = rawValue;
        const formatDate = (dateStr: string): string => {
          if (!dateStr) return 'N/A';

          // Handle ISO date strings using Luxon
          const dateTime = DateTime.fromISO(dateStr);
          if (dateTime.isValid) {
            // Format as MM/dd/yyyy to match DateRangePicker format
            return dateTime.toFormat('MM/dd/yyyy');
          }

          // If Luxon can't parse it, return as-is
          return dateStr;
        };
        return `${formatDate(start)} - ${formatDate(end)}`;
      }
      return String(rawValue);

    default:
      return String(rawValue);
  }
}

/**
 * Get question text from screening questions configuration by fhir field ID
 */
export function getScreeningQuestionText(fieldId: string): string | null {
  const field = patientScreeningQuestionsConfig.fields.find((f) => f.fhirField === fieldId);
  if (field) {
    return field.question;
  }
  return null;
}

/**
 * Get field configuration by fhir field ID
 */
export function getScreeningQuestionField(fieldId: string): Field | undefined {
  return patientScreeningQuestionsConfig.fields.find((f) => f.fhirField === fieldId);
}

/**
 * Format screening question value with note for display
 */
export function formatScreeningQuestionWithNote(fieldId: string, observation: any): string {
  let formattedValue = formatScreeningQuestionValue(fieldId, observation.value);

  if (observation.note) {
    const field = patientScreeningQuestionsConfig.fields.find((f) => f.fhirField === fieldId);
    if (field?.noteField) {
      if (!field.noteField.conditionalValue || observation.value === field.noteField.conditionalValue) {
        formattedValue = `${formattedValue}: ${observation.note}`;
      }
    }
  }

  return formattedValue;
}

/**
 * Check if a screening question value should be displayed
 * Returns true for any non-null/undefined value, including false
 */
export function shouldDisplayScreeningQuestion(rawValue: any): boolean {
  return rawValue !== null && rawValue !== undefined;
}

/**
 * Render screening questions with proper filtering and formatting for PDF
 */
export function renderScreeningQuestionsForPDF(
  additionalQuestions: Record<string, any>,
  renderFn: (question: string, formattedValue: string) => void
): void {
  Object.entries(additionalQuestions).forEach(([fieldId, observation]) => {
    if (!shouldDisplayScreeningQuestion(observation.value)) {
      return;
    }

    const question = getScreeningQuestionText(fieldId) || fieldId; // fallback to field ID
    const formattedValue = formatScreeningQuestionWithNote(fieldId, observation);

    if (formattedValue) {
      renderFn(question, formattedValue);
    }
  });
}
