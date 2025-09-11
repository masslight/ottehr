import React from 'react';
import { isPhoneNumberValid } from 'utils';
import InputMask from '../InputMask';
import { TextInput } from './TextInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  validate?: (value: string) => boolean | string;
};

export const PhoneInput: React.FC<Props> = ({ name, label, required, validate }) => {
  return (
    <TextInput
      name={name}
      label={label}
      required={required}
      inputProps={{ mask: '(000) 000-0000' }}
      InputProps={{
        inputComponent: InputMask as any,
      }}
      validate={(value: string) => {
        if (validate) {
          const result = validate(value);
          if (result !== true) {
            return result;
          }
        }
        if (value && !isPhoneNumberValid(value)) {
          return 'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number';
        }
        return true;
      }}
    />
  );
};
