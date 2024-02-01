import { FormItemType } from './form-item-type';
import { StringFormat } from '../string-format';
import { SelectInputOption } from './select-input-option';
import { RadioOption, RadioStyling } from './radio.types';
import { TextFieldProps } from '@mui/material';

export type FormInputType = {
  type: FormItemType;
  format?: StringFormat;
  name: string;
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
