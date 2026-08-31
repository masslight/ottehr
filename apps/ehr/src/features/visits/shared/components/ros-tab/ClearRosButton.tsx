import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useRosObservations } from '../../hooks/useRosObservations';
import { ClearChartSectionButton } from '../ClearChartSectionButton';

/** Clears every Denies and Reports selection across all Review of Systems sections. */
export const ClearRosButton: FC = () => {
  const { observationMap, update, isLoading, isFieldPending } = useRosObservations();

  const selected = Object.values(observationMap).filter((observation) => observation.value === true);
  // `isLoading` only covers writes this component fired, so it says nothing about a row toggle or a
  // system "Select all" still in flight elsewhere. Clearing on top of one of those resolves
  // correctly through the hook's reconciliation, but the button should read as busy while it cannot
  // yet do the whole job.
  const isSelectionPending = selected.some((observation) => isFieldPending(observation.field));

  return (
    <ClearChartSectionButton
      label="Clear ROS"
      sectionName="Review of Systems"
      disabled={selected.length === 0 || isLoading || isSelectionPending}
      dataTestId={dataTestIds.reviewOfSystemsPage.clearRosButton}
      // useRosObservations turns a false value with a resourceId into a delete, which is exactly
      // what unchecking a single Denies / Reports box does.
      onClear={() => update(selected.map((observation) => ({ ...observation, value: false })))}
    />
  );
};
