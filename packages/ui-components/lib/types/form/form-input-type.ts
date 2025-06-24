import { TextFieldProps } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { FormItemType } from 'utils';
import { StringFormat } from '../string-format';
import { RadioOption, RadioStyling } from './radio.types';
import { SelectInputOption } from './select-input-option';

export type FormInputTypeField = {
  type: FormItemType;
  name: string;
  item?: FormInputTypeField[];
  format?: StringFormat;
  label?: string;
  enableWhen?: any;
  requireWhen?: any;
  disableWhen?: any;
  readOnlyValue?: string;
  infoTextSecondary?: string;
  width?: number;
  infoText?: string;
  autoComplete?: string;
  freeSelectOptions?: SelectInputOption[] | string[];
  freeSelectMultiple?: boolean;
  submitOnChange?: boolean;
  disableError?: boolean;
  freeSelectFreeSolo?: boolean;
  virtualization?: boolean;
  selectOptions?: SelectInputOption[];
  radioOptions?: RadioOption[];
  radioStyling?: RadioStyling;
  // fileOptions?: FileUploadOptions;
  // todo use type FileUploadOptions
  fileOptions?: any;
  fileUploadType?: string;
  borderColor?: string;
  borderSelected?: string;
  backgroundSelected?: string;
  hidden?: boolean;
  mask?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  onChange?: any;
  validationRegex?: RegExp;
  validationRegexError?: string;
  characterLimit?: number;
  description?: ReactElement;
  buttonProps?: {
    onClick?: () => void;
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    startIcon?: ReactNode;
  };
  maxCharacters?: {
    totalCharacters: number;
    displayCharCount: number;
  };
} & TextFieldProps;

export type FormInputTypeGroup = {
  type: FormItemType;
  name: string;
  label?: string;
  width?: number;
  hidden?: boolean;
  required?: boolean;
  helperText?: string;
  showHelperTextIcon?: boolean;
  enableWhen?: any;
  requireWhen?: any;
  fieldMap: Record<string, string>;
  fields: FormInputTypeField[];
};

export type FormInputType = FormInputTypeField | FormInputTypeGroup;

export type OverrideValues = Record<string, string | undefined>;
