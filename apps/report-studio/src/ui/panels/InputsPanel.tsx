import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import {
  DATE_RANGE_FILTER_LABELS,
  DATE_RANGE_FILTERS,
  DateRangeValue,
  DateRangeValueSchema,
  DEFAULT_DATE_RANGE,
  INPUT_KINDS,
  InputKind,
  inputValueMatches,
  ReportInput,
  validateInputs,
} from '../../report/inputs';
import { useStudio } from '../../state/store';

/** The EHR's date-range picker, as the system report viewer shows it: a preset, one custom day or a custom range. */
function DateRangeField({
  value,
  onChange,
}: {
  value: DateRangeValue | undefined;
  onChange: (value: DateRangeValue) => void;
}): React.ReactElement {
  const current = value ?? DEFAULT_DATE_RANGE;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Select
        size="small"
        value={current.preset}
        onChange={(e) => onChange({ ...current, preset: e.target.value as DateRangeValue['preset'] })}
        inputProps={{ 'aria-label': 'Date Range' }}
        sx={{ minWidth: 170 }}
      >
        {DATE_RANGE_FILTERS.map((f) => (
          <MenuItem key={f} value={f}>
            {DATE_RANGE_FILTER_LABELS[f]}
          </MenuItem>
        ))}
      </Select>
      {current.preset === 'custom' && (
        <TextField
          type="date"
          size="small"
          label="Date"
          InputLabelProps={{ shrink: true }}
          value={current.start ?? ''}
          onChange={(e) => onChange({ ...current, start: e.target.value })}
        />
      )}
      {current.preset === 'customRange' && (
        <>
          <TextField
            type="date"
            size="small"
            label="Start"
            InputLabelProps={{ shrink: true }}
            value={current.start ?? ''}
            onChange={(e) => onChange({ ...current, start: e.target.value })}
          />
          <TextField
            type="date"
            size="small"
            label="End"
            InputLabelProps={{ shrink: true }}
            value={current.end ?? ''}
            onChange={(e) => onChange({ ...current, end: e.target.value })}
          />
        </>
      )}
    </Stack>
  );
}

