import type { ExamCardComponent, ExamItemConfig } from 'config-types';
import { useMemo } from 'react';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';

function collectKnownFields(config: ExamItemConfig): Set<string> {
  const fields = new Set<string>();

  const extractFromComponents = (components: Record<string, ExamCardComponent>): void => {
    Object.entries(components).forEach(([key, component]) => {
      if (component.type === 'checkbox' || component.type === 'modal-exam') {
        fields.add(key);
      } else if (component.type === 'text') {
        fields.add(key);
      } else if (component.type === 'dropdown') {
        fields.add(key);
        Object.keys(component.components).forEach((optKey) => fields.add(optKey));
      } else if (component.type === 'column') {
        extractFromComponents(component.components);
      } else if (component.type === 'multi-select') {
        fields.add(key);
        Object.keys(component.options).forEach((optKey) => fields.add(optKey));
      } else if (component.type === 'form') {
        Object.keys(component.components).forEach((elemKey) => fields.add(elemKey));
      }
    });
  };

  Object.values(config).forEach((section) => {
    extractFromComponents(section.components.normal);
    extractFromComponents(section.components.abnormal);
    Object.keys(section.components.comment).forEach((key) => fields.add(key));
  });

  return fields;
}

export function useUnmatchedExamFields(config: ExamItemConfig): string[] {
  const examObservations = useExamObservationsStore();

  return useMemo(() => {
    const knownFields = collectKnownFields(config);
    return Object.keys(examObservations).filter(
      (field) => examObservations[field]?.value === true && !knownFields.has(field)
    );
  }, [config, examObservations]);
}
