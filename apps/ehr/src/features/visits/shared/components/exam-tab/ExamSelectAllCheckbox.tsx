import { Box } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { clearExamObservations } from './exam-selection-helpers';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

type ExamSelectAllCheckboxProps = {
  sectionKey: string;
  fields: string[];
};

/** Checks / unchecks every normal checkbox of one exam section in a single request. */
export const ExamSelectAllCheckbox: FC<ExamSelectAllCheckboxProps> = ({ sectionKey, fields }) => {
  const { value: observations, update, delete: deleteObservations, isLoading } = useExamObservations(fields);

  const checkedCount = observations.filter((observation) => observation?.value === true).length;
  const allChecked = fields.length > 0 && checkedCount === fields.length;

  const onChange = (checked: boolean): void => {
    if (checked) {
      const toCheck = observations
        .filter((observation) => observation?.value !== true)
        .map((observation) => ({ ...observation, value: true }));

      if (toCheck.length > 0) {
        update(toCheck);
      }
    } else {
      clearExamObservations(observations, deleteObservations);
    }
  };

  return (
    <Box>
      <StatelessExamCheckbox
        label="Select all"
        checked={allChecked}
        indeterminate={!allChecked && checkedCount > 0}
        onChange={onChange}
        disabled={isLoading}
        dataTestId={dataTestIds.examPage.selectAllNormalCheckbox(sectionKey)}
      />
    </Box>
  );
};
