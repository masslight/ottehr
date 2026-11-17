import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Chip,
  FormHelperText,
  List,
  ListItemButton,
  Paper,
  Stack,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { replaceTemplateVariablesHandlebars } from 'utils/lib/helpers/helpers';
import { buildInvoicePlaceholders } from 'utils/lib/helpers/rcm/invoice-config';
import { otherColors } from 'utils/lib/theme/billing-palette';
import { InvoiceSmsCounter } from './InvoiceSmsCounter';

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
  isSms?: boolean;
  // Real values for the preview. Sample values are used when this is not set.
  previewValues?: Record<string, string>;
}

function findPlaceholder(
  text: string,
  start: number,
  end: number
): { start: number; end: number; query: string; text: string } | null {
  if (start !== end) return null;
  const prefix = text.slice(0, start).match(/\{\{([a-z-]*)$/i);
  if (!prefix) return null;
  const suffix = text.slice(end).match(/^[a-z-]*\}\}/i)?.[0] ?? '';
  return { start: start - prefix[0].length, end: end + suffix.length, query: prefix[1], text };
}

export function InvoiceTemplateField({
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  disabled,
  isSms = false,
  previewValues,
}: InvoiceTemplateFieldProps): ReactElement {
  const [tab, setTab] = useState('write');
  const [cursor, setCursor] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof findPlaceholder>>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const helperId = useId();
  const listId = `${helperId}-suggestions`;
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const lastSelection = useRef<{ text: string; start: number; end: number } | null>(null);
  const activeSuggestion = !disabled && suggestion?.text === value ? suggestion : null;
  const matches = activeSuggestion
    ? Object.keys(PREVIEW_VALUES).filter((id) => id.includes(activeSuggestion.query.toLowerCase()))
    : [];
  useEffect(() => {
    if (error) setTab('write');
  }, [error]);
  useLayoutEffect(() => {
    if (cursor === null) return;
    textarea.current?.focus();
    textarea.current?.setSelectionRange(cursor, cursor);
    setCursor(null);
  }, [cursor, value]);

  const updateSuggestions = (): void => {
    const input = textarea.current;
    if (!input || document.activeElement !== input) return;
    const previous = lastSelection.current;
    if (
      previous?.text === input.value &&
      previous.start === input.selectionStart &&
      previous.end === input.selectionEnd
    )
      return;
    lastSelection.current = { text: input.value, start: input.selectionStart, end: input.selectionEnd };
    setSuggestion(findPlaceholder(input.value, input.selectionStart, input.selectionEnd));
    setSelectedIndex(0);
  };

  const insertToken = (id: string): void => {
    if (!textarea.current || disabled) return;
    const { selectionStart, selectionEnd } = textarea.current;
    const placeholder = activeSuggestion ?? findPlaceholder(value, selectionStart, selectionEnd);
    const start = placeholder?.start ?? selectionStart;
    const end = placeholder?.end ?? selectionEnd;
    const token = `{{${id}}}`;
    onChange(value.slice(0, start) + token + value.slice(end));
    setCursor(start + token.length);
    setSuggestion(null);
  };

  return (
    <Box role="group" aria-label={label} aria-describedby={error ? helperId : undefined}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: error ? 'error.main' : otherColors.lightDivider,
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
            <Box sx={{ position: 'relative' }}>
              <TextField
                value={value}
                onChange={(event) => {
                  onChange(event.target.value);
                  updateSuggestions();
                }}
                onBlur={() => {
                  setSuggestion(null);
                  lastSelection.current = null;
                  onBlur();
                }}
                inputRef={(element: HTMLTextAreaElement | null) => {
                  textarea.current = element;
                  inputRef(element);
                }}
                inputProps={{
                  'aria-label': label,
                  'aria-describedby': error ? helperId : undefined,
                  'aria-autocomplete': 'list',
                  'aria-controls': matches.length ? listId : undefined,
                  'aria-activedescendant': matches.length ? `${listId}-${selectedIndex}` : undefined,
                  onSelect: updateSuggestions,
                }}
                onKeyDown={(event) => {
                  if (
                    event.nativeEvent.isComposing ||
                    event.shiftKey ||
                    event.ctrlKey ||
                    event.altKey ||
                    event.metaKey ||
                    !matches.length
                  )
                    return;
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setSuggestion(null);
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedIndex(
                      (index) => (index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length
                    );
                  }
                  if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    insertToken(matches[selectedIndex]);
                  }
                }}
                multiline
                minRows={4}
                fullWidth
                size="small"
                disabled={disabled}
                error={error}
              />
              {matches.length > 0 && (
                <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1 }} elevation={4}>
                  <List id={listId} role="listbox" aria-label={`${label} placeholders`} dense disablePadding>
                    {matches.map((id, index) => (
                      <ListItemButton
                        key={id}
                        id={`${listId}-${index}`}
                        role="option"
                        tabIndex={-1}
                        selected={index === selectedIndex}
                        aria-selected={index === selectedIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertToken(id)}
                      >
                        {`{{${id}}}`}
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Type {'{{'} to insert a placeholder, or click one below
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
            {isSms && <InvoiceSmsCounter value={value} sampleValues={previewValues ?? PREVIEW_VALUES} />}
          </TabPanel>
          <TabPanel value="preview" sx={{ p: 2 }}>
            {!previewValues && (
              <Typography variant="caption" color="text.secondary">
                Preview uses sample values.
              </Typography>
            )}
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {replaceTemplateVariablesHandlebars(value, previewValues ?? PREVIEW_VALUES)}
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
