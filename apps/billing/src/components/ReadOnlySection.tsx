import { Card, CardContent, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

// Table-header cell styling shared by the read-only tables on the detail screens.
export const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13 };

// Outlined card with a section heading; string children render as muted empty-state text.
export function ReadOnlySection({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {typeof children === 'string' ? (
          <Typography variant="body2" color="text.secondary">
            {children}
          </Typography>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
