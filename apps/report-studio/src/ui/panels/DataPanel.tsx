import {
  Box,
  Chip,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useStudio } from '../../state/store';

const MAX_SAMPLE = 5;

/** A look at the fetched resources: a few samples per step / type, and distinct values at a dot path. */
export function DataPanel(): React.ReactElement {
  const run = useStudio((s) => s.run);
  const steps = Object.keys(run.resources ?? {});
  const [step, setStep] = useState(steps[0] ?? '');
  const [type, setType] = useState('');
  const [path, setPath] = useState('');

  const current = steps.includes(step) ? step : steps[0] ?? '';
  const list = run.resources?.[current] ?? [];
  const types = useMemo(() => Array.from(new Set<string>(list.map((r) => r.resourceType))).sort(), [list]);
  const filtered = type && types.includes(type) ? list.filter((r) => r.resourceType === type) : list;

  const tally = useMemo(() => {
    if (!path.trim()) return null;
    const segments = path.split('.').filter(Boolean);
    const counts = new Map<string, number>();
    let blank = 0;
    const collect = (node: unknown, depth: number, out: string[]): void => {
      if (node == null) return;
      if (Array.isArray(node)) return node.forEach((n) => collect(n, depth, out));
      if (depth === segments.length)
        return void out.push(
          typeof node === 'object' ? JSON.stringify(node).slice(0, 100) : String(node).slice(0, 100)
        );
      if (typeof node === 'object') collect((node as Record<string, unknown>)[segments[depth]], depth + 1, out);
    };
    for (const r of filtered) {
      const values: string[] = [];
      collect(r, 0, values);
      if (!values.length) blank += 1;
      for (const v of new Set(values)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return {
      blank,
      rows: Array.from(counts, ([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 60),
    };
  }, [filtered, path]);

  if (!run.resources) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Run the report to see the fetched resources here.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Select size="small" value={current} onChange={(e) => setStep(e.target.value)} sx={{ minWidth: 160 }}>
          {steps.map((s) => (
            <MenuItem key={s} value={s}>
              {s} ({(run.resources?.[s] ?? []).length.toLocaleString()})
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={types.includes(type) ? type : ''}
          onChange={(e) => setType(e.target.value)}
          displayEmpty
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All types</MenuItem>
          {types.map((t) => (
            <MenuItem key={t} value={t}>
              {t} ({list.filter((r) => r.resourceType === t).length.toLocaleString()})
            </MenuItem>
          ))}
        </Select>
        <TextField
          size="small"
          placeholder="Distinct values at path, e.g. status or code.coding.display"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          sx={{ flex: 1, minWidth: 280 }}
        />
        <Chip size="small" variant="outlined" label={`${filtered.length.toLocaleString()} resources`} />
      </Stack>

      {tally && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {path}: {tally.rows.length} distinct value(s) shown
            {tally.blank ? `, blank on ${tally.blank.toLocaleString()} resource(s)` : ''}
          </Typography>
          <Table size="small" sx={{ maxWidth: 700, '& td, & th': { py: 0.4, fontSize: 12.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Value</TableCell>
                <TableCell align="right">Resources</TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tally.rows.map((r) => (
                <TableRow key={r.value}>
                  <TableCell
                    sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, wordBreak: 'break-all' }}
                  >
                    {r.value}
                  </TableCell>
                  <TableCell align="right">{r.count.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {filtered.length ? Math.round((r.count / filtered.length) * 100) : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Sample ({Math.min(MAX_SAMPLE, filtered.length)} of {filtered.length.toLocaleString()})
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Shown unredacted here (this is your instance); what Claude receives through inspect_data is redacted unless
          Settings allow otherwise.
        </Typography>
        {filtered.slice(0, MAX_SAMPLE).map((r, i) => (
          <Box
            key={`${r.resourceType}/${r.id}/${i}`}
            component="pre"
            sx={{
              m: 0,
              mt: 1,
              p: 1,
              fontSize: 11,
              lineHeight: 1.4,
              fontFamily: 'ui-monospace, Menlo, monospace',
              bgcolor: '#fafbfc',
              border: '1px solid #e6e9ef',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 360,
            }}
          >
            {JSON.stringify(r, null, 2)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
