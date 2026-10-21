import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Chip, FormHelperText, Stack, Tab, TextField, Typography } from '@mui/material';
import { ReactElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { replaceTemplateVariablesHandlebars } from 'utils/lib/helpers/helpers';
import { buildInvoicePlaceholders } from 'utils/lib/helpers/rcm/invoice-config';

const PREVIEW_VALUES = buildInvoicePlaceholders({
  patientFullName: 'Jane Smith',
  clinic: 'Ottehr Clinic',
  location: 'Washington, DC',
  visitDate: '2026-03-15',
  dueDate: '2026-03-29',
  amountCents: 12500,
  invoiceLink: 'https://payments.ottehr.com/inv/abc123',
  patientPortalLink: 'https://patient.ottehr.com/',
});

interface InvoiceTemplateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: (element: HTMLTextAreaElement | null) => void;
  error: boolean;
  disabled: boolean;
}

export function InvoiceTemplateField({
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  disabled,
}: InvoiceTemplateFieldProps): ReactElement {
  const [tab, setTab] = useState('write');
  const [cursor, setCursor] = useState<number | null>(null);
  const helperId = useId();
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (error) setTab('write');
  }, [error]);
  useLayoutEffect(() => {
    if (cursor === null) return;
    textarea.current?.focus();
    textarea.current?.setSelectionRange(cursor, cursor);
    setCursor(null);
  }, [cursor, value]);

  const insertToken = (id: string): void => {
    if (!textarea.current || disabled) return;
    const { selectionStart, selectionEnd } = textarea.current;
    const token = `{{${id}}}`;
    onChange(value.slice(0, selectionStart) + token + value.slice(selectionEnd));
    setCursor(selectionStart + token.length);
  };

  return (
    <Box role="group" aria-label={label} aria-describedby={error ? helperId : undefined}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        <TabContext value={tab}>
          <TabList onChange={(_, next: string) => setTab(next)} aria-label={`${label} tabs`}>
            <Tab label="Write" value="write" disabled={disabled} />
            <Tab label="Preview" value="preview" disabled={disabled} />
          </TabList>
          <TabPanel value="write" sx={{ p: 2 }}>
            <TextField
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              inputRef={(element: HTMLTextAreaElement | null) => {
                textarea.current = element;
                inputRef(element);
              }}
              inputProps={{ 'aria-label': label, 'aria-describedby': error ? helperId : undefined }}
              multiline
              minRows={4}
              fullWidth
              disabled={disabled}
              error={error}
            />
            <Typography variant="caption" color="text.secondary">
              Insert a placeholder:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {Object.keys(PREVIEW_VALUES).map((id) => (
                <Chip
                  key={id}
                  component="button"
                  type="button"
                  label={`{{${id}}}`}
                  size="small"
                  color="info"
                  variant="outlined"
                  disabled={disabled}
                  onClick={() => insertToken(id)}
                />
              ))}
            </Stack>
          </TabPanel>
          <TabPanel value="preview" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Preview uses sample values.
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {replaceTemplateVariablesHandlebars(value, PREVIEW_VALUES)}
            </Typography>
          </TabPanel>
        </TabContext>
        {error && (
          <FormHelperText error id={helperId} sx={{ mx: 2, mb: 1 }}>
            {label} is required
          </FormHelperText>
        )}
      </Box>
    </Box>
  );
}
