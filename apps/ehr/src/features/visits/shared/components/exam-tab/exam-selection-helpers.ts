import type { ExamCardComponent } from 'config-types';
import type { Delete } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

/**
 * Field names of the plain checkboxes in an exam column (recursing into `column` groups),
 * which are the only components a "Select all" can toggle without picking a value for the
 * provider. `legacy` checkboxes are excluded because ControlledExamCheckbox hides them
 * unless they are already set, so selecting them would write invisible findings.
 */
export const collectExamCheckboxFields = (components: Record<string, ExamCardComponent>): string[] => {
  const fields: string[] = [];

  Object.entries(components).forEach(([key, component]) => {
    if (component.type === 'checkbox') {
      if (!component.legacy) {
        fields.push(key);
      }
    } else if (component.type === 'column') {
      fields.push(...collectExamCheckboxFields(component.components));
    }
  });

  return fields;
};

const isSelected = (observation?: ExamObservationDTO): boolean => observation?.value === true;

const hasNote = (observation?: ExamObservationDTO): boolean => !!observation?.note?.trim();

/** Whether a "Clear Exam" would remove anything — a selected finding or a provider comment. */
export const hasClearableExamData = (observations: (ExamObservationDTO | undefined)[]): boolean =>
  observations.some((observation) => isSelected(observation) || hasNote(observation));

/**
 * Unsets every selected observation in `observations`, and their provider comments too when
 * `includeNotes` is set (a section's "Select all" only owns its checkboxes, a "Clear Exam" owns
 * everything).
 *
 * Deleting rather than saving as empty leaves a cleared exam with nothing behind it, mirroring what
 * unchecking a single checkbox does. `delete` blanks the store for everything handed to it and only
 * sends a request for the fields that have a resourceId, so fields whose save has yet to land need
 * no separate handling here.
 */
export const clearExamObservations = (
  observations: (ExamObservationDTO | undefined)[],
  deleteObservations: Delete,
  options: { includeNotes?: boolean } = {}
): void => {
  const cleared = observations.filter(
    (observation): observation is ExamObservationDTO =>
      isSelected(observation) || (!!options.includeNotes && hasNote(observation))
  );

  if (cleared.length > 0) {
    deleteObservations(cleared);
  }
};
