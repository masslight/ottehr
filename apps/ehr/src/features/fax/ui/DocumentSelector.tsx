import {
  Box,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

/**
 * A row in the selector. Intentionally free of any fax vocabulary: the same component backs the
 * fax / email / print selectors on the "Discharge & More" screen.
 */
export interface DocumentSelectorRow {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  /** Tooltip shown on the label, typically explaining why the row is disabled. */
  hint?: string;
  /** Rendered indented underneath the row above it. */
  nested?: boolean;
}

export type DocumentSelectionMode = 'all' | 'selected';

interface DocumentSelectorProps {
  title: string;
  rows: DocumentSelectorRow[];
  mode: DocumentSelectionMode;
  onModeChange: (mode: DocumentSelectionMode) => void;
  onToggle: (id: string) => void;
  loading?: boolean;
  /** Disables the whole control, e.g. when there is nothing to send at all. */
  disabled?: boolean;
  allLabel?: string;
  selectedLabel?: string;
}

export const DocumentSelector: FC<DocumentSelectorProps> = ({
  title,
  rows,
  mode,
  onModeChange,
  onToggle,
  loading,
  disabled,
  allLabel = 'All visit documents',
  selectedLabel = 'Selected documents',
}) => {
  const theme = useTheme();

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color: theme.palette.primary.dark, fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>

      {loading ? (
        <Skeleton variant="rectangular" height={180} />
      ) : (
        <RadioGroup value={mode} onChange={(event) => onModeChange(event.target.value as DocumentSelectionMode)}>
          <FormControlLabel
            value="all"
            control={<Radio size="small" disabled={disabled} data-testid={dataTestIds.faxDialog.docModeAll} />}
            label={allLabel}
          />
          <FormControlLabel
            value="selected"
            control={<Radio size="small" disabled={disabled} data-testid={dataTestIds.faxDialog.docModeSelected} />}
            label={selectedLabel}
          />

          <Box sx={{ pl: 4, display: 'flex', flexDirection: 'column' }}>
            {rows.map((row) => (
              <Tooltip key={row.id} title={row.hint ?? ''} placement="right" disableHoverListener={!row.hint}>
                <span style={{ paddingLeft: row.nested ? 24 : 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={row.checked}
                        disabled={disabled || row.disabled}
                        onChange={() => onToggle(row.id)}
                        data-testid={`${dataTestIds.faxDialog.docCheckbox}-${row.id}`}
                      />
                    }
                    label={row.label}
                  />
                </span>
              </Tooltip>
            ))}
          </Box>
        </RadioGroup>
      )}
    </Box>
  );
};
