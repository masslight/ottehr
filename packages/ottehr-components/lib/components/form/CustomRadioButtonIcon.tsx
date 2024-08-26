import { FC } from 'react';
import { PaletteColor } from '@mui/material';

type CustomRadioIconProps = {
  color: PaletteColor;
  checked: boolean;
  alt: string;
};

const CustomRadioButtonIcon: FC<CustomRadioIconProps> = ({
  color,
  checked,
  alt,
}: CustomRadioIconProps): JSX.Element => (
  <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label={alt}>
    <circle cx="12" cy="12.5" r="12" fill={checked ? color.main : color.contrastText} />
    <circle cx="12" cy="12.5" r="4" fill="white" />
  </svg>
);

export default CustomRadioButtonIcon;
