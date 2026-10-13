import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import type { FetchPlanInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { noteManualEdit } from '../../llm/chat';
import { runReport, validatePlan } from '../../report/runner';
import { applyElements, suggestElements } from '../../report/trim';
import { statsById, useStudio } from '../../state/store';

const fmtBytes = (n: number): string =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

/** The fetch plan: per-step timings / counts / bytes / used-vs-fetched fields from the last run, trimming, and the JSON itself. */
export function PlanPanel(): React.ReactElement {
  const report = useStudio((s) => s.report);
  const run = useStudio((s) => s.run);
  const setReport = useStudio((s) => s.setReport);
  const addEvent = useStudio((s) => s.addEvent);
  const [text, setText] = useState(() => JSON.stringify(report.plan, null, 2));
  const [errors, setErrors] = useState<string[]>([]);

  // Outside changes (Claude, open file) refresh the editor; the user's own typing does not round-trip.
  useEffect(() => {
    setText(JSON.stringify(report.plan, null, 2));
    setErrors([]);
  }, [report.plan]);

  const stats = statsById(run);
  const profile = run.render?.profile;
  const suggestions = useMemo(() => suggestElements(report.plan, run), [report.plan, run]);
  const suggestionCount = Object.keys(suggestions).length;

  const apply = (): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      setErrors([`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`]);
      return;
    }
    const validated = validatePlan(parsed);
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors([]);
    setReport({ plan: validated.plan as FetchPlanInput });
    noteManualEdit('plan');
    addEvent('info', 'Plan edited by hand');
  };

  const trim = (): void => {
    const trimmed = applyElements(report.plan, suggestions);
    setReport({ plan: trimmed });
    addEvent(
      'info',
      `Trimmed ${suggestionCount} step(s) to the fields the code read`,
      Object.entries(suggestions)
        .map(([id, f]) => `${id}: ${f.join(', ')}`)
        .join('\n')
    );
    void runReport();
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', p: 2, gap: 2 }}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Steps
          </Typography>
          {run.fetch && (
            <Chip
              size="small"
              variant="outlined"
              label={`total ${run.fetch.totalMs} ms · ${fmtBytes(run.fetch.totalBytes)}`}
            />
          )}
          <Box sx={{ flex: 1 }} />
          {suggestionCount > 0 && (
            <Tooltip title="Set _elements on single-type steps to the top-level fields the report code read in the last run, then re-run">
              <Button variant="outlined" onClick={trim}>
                Trim {suggestionCount} step(s) to used fields
              </Button>
            </Tooltip>
          )}
        </Stack>
        <Table size="small" sx={{ '& td, & th': { py: 0.5, fontSize: 12.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Step</TableCell>
              <TableCell>Search</TableCell>
              <TableCell align="right">Time</TableCell>
              <TableCell align="right">Resources</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Fields used / fetched</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.plan.steps.map((step) => {
              const s = stats[step.id];
              const used = profile?.byStep[step.id]?.[step.resourceType];
              const fetchedFields = run.resources?.[step.id]?.find((r) => r.resourceType === step.resourceType);
              const fetchedCount = fetchedFields ? Object.keys(fetchedFields).length : undefined;
              const search = step.from
                ? `${step.from.param} ← ${step.from.step}.${step.from.path}${(step.params ?? []).length ? ' & ' : ''}${(
                    step.params ?? []
                  )
                    .map((p) => `${p.name}=${p.value}`)
                    .join('&')}`
                : (step.params ?? []).map((p) => `${p.name}=${p.value}`).join('&');
              return (
                <TableRow key={step.id} sx={{ bgcolor: s?.error ? '#fdecea' : undefined }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <b>{step.id}</b>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {step.resourceType}
                    </Typography>
                  </TableCell>
                  <TableCell
                    sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, wordBreak: 'break-all' }}
                  >
                    {search}
                    {step.elements && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'success.main' }}>
                        _elements={step.elements.join(',')}
                      </Typography>
                    )}
                    {s?.error && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                        {s.error}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{s ? `${s.ms} ms` : '—'}</TableCell>
                  <TableCell align="right">
                    {s ? s.count.toLocaleString() : '—'}
                    {s && Object.keys(s.byType).length > 1 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {Object.entries(s.byType)
                          .map(([t, n]) => `${t} ${n}`)
                          .join(', ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{s ? fmtBytes(s.bytes) : '—'}</TableCell>
                  <TableCell>
                    {s ? `${s.mode} · ${s.requests} req` : '—'}
                    {s?.scopedValues !== undefined && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {s.scopedValues} values
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {used ? (
                      <Tooltip title={used.join(', ')}>
                        <span>
                          {used.length} used{fetchedCount ? ` / ${fetchedCount} fetched` : ''}
                          {suggestions[step.id] && (
                            <Chip
                              size="small"
                              label="trim"
                              color="secondary"
                              variant="outlined"
                              sx={{ ml: 0.5, height: 18 }}
                            />
                          )}
                        </span>
                      </Tooltip>
                    ) : run.render?.profile ? (
                      <Typography variant="caption" color="text.secondary">
                        not read
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {profile && Object.values(profile.byType).some((p) => Object.keys(p.blank).length > 0) && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Mostly blank fields read by the code:{' '}
            {Object.entries(profile.byType)
              .flatMap(([type, p]) =>
                Object.entries(p.blank).map(([f, frac]) => `${type}.${f} (${Math.round(frac * 100)}%)`)
              )
              .join(', ')}
          </Alert>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 260, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Plan JSON
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" disabled={text === JSON.stringify(report.plan, null, 2)} onClick={apply}>
            Apply
          </Button>
        </Stack>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </Alert>
        )}
        <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <CodeMirror
            value={text}
            height="100%"
            style={{ height: '100%', fontSize: 12 }}
            extensions={[json()]}
            onChange={setText}
            basicSetup={{ foldGutter: true }}
          />
        </Box>
      </Box>
    </Box>
  );
}
