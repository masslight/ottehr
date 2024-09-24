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
  <svg width="24" height="25" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label={alt}>
    {checked ? (
      <>
        <circle cx="12" cy="12.5" r="12" fill={color.main} />
        <circle cx="12" cy="12.5" r="4" fill="white" />
      </>
    ) : (
      <circle cx="12" cy="12.5" r="11.5" fill="white" stroke="#C3C9D2" />
    )}
  </svg>
);

export default CustomRadioButtonIcon;
