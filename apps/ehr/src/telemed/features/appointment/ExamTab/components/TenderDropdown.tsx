import { FC } from 'react';
import { examObservationFieldsDetailsArray } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { ControlledExamCheckboxDropdown, ExamCheckboxDropdownOptionType } from './ControlledExamCheckboxDropdown';

const options: ExamCheckboxDropdownOptionType[] = examObservationFieldsDetailsArray
  .filter((details) => details.card === 'abdomen' && details.group === 'dropdown')
  .map((details) => ({ label: details.label, name: details.field }));

export const TenderDropdown: FC = () => {
  return (
    <ControlledExamCheckboxDropdown
      abnormal
      checkboxLabel="Tender"
      dropdownLabel="Tender Location"
      options={options}
      dropdownTestId={dataTestIds.telemedEhrFlow.examTabTenderDropdown}
      checkboxBlockTestId={dataTestIds.telemedEhrFlow.examTabTenderCheckbox}
    />
  );
};
