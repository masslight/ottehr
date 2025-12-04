import { Grid, InputProps, StandardTextFieldProps, TextField } from '@mui/material';
import { ChangeEvent, FC } from 'react';
import { OnValueChange, PatternFormat } from 'react-number-format';

interface FieldProps {
  displayPlaceholder: boolean;
  required: boolean;
  value: string | undefined;
  additionalProps?: StandardTextFieldProps;
  onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  dataTestId?: string;
}

interface PhoneNumberFieldProps extends FieldProps {
  error: boolean;
  onValueChange?: OnValueChange;
  inputProps?: InputProps;
}

interface AddVisitPatientSearchFieldsProps {
  firstName: FieldProps;
  lastName: FieldProps;
  phoneNumber: PhoneNumberFieldProps;
}

export const AddVisitPatientSearchFields: FC<AddVisitPatientSearchFieldsProps> = ({
  firstName,
  lastName,
  phoneNumber,
}) => {
  const phoneNumberErrorMessage = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';

  return (
    <>
      <Grid item xs={12} sm={6}>
        <TextField
          data-testid={lastName.dataTestId}
          fullWidth
          label="Last Name"
          placeholder={lastName.displayPlaceholder ? 'Doe' : undefined}
          value={lastName.value}
          onChange={lastName.onChange}
          {...(lastName.additionalProps ?? {})}
          required={lastName.required}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          data-testid={firstName.dataTestId}
          fullWidth
          label="Given Names"
          placeholder={firstName.displayPlaceholder ? 'John Henry' : undefined}
          value={firstName.value}
          onChange={firstName.onChange}
          {...(firstName.additionalProps ?? {})}
          required={firstName.required}
        />
      </Grid>

      <Grid item xs={12}>
        <PatternFormat
          data-testid={phoneNumber.dataTestId}
          customInput={TextField}
          value={phoneNumber.value}
          format="(###) ###-####"
          mask=" "
          label="Mobile Phone"
          variant="outlined"
          placeholder={phoneNumber.displayPlaceholder ? '(XXX) XXX-XXXX' : undefined}
          fullWidth
          error={phoneNumber.error}
          helperText={phoneNumber.error ? phoneNumberErrorMessage : ''}
          onValueChange={phoneNumber.onValueChange}
          InputProps={phoneNumber.inputProps}
          required={phoneNumber.required}
        />
      </Grid>
    </>
  );
};
