import { SvgIcon, SvgIconProps } from '@mui/material';
import { ReactElement } from 'react';

// Single pill/capsule glyph — MUI ships no capsule icon (Medication is a bottle).
export function CapsuleIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <g transform="rotate(-45 12 12)">
        <path d="M12 8.5H9a3.5 3.5 0 0 0 0 7h3z" fill="currentColor" stroke="none" />
        <rect x="5.5" y="8.5" width="13" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </g>
    </SvgIcon>
  );
}
