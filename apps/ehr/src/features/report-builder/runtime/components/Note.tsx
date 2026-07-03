import { Alert } from '@mui/material';
import React from 'react';

const SEVERITY = { info: 'info', warn: 'warning', success: 'success' } as const;

export interface NoteProps {
  children: React.ReactNode;
  tone?: keyof typeof SEVERITY;
}

/** A callout for disclosures: selection criteria, dropped metrics, approximations, empty states. */
export function Note({ children, tone = 'info' }: NoteProps): React.ReactElement {
  return (
    <Alert severity={SEVERITY[tone]} sx={{ mb: 1 }}>
      {children}
    </Alert>
  );
}
