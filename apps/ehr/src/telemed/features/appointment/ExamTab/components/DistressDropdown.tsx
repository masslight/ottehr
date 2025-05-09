import { FC } from 'react';
import { ControlledExamCheckboxDropdown, ExamCheckboxDropdownOptionType } from './ControlledExamCheckboxDropdown';
import { examObservationFieldsDetailsArray } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';

const options: ExamCheckboxDropdownOptionType[] = examObservationFieldsDetailsArray
  .filter((details) => details.card === 'general' && details.group === 'dropdown')
  .map((details) => ({ label: details.label, name: details.field }));

export const DistressDropdown: FC = () => {
  return (
    <ControlledExamCheckboxDropdown
      abnormal
      checkboxLabel="Distress"
      dropdownLabel="Distress degree"
      options={options}
      dropdownTestId={dataTestIds.telemedEhrFlow.examTabDistressDropdown}
      checkboxBlockTestId={dataTestIds.telemedEhrFlow.examTabField('distress-none')}
    />
  );
};
