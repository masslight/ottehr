import { FC } from 'react';
import { ControlledExamCheckboxDropdown, ExamCheckboxDropdownOptionType } from './ControlledExamCheckboxDropdown';
import { examObservationFieldsDetailsArray } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';

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
      checkboxBlockTestId={dataTestIds.telemedEhrFlow.examTabField('non-tender-on-parental-exam')}
    />
  );
};
