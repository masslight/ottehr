import { ReactElement } from 'react';

export interface RadioOption {
  label?: string;
  value: string;
  description?: string | ReactElement;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  color?: string;
}
