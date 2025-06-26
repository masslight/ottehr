// import { useFormContext } from 'react-hook-form';
import { LocalizationProvider, MobileDatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { DOB_DATE_FORMAT } from 'utils';
import { StyledQuestionnaireItem } from '../useStyleItems';

type DateInputProps = {
  item: StyledQuestionnaireItem;
  fieldId: string;
  onChange: (event: any) => void;
  value: string;
};

const DateInput: FC<DateInputProps> = ({ item, fieldId, value, onChange }) => {
  const disabled = item.displayStrategy === 'protected';

  // console.log('fieldId', fieldId, value);
  const inputValue = (() => {
    if (value) {
      return DateTime.fromFormat(value, DOB_DATE_FORMAT);
    } else {
      return null;
    }
  })();

  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <MobileDatePicker
        name={`${fieldId}.answer.0.valueString`}
        value={inputValue}
        disabled={disabled}
        onChange={onChange}
      />
    </LocalizationProvider>
  );
};

export default DateInput;
