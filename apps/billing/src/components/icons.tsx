import { SvgIcon, SvgIconProps } from '@mui/material';
import { ReactElement } from 'react';

// Custom icons copied from the EHR's sidebarMenuIcons so shared concepts look
// the same in both apps. The EHR artwork uses non-24px grids, so each icon
// wraps SvgIcon with its original viewBox (createSvgIcon assumes 24x24).

// The EHR's 'Medical Conditions' icon — a medical-record sheet.
export function MedicalRecordIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 16 20">
      <path
        d="M4 17h8v-2H4v2Zm0-3h8v-2H4v2Zm4-3.7c1.1-1 2.042-1.888 2.825-2.663C11.608 6.864 12 6.05 12 5.2c0-.6-.217-1.117-.65-1.55A2.116 2.116 0 0 0 9.8 3c-.35 0-.688.07-1.013.212A2.02 2.02 0 0 0 8 3.8a2.02 2.02 0 0 0-.787-.587A2.508 2.508 0 0 0 6.2 3c-.6 0-1.117.217-1.55.65C4.217 4.083 4 4.6 4 5.2c0 .85.38 1.65 1.138 2.4.758.75 1.712 1.65 2.862 2.7Zm6 9.7H2c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h12c.55 0 1.02.196 1.412.587C15.804.979 16 1.45 16 2v16c0 .55-.196 1.02-.588 1.413A1.926 1.926 0 0 1 14 20ZM2 18h12V2H2v16Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

// The EHR's 'Progress Note' icon, used for its Review & Sign screen.
export function ProgressNoteIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 20 20">
      <path
        d="M15 15c.417 0 .77-.146 1.063-.438.291-.291.437-.645.437-1.062 0-.417-.146-.77-.438-1.063A1.446 1.446 0 0 0 15 12c-.417 0-.77.146-1.063.438A1.446 1.446 0 0 0 13.5 13.5c0 .417.146.77.438 1.063.291.291.645.437 1.062.437Zm0 3c.5 0 .967-.117 1.4-.35a3.011 3.011 0 0 0 1.075-.975 4.455 4.455 0 0 0-1.2-.512 5.048 5.048 0 0 0-2.55 0c-.417.108-.817.279-1.2.512.283.417.642.742 1.075.975.433.233.9.35 1.4.35ZM2 18c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 16V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h14c.55 0 1.02.196 1.413.588C17.803.979 18 1.45 18 2v6.7a8.189 8.189 0 0 0-.975-.387A6.101 6.101 0 0 0 16 8.075V2H2v14h6.05c.05.367.13.717.237 1.05.109.333.238.65.388.95H2Zm0-2V2v6.075V8v8Zm2-2h4.075c.05-.35.13-.692.238-1.025.108-.333.229-.658.362-.975H4v2Zm0-4h6.1c.533-.5 1.13-.917 1.787-1.25A7.041 7.041 0 0 1 14 8.075V8H4v2Zm0-4h10V4H4v2Zm11 14c-1.383 0-2.563-.488-3.537-1.462C10.488 17.562 10 16.383 10 15s.488-2.563 1.463-3.537C12.438 10.488 13.617 10 15 10s2.563.488 3.538 1.463C19.512 12.438 20 13.617 20 15s-.488 2.563-1.462 3.538C17.562 19.512 16.383 20 15 20Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
