import { FC, useState } from 'react';
import { Autocomplete, Box, TextField } from '@mui/material';
import { ExamFieldsNames, ExamObservationDTO } from 'ehr-utils';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';
import { useExamObservations } from '../../../../hooks/useExamObservations';

export type ExamCheckboxDropdownOptionType = { label: string; name: ExamFieldsNames };

type ControlledExamCheckboxDropdownProps = {
  checkboxLabel?: string;
  dropdownLabel?: string;
  abnormal?: boolean;
  options: ExamCheckboxDropdownOptionType[];
};

export const ControlledExamCheckboxDropdown: FC<ControlledExamCheckboxDropdownProps> = (props) => {
  const { checkboxLabel, dropdownLabel, abnormal, options } = props;

  const { value: fields, update, isLoading } = useExamObservations(options.map((option) => option.name));

  const [selectedOption, setSelectedOption] = useState<ExamCheckboxDropdownOptionType | null>(
    fields
      .filter((field) => field.value === true)
      .map((field) => options.find((option) => option.name === field.field))[0] || null
  );
  const [booleanValue, setBooleanValue] = useState(!!selectedOption);

  const onChange = (fieldsToChange: ExamObservationDTO[]): void => {
    update(fieldsToChange);
  };

  const onBooleanChange = (newValue: boolean): void => {
    if (!newValue) {
      setSelectedOption(null);
      if (selectedOption) {
        onChange(fields.map((field) => ({ ...field, value: false })));
      }
    }
    setBooleanValue(newValue);
  };

  const onOptionChange = (newValue: ExamCheckboxDropdownOptionType | null): void => {
    setBooleanValue(!!newValue);
    setSelectedOption(newValue);
    onChange(fields.map((field) => ({ ...field, value: field.field === newValue?.name })));
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <StatelessExamCheckbox
        label={checkboxLabel}
        abnormal={abnormal}
        checked={booleanValue}
        onChange={onBooleanChange}
        disabled={isLoading}
      />
      <Autocomplete
        disablePortal
        disabled={isLoading}
        options={options}
        value={selectedOption}
        onChange={(_e, newValue) => onOptionChange(newValue)}
        fullWidth
        renderInput={(params) => <TextField {...params} size="small" label={dropdownLabel} />}
      />
    </Box>
  );
};
