import { StringFormat } from '../string-format';
import { SelectInputOption } from './select-input-option';
import { RadioOption, RadioStyling } from './radio.types';
import { TextFieldProps } from '@mui/material';
import { FormItemType } from 'ottehr-utils';

export type FormInputTypeField = {
  type: FormItemType;
  name: string;
  item?: FormInputTypeField[];
  format?: StringFormat;
  label?: string;
  enableWhen?: any;
  requireWhen?: any;
  infoTextSecondary?: string;
  width?: number;
  infoText?: string;
  freeSelectOptions?: string[];
  selectOptions?: SelectInputOption[];
  radioOptions?: RadioOption[];
  radioStyling?: RadioStyling;
  // fileOptions?: FileUploadOptions;
  // todo use type FileUploadOptions
  fileOptions?: any;
  borderColor?: string;
  borderSelected?: string;
  backgroundSelected?: string;
  hidden?: boolean;
  mask?: string;
  helperText?: string;
  onChange?: any;
  validationRegex?: RegExp;
  validationRegexError?: string;
  characterLimit?: number;
} & TextFieldProps;

export type FormInputTypeGroup = {
  type: FormItemType;
  name: string;
  label?: string;
  width?: number;
  hidden?: boolean;
  required?: boolean;
  helperText?: string;
  enableWhen?: any;
  requireWhen?: any;
  fieldMap: Record<string, string>;
  fields: FormInputTypeField[];
};

export type FormInputType = FormInputTypeField | FormInputTypeGroup;
