import { ReactElement } from 'react';

export interface RadioOption {
  value: string;
  label?: string;
  description?: string | ReactElement;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  color?: string;
  borderColor?: string;
}
