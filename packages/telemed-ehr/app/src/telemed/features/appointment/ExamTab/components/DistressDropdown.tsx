import { FC } from 'react';
import { examObservationFieldsDetailsArray } from '../../../../utils';
import { ControlledExamCheckboxDropdown, ExamCheckboxDropdownOptionType } from './ControlledExamCheckboxDropdown';

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
    />
  );
};
