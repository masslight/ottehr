import React, { FC } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { IcdSearchResponse } from 'ehr-utils';

export type ICDSearchOption = {
  code: string;
  display: string;
};

type DiagnosesFieldProps = {
  onChange: (data: IcdSearchResponse['codes'][number]) => void;
  disableForPrimary: boolean;
  disabled?: boolean;
};

export const DiagnosesField: FC<DiagnosesFieldProps> = (props) => {
  const { onChange, disabled, disableForPrimary } = props;

  const icdSearchOptions = options;

  const onInternalChange = (_e: unknown, data: IcdSearchResponse['codes'][number] | null): void => {
    if (data) {
      onChange(data);
    }
  };

  return (
    <Autocomplete
      blurOnSelect
      disabled={disabled}
      options={icdSearchOptions}
      value={null}
      isOptionEqualToValue={(option, value) => value.code === option.code}
      onChange={onInternalChange}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      getOptionDisabled={(option) => disableForPrimary && option.code.startsWith('W')}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label="Search"
          placeholder="Diagnoses"
        />
      )}
    />
  );
};

const options: ICDSearchOption[] = [
  { display: 'Poisoning by opium, accidental (unintentional)', code: 'T40.0X1' },
  { display: 'Poisoning by heroin, accidental (unintentional)', code: 'T40.1X' },
  { display: 'Poisoning by other opioids, accidental (unintentional)', code: 'T40.2X1' },
  { display: 'Poisoning by methadone, accidental (unintentional)', code: 'T40.3X1' },
  { display: 'Poisoning by fentanyl, accidental (unintentional)', code: 'T40.411' },
  { display: 'Poisoning by cocaine, accidental (unintentional)', code: 'T40.5X1' },
  { display: 'Poisoning by narcotics, accidental (unintentional)', code: 'T40.601' },
  { display: 'Poisoning by other narcotics, accidental (unintentional)', code: 'T40.691' },
  { display: 'Opioid related disorders', code: 'F11' },
  { display: 'Opioid abuse', code: 'F11.1' },
  { display: 'Opioid dependence', code: 'F11.2' },
  { display: 'Opioid use, unspecified', code: 'F11.9' },
];
