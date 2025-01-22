import { SxProps } from '@mui/material';
import { ReactElement } from 'react';

export type RadioStyling = {
  radio?: SxProps;
  label?: SxProps;
  height?: string;
};

export interface RadioOption {
  label?: string;
  value: string;
  description?: string | ReactElement;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  color?: string;
}
