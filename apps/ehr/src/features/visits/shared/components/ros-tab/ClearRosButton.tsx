import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useRosObservations } from '../../hooks/useRosObservations';
import { ClearChartSectionButton } from '../ClearChartSectionButton';

/** Clears every Denies and Reports selection across all Review of Systems sections. */
export const ClearRosButton: FC = () => {
  const { observationMap, update, isLoading } = useRosObservations();

  const selected = Object.values(observationMap).filter((observation) => observation.value === true);

  return (
    <ClearChartSectionButton
      label="Clear ROS"
      sectionName="Review of Systems"
      disabled={selected.length === 0 || isLoading}
      dataTestId={dataTestIds.reviewOfSystemsPage.clearRosButton}
      // useRosObservations turns a false value with a resourceId into a delete, which is exactly
      // what unchecking a single Denies / Reports box does.
      onClear={() => update(selected.map((observation) => ({ ...observation, value: false })))}
    />
  );
};
