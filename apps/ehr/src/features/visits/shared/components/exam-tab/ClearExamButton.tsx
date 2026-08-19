import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { ClearChartSectionButton } from '../ClearChartSectionButton';
import { clearExamObservations, hasClearableExamData } from './exam-selection-helpers';

/** Clears the whole exam: every selected finding and every provider comment, in every section. */
export const ClearExamButton: FC = () => {
  const { value: observations, delete: deleteObservations, isLoading } = useExamObservations();

  return (
    <ClearChartSectionButton
      label="Clear Exam"
      sectionName="Exam"
      disabled={!hasClearableExamData(observations) || isLoading}
      dataTestId={dataTestIds.examPage.clearExamButton}
      onClear={() => clearExamObservations(observations, deleteObservations, { includeNotes: true })}
    />
  );
};
