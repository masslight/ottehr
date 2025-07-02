import { Autocomplete, Box, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { ExamFieldsNames, ExamObservationDTO } from 'utils';
import { useExamObservations } from '../../../../hooks/useExamObservations';
import { StatelessExamCheckbox } from './StatelessExamCheckbox';

export type ExamCheckboxDropdownOptionType = { label: string; name: ExamFieldsNames };

type ControlledExamCheckboxDropdownProps = {
  checkboxLabel?: string;
  dropdownLabel?: string;
  abnormal?: boolean;
  options: ExamCheckboxDropdownOptionType[];
  dropdownTestId?: string;
  checkboxBlockTestId?: string;
};

export const ControlledExamCheckboxDropdown: FC<ControlledExamCheckboxDropdownProps> = (props) => {
  const { checkboxLabel, dropdownLabel, abnormal, options, dropdownTestId, checkboxBlockTestId } = props;

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
      <Box data-testid={checkboxBlockTestId}>
        <StatelessExamCheckbox
          label={checkboxLabel}
          abnormal={abnormal}
          checked={booleanValue}
          onChange={onBooleanChange}
          disabled={isLoading}
        />
      </Box>
      <Autocomplete
        data-testid={dropdownTestId}
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