/** A JSON box for list / table / object values: applied when it parses, flagged while it does not. */
function JsonField({
  value,
  kind,
  onChange,
  label,
}: {
  value: unknown;
  kind: InputKind;
  onChange: (value: unknown) => void;
  label: string;
}): React.ReactElement {
  const [text, setText] = useState(value === undefined ? '' : JSON.stringify(value, null, 1));
  const [error, setError] = useState<string>();
  const apply = (next: string): void => {
    setText(next);
    if (!next.trim()) {
      setError(undefined);
      onChange(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(next);
      if (!inputValueMatches(kind, parsed)) throw new Error(`not a ${kind}`);
      setError(undefined);
      onChange(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <TextField
      multiline
      minRows={2}
      maxRows={6}
      size="small"
      fullWidth
      inputProps={{ 'aria-label': label, style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }}
      placeholder={kind === 'object' ? '{ … }' : '[ … ]'}
      value={text}
      onChange={(e) => apply(e.target.value)}
      error={!!error}
      helperText={error}
    />
  );
}

function ValueField({
  input,
  value,
  onChange,
}: {
  input: ReportInput;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.ReactElement {
  const label = `${input.name} value`;
  const placeholder = input.default !== undefined ? `default: ${JSON.stringify(input.default)}` : 'none';
  switch (input.kind) {
    case 'dateRange':
      return <DateRangeField value={DateRangeValueSchema.safeParse(value ?? input.default).data} onChange={onChange} />;
    case 'number':
      return (
        <TextField
          type="number"
          size="small"
          inputProps={{ 'aria-label': label }}
          placeholder={placeholder}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'date':
      return (
        <TextField
          type="date"
          size="small"
          inputProps={{ 'aria-label': label }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    case 'id':
    case 'text':
      return (
        <TextField
          size="small"
          fullWidth
          inputProps={{ 'aria-label': label }}
          placeholder={placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    default:
      return (
        <JsonField
          key={`${input.name}-${input.kind}`}
          value={value}
          kind={input.kind}
          onChange={onChange}
          label={label}
        />
      );
  }
}

const NEW_INPUT: ReportInput = { name: '', kind: 'text', required: true, description: '' };

/** The report's inputs and the test cases that give them values: what Run (and Claude's runs) use. */
export function InputsPanel(): React.ReactElement {
  const report = useStudio((s) => s.report);
  const setReport = useStudio((s) => s.setReport);
  const testCase = useStudio((s) => s.testCase);
  const setTestCase = useStudio((s) => s.setTestCase);
  const addEvent = useStudio((s) => s.addEvent);
  const [renaming, setRenaming] = useState<{ index: number; name: string }>();
  const [adding, setAdding] = useState<ReportInput & { defaultText: string }>();
  const [addError, setAddError] = useState<string[]>();

  const inputs = report.inputs ?? [];
  const testCases = report.testCases ?? [];
  const selected = testCases.find((t) => t.name === testCase);

  const setCases = (next: typeof testCases): void => setReport({ testCases: next });
  const newCase = (): void => {
    let n = testCases.length + 1;
    while (testCases.some((t) => t.name === `Test case ${n}`)) n += 1;
    const name = `Test case ${n}`;
    setCases([...testCases, { name, values: {} }]);
    setTestCase(name);
  };
  const rename = (index: number, name: string): void => {
    const trimmed = name.trim();
    setRenaming(undefined);
    if (!trimmed || testCases.some((t, i) => i !== index && t.name === trimmed)) return;
    setCases(testCases.map((t, i) => (i === index ? { ...t, name: trimmed } : t)));
    if (testCases[index].name === testCase) setTestCase(trimmed);
  };
  const remove = (index: number): void => {
    setCases(testCases.filter((_, i) => i !== index));
  };
  const setValue = (name: string, value: unknown): void => {
    if (!selected) return;
    const values = { ...selected.values };
    if (value === undefined) delete values[name];
    else values[name] = value;
    setCases(testCases.map((t) => (t === selected ? { ...t, values } : t)));
  };
  const addInput = (): void => {
    if (!adding) return;
    let def: unknown;
    if (adding.defaultText.trim()) {
      try {
        def =
          adding.kind === 'id' || adding.kind === 'text' || adding.kind === 'date'
            ? adding.defaultText
            : JSON.parse(adding.defaultText);
      } catch (e) {
        setAddError([`default: ${e instanceof Error ? e.message : String(e)}`]);
        return;
      }
    }
    const { defaultText: _text, ...input } = adding;
    const next: ReportInput = {
      ...input,
      description: input.description?.trim() || undefined,
      ...(def !== undefined ? { default: def } : {}),
    };
    const validated = validateInputs([...inputs, next]);
    if (!validated.ok) {
      setAddError(validated.errors);
      return;
    }
    setReport({ inputs: validated.inputs });
    addEvent('info', `Input "${next.name}" added`);
    setAdding(undefined);
    setAddError(undefined);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <Box sx={{ width: 220, flexShrink: 0, borderRight: 1, borderColor: 'divider', overflow: 'auto', p: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, px: 1, py: 0.5 }}>
          Test cases
        </Typography>
        <List dense disablePadding>
          {testCases.map((t, i) => (
            <ListItem
              key={t.name}
              disablePadding
              secondaryAction={
                <>
                  <Tooltip title="Rename">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={`Rename ${t.name}`}
                      onClick={() => setRenaming({ index: i, name: t.name })}
                    >
                      <EditOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" edge="end" aria-label={`Delete ${t.name}`} onClick={() => remove(i)}>
                      <DeleteOutlineIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </>
              }
            >
              {renaming?.index === i ? (
                <TextField
                  size="small"
                  autoFocus
                  value={renaming.name}
                  inputProps={{ 'aria-label': 'Test case name' }}
                  onChange={(e) => setRenaming({ index: i, name: e.target.value })}
                  onBlur={() => rename(i, renaming.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(i, renaming.name);
                    if (e.key === 'Escape') setRenaming(undefined);
                  }}
                  sx={{ pr: 7 }}
                />
              ) : (
                <ListItemButton
                  selected={t.name === testCase}
                  onClick={() => setTestCase(t.name)}
                  sx={{ borderRadius: 1, pr: 8 }}
                >
                  <ListItemText primary={t.name} primaryTypographyProps={{ noWrap: true }} />
                </ListItemButton>
              )}
            </ListItem>
          ))}
        </List>
        <Button size="small" startIcon={<AddIcon />} onClick={newCase} sx={{ mt: 0.5 }}>
          New test case
        </Button>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2 }}>
        {inputs.length === 0 ? (
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            This report declares no inputs. Add one when the code reads params.inputs.&lt;name&gt; or the plan uses{' '}
            {'{{patientId}}'} / the date templates.
          </Typography>
        ) : (
          <Table size="small" sx={{ '& td, & th': { py: 0.75, fontSize: 12.5, verticalAlign: 'top' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Input</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Needed</TableCell>
                <TableCell sx={{ width: '45%' }}>
                  {selected ? `Value in “${selected.name}”` : 'Value (select or add a test case)'}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inputs.map((input) => (
                <TableRow key={input.name}>
                  <TableCell>
                    <b>{input.name}</b>
                    {input.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {input.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{input.kind}</TableCell>
                  <TableCell>{input.required ? 'required' : 'optional'}</TableCell>
                  <TableCell>
                    {selected ? (
                      <ValueField
                        key={selected.name}
                        input={input}
                        value={selected.values[input.name]}
                        onChange={(v) => setValue(input.name, v)}
                      />
                    ) : input.default !== undefined ? (
                      <Typography variant="caption" color="text.secondary">
                        default: {JSON.stringify(input.default)}
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {adding ? (
          <Stack spacing={1} sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, maxWidth: 640 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="Name"
                value={adding.name}
                onChange={(e) => setAdding({ ...adding, name: e.target.value })}
              />
              <Select
                size="small"
                value={adding.kind}
                onChange={(e) => setAdding({ ...adding, kind: e.target.value as InputKind })}
                inputProps={{ 'aria-label': 'Kind' }}
              >
                {INPUT_KINDS.map((k) => (
                  <MenuItem key={k} value={k}>
                    {k}
                  </MenuItem>
                ))}
              </Select>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={adding.required}
                    onChange={(e) => setAdding({ ...adding, required: e.target.checked })}
                  />
                }
                label="Required"
              />
            </Stack>
            <TextField
              size="small"
              label="Description"
              value={adding.description ?? ''}
              onChange={(e) => setAdding({ ...adding, description: e.target.value })}
            />
            <TextField
              size="small"
              label="Default"
              placeholder={
                adding.kind === 'dateRange'
                  ? '{ "preset": "last-30-days" }'
                  : 'optional; JSON for number, list, table, object'
              }
              value={adding.defaultText}
              onChange={(e) => setAdding({ ...adding, defaultText: e.target.value })}
            />
            {addError && (
              <Typography variant="caption" color="error">
                {addError.join('; ')}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={addInput}>
                Add
              </Button>
              <Button
                onClick={() => {
                  setAdding(undefined);
                  setAddError(undefined);
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAdding({ ...NEW_INPUT, defaultText: '' })}
            sx={{ mt: 1 }}
          >
            Add input
          </Button>
        )}
      </Box>
    </Box>
  );
}
