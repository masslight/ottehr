import { Box, Button, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';

export interface DiagnosisRow {
  code: string;
  display: string;
}

export const emptyDiagnosisRow = (): DiagnosisRow => ({ code: '', display: '' });

interface DiagnosesEditorProps {
  value: DiagnosisRow[];
  onChange: (rows: DiagnosisRow[]) => void;
}

/**
 * Controlled editor for a claim's diagnosis list. Shared by the create-claim form and the
 * claim-detail edit experience so the two stay identical. Diagnosis order is the 1-based
 * `diagnosisSequence` that service lines point at — see {@link ServiceLinesEditor}.
 */
export function DiagnosesEditor({ value, onChange }: DiagnosesEditorProps): ReactElement {
  const setRow = (index: number, field: keyof DiagnosisRow, fieldValue: string): void =>
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 680 }}>
      {value.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 16 }}>
            {i + 1}
          </Typography>
          <TextField
            size="small"
            label="ICD-10"
            value={row.code}
            onChange={(e) => setRow(i, 'code', e.target.value)}
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            label="Description"
            fullWidth
            value={row.display}
            onChange={(e) => setRow(i, 'display', e.target.value)}
          />
          <Button size="small" color="error" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </Box>
      ))}
      <Box>
        <Button size="small" onClick={() => onChange([...value, emptyDiagnosisRow()])}>
          + Add diagnosis
        </Button>
      </Box>
    </Box>
  );
}
