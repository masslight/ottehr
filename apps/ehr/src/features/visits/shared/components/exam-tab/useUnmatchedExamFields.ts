import type { ExamItemConfig } from 'config-types';
import { useMemo } from 'react';
import { collectKnownExamFields } from 'utils';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';

export function useUnmatchedExamFields(config: ExamItemConfig): string[] {
  const examObservations = useExamObservationsStore();

  return useMemo(() => {
    const knownFields = collectKnownExamFields(config);
    return Object.keys(examObservations).filter(
      (field) => examObservations[field]?.value === true && !knownFields.has(field)
    );
  }, [config, examObservations]);
}
