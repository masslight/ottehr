import { SxProps } from '@mui/system';

export interface ControlButtonsProps {
  submitLabel?: string;
  submitDisabled?: boolean;
  backButton?: boolean;
  backButtonLabel?: string;
  loading?: boolean;
  onBack?: () => void;
  onSubmit?: () => void;
}

export interface SelectInputOption {
  value: string;
  label: string;
}

export type RadioStyling = {
  radio?: SxProps;
  label?: SxProps;
  height?: string;
};
