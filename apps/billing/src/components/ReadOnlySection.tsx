import { Add as AddIcon } from '@mui/icons-material';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';

// Table-header cell styling shared by the read-only tables on the detail screens.
export const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13 };

// Outlined card with a section heading; string children render as muted empty-state text.
export function ReadOnlySection({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: ReactNode;
  onAdd?: () => void;
}): ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
            {title}
          </Typography>
          {onAdd ? (
            <Button size="small" variant="contained" startIcon={<AddIcon fontSize="small" />} onClick={() => onAdd}>
              Add
            </Button>
          ) : (
            <></>
          )}
        </Box>
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
