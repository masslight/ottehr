import { SvgIcon, SvgIconProps } from '@mui/material';
import { ReactElement } from 'react';

// Stylized female provider glyph (face framed by hair, shoulders, stethoscope on the torso).
export function DoctorIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <circle cx="12" cy="8.6" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.4 12.8V8.8a4.6 4.6 0 0 1 9.2 0v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 20.5a6.5 6.5 0 0 1 13 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.2 14.4v1.9a1.8 1.8 0 0 0 3.6 0v-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19.4" r="1.05" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </SvgIcon>
  );
}
