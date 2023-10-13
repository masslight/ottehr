import { ReactElement } from 'react';

export interface RadioOption {
  borderColor?: string;
  color?: string;
  description?: string | ReactElement;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  label?: string;
  value: string;
}
