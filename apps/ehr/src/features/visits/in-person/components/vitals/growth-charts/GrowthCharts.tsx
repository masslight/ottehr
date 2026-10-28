import { Alert, Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import React, { useId, useMemo, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import {
  ageMonthsAt,
  CHART_SETS,
  ChartDef,
  ChartRow,
  chartRows,
  ChartSet,
  ChartSetId,
  fmtAge,
  fmtDate,
  fmtPercentile,
  growthMeasurements,
  growthSexOf,
  isFullBirthDate,
  Measurement,
  ordinal,
  round,
  valueAtZ,
  zForPercentile,
} from './growthMath';
import { GrowthSex, LmsRow } from './growthTables';
import { useGrowthObservations } from './useGrowthObservations';

// ---- the chart (plain SVG so it reads like a clinical growth chart) ----
const CW = 660;
const CH = 420;
const PAD = { l: 52, r: 38, t: 14, b: 44 };
const PALETTE: Record<GrowthSex, { curve: string; mid: string; tint: string; point: string }> = {
  female: { curve: '#c2185b', mid: '#880e4f', tint: '#fdf6f9', point: '#0F347C' },
  male: { curve: '#1e6fd0', mid: '#0d3c8c', tint: '#f5f9fe', point: '#0F347C' },
};
const EHR_BLUE = '#2169F5';

function niceStep(span: number, target: number): number {
  const raw = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

interface Axis {
  min: number;
  max: number;
  minor: number;
  major: number;
  bold?: number;
  label: string;
  fmt: (v: number) => string;
}

function axisFor(set: ChartSet, chart: ChartDef): Axis {
  if (chart.x === 'length')
    return { min: 45, max: 110, minor: 1, major: 5, label: 'Length (cm)', fmt: (v) => String(v) };
  if (set.ageMax === 24) {
    return {
      min: 0,
      max: 24,
      minor: 1,
      major: 2,
      bold: 12,
      label: 'Age (months)',
      fmt: (v) => (v === 0 ? 'Birth' : String(v)),
    };
  }
  return { min: 24, max: 240, minor: 6, major: 12, label: 'Age (years)', fmt: (v) => String(v / 12) };
}

/** A row that has a point on the chart. */
type ScoredRow = ChartRow & { x: number; y: number; z: number };

interface HoverProps {
  hover: number | null;
  setHover: (row: number | null) => void;
}

interface GrowthChartProps extends HoverProps {
  set: ChartSet;
  chart: ChartDef;
  rows: ChartRow[];
  table: LmsRow[];
  sex: GrowthSex;
  thisVisitEnc?: string;
}

function GrowthChart({
  set,
  chart,
  rows,
  table,
  sex,
  thisVisitEnc,
  hover,
  setHover,
}: GrowthChartProps): React.ReactElement {
  const clipId = useId();
  const pal = PALETTE[sex];
  const xa = axisFor(set, chart);
  const tblRows = table.filter((r) => r[0] >= xa.min && r[0] <= xa.max);
  const curves = set.pcts.map((pct) => {
    const z = zForPercentile(pct);
    return { pct, pts: tblRows.map((r): [number, number] => [r[0], valueAtZ({ L: r[1], M: r[2], S: r[3] }, z)]) };
  });
  const shown = rows.filter(
    (r): r is ScoredRow => r.z !== undefined && r.x !== undefined && r.y !== undefined && r.x >= xa.min && r.x <= xa.max
  );
  const rowIndex = (r: ChartRow): number => rows.indexOf(r);
  const isThisVisit = (r: ChartRow): boolean => !!thisVisitEnc && r.m.enc === thisVisitEnc;
  const ys = curves[0].pts
    .map((p) => p[1])
    .concat(
      curves[curves.length - 1].pts.map((p) => p[1]),
      shown.filter((r) => r.plotted).map((r) => r.y)
    );
  const step = niceStep(Math.max(...ys) - Math.min(...ys), 9);
  const yMin = Math.floor(Math.min(...ys) / step) * step;
  const yMax = Math.ceil(Math.max(...ys) / step) * step;
  const minorY = step / (Math.round(step / Math.pow(10, Math.floor(Math.log10(step) + 1e-9))) === 2 ? 4 : 5);
  const pw = CW - PAD.l - PAD.r;
  const ph = CH - PAD.t - PAD.b;
  const sx = (x: number): number => PAD.l + ((x - xa.min) / (xa.max - xa.min)) * pw;
  const sy = (y: number): number => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * ph;
  const inY = (y: number): boolean => y >= yMin && y <= yMax;

  const grid: React.ReactElement[] = [];
  for (let x = xa.min; x <= xa.max + 1e-9; x += xa.minor) {
    const major = Math.abs((x - xa.min) % xa.major) < 1e-9 || Math.abs(((x - xa.min) % xa.major) - xa.major) < 1e-9;
    grid.push(
      <line
        key={'x' + x}
        x1={sx(x)}
        x2={sx(x)}
        y1={PAD.t}
        y2={PAD.t + ph}
        stroke={x === xa.bold ? '#b8c0cc' : major ? '#d9dee6' : '#eef1f5'}
        strokeWidth={x === xa.bold ? 1.2 : 1}
      />
    );
    if (major) {
      grid.push(
        <text key={'xl' + x} x={sx(x)} y={PAD.t + ph + 15} fontSize="10.5" textAnchor="middle" fill="#475569">
          {xa.fmt(Math.round(x * 100) / 100)}
        </text>
      );
    }
  }
  for (let i = 0; yMin + i * minorY <= yMax + 1e-9; i++) {
    const y = yMin + i * minorY;
    const major = Math.abs(y / step - Math.round(y / step)) < 1e-6;
    grid.push(
      <line key={'y' + i} x1={PAD.l} x2={PAD.l + pw} y1={sy(y)} y2={sy(y)} stroke={major ? '#d9dee6' : '#eef1f5'} />
    );
    if (major) {
      grid.push(
        <text key={'yl' + i} x={PAD.l - 6} y={sy(y) + 3.5} fontSize="10.5" textAnchor="end" fill="#475569">
          {round(y, 2)}
        </text>
      );
    }
  }

  // Curve labels at the right end, nudged apart so they never overlap.
  const labels = curves.map((c) => ({ pct: c.pct, y: sy(c.pts[c.pts.length - 1][1]) })).sort((a, b) => b.y - a.y);
  for (let i = 1; i < labels.length; i++) if (labels[i - 1].y - labels[i].y < 10) labels[i].y = labels[i - 1].y - 10;
  const line = shown.filter((r) => r.plotted).sort((a, b) => a.x - b.x);
  const path = (pts: [number, number][]): string =>
    pts.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
  const tip = hover != null ? shown.find((r) => rowIndex(r) === hover) : undefined;
  const tipY = tip ? sy(Math.min(yMax, Math.max(yMin, tip.y))) : 0;

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 760 }}>
      <svg
        viewBox={'0 0 ' + CW + ' ' + CH}
        width="100%"
        style={{ display: 'block', fontFamily: 'inherit' }}
        role="img"
        aria-label={chart.title + ' growth chart'}
      >
        <rect x={PAD.l} y={PAD.t} width={pw} height={ph} fill={pal.tint} />
        {grid}
        <rect x={PAD.l} y={PAD.t} width={pw} height={ph} fill="none" stroke="#9aa5b4" />
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={pw} height={ph} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {curves.map((c) => (
            <path
              key={c.pct}
              d={path(c.pts)}
              fill="none"
              stroke={c.pct === 50 ? pal.mid : pal.curve}
              strokeWidth={c.pct === 50 ? 2.2 : 1.1}
              strokeOpacity={c.pct === 50 ? 1 : 0.75}
            />
          ))}
          {line.length > 1 && (
            <path
              d={path(line.map((r) => [r.x, r.y]))}
              fill="none"
              stroke={pal.point}
              strokeWidth="1.1"
              strokeOpacity="0.8"
            />
          )}
        </g>
        {labels.map((l) => (
          <text
            key={l.pct}
            x={PAD.l + pw + 4}
            y={l.y + 3.5}
            fontSize="10"
            fontWeight={l.pct === 50 ? 700 : 400}
            fill={l.pct === 50 ? pal.mid : pal.curve}
          >
            {l.pct}
          </text>
        ))}
        {shown.map((r, i) => {
          const cx = sx(r.x);
          const cy = sy(Math.min(yMax, Math.max(yMin, r.y)));
          if (!inY(r.y)) {
            // off the chart: a red arrow at the edge, pointing the way
            const up = r.y > yMax;
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(rowIndex(r))}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={up ? 'M' + cx + ' ' + (cy + 1) + 'l-5 9h10z' : 'M' + cx + ' ' + (cy - 1) + 'l-5 -9h10z'}
                  fill="#d32f2f"
                />
                <circle cx={cx} cy={cy + (up ? 5 : -5)} r="9" fill="transparent" />
              </g>
            );
          }
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(rowIndex(r))}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              {r.plotted ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isThisVisit(r) ? 5.5 : hover === rowIndex(r) ? 5 : 3.6}
                  fill={isThisVisit(r) ? '#fff' : pal.point}
                  stroke={isThisVisit(r) ? EHR_BLUE : '#fff'}
                  strokeWidth={isThisVisit(r) ? 2.2 : 1.2}
                />
              ) : (
                <path d={'M' + (cx - 4) + ' ' + (cy - 4) + 'l8 8m0 -8l-8 8'} stroke="#d32f2f" strokeWidth="2" />
              )}
              <circle cx={cx} cy={cy} r="9" fill="transparent" />
            </g>
          );
        })}
        <text x={PAD.l + pw / 2} y={CH - 8} fontSize="11.5" textAnchor="middle" fill="#334155">
          {xa.label}
        </text>
        <text
          transform={'translate(13 ' + (PAD.t + ph / 2) + ') rotate(-90)'}
          fontSize="11.5"
          textAnchor="middle"
          fill="#334155"
        >
          {chart.yLabel}
        </text>
      </svg>
      {tip && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            pointerEvents: 'none',
            px: 1.25,
            py: 0.75,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            zIndex: 2,
            left: (sx(tip.x) / CW) * 100 + '%',
            top: (tipY / CH) * 100 + '%',
            transform: 'translate(' + (sx(tip.x) > CW * 0.7 ? 'calc(-100% - 12px)' : '12px') + ', -50%)',
          }}
        >
          <b>{fmtDate(tip.m.at)}</b> · {fmtAge(tip.m.ageMo)} · {round(tip.y, chart.digits)} {chart.unit}
          {chart.x === 'length' ? ' at ' + round(tip.x, 1) + ' cm' : ''}
          <br />
          {tip.plotted ? fmtPercentile(tip.z) + ' percentile' : '⚠ ' + tip.note}
        </Paper>
      )}
    </Box>
  );
}

// ---- the table beside it ----
const cellSx = { px: 1, py: 0.5, borderBottom: '1px solid #e5e7eb', textAlign: 'left', whiteSpace: 'nowrap' } as const;

interface GrowthTableProps extends HoverProps {
  set: ChartSet;
  chart: ChartDef;
  rows: ChartRow[];
  otherAges: number;
}

function GrowthTable({ set, chart, rows, otherAges, hover, setHover }: GrowthTableProps): React.ReactElement {
  const [all, setAll] = useState(false);
  const newest = rows.slice().reverse();
  const list = all ? newest : newest.slice(0, 10);
  return (
    <Box>
      {otherAges > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pb: 0.5 }}>
          {otherAges +
            ' measurement' +
            (otherAges === 1 ? ' is' : 's are') +
            ' outside ' +
            set.label.split(' (')[0].toLowerCase() +
            ' — see the other chart set.'}
        </Typography>
      )}
      <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'auto' }}>
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: 12.5,
            '& td:last-of-type, & th:last-of-type': { pr: 2 },
          }}
        >
          <thead>
            <tr>
              {['Date', 'Age', chart.x === 'length' ? 'Weight @ length' : 'Value', 'Percentile', 'z'].map((h) => (
                <Box
                  component="th"
                  key={h}
                  sx={{ ...cellSx, position: 'sticky', top: 0, background: '#f8fafc', fontWeight: 600 }}
                >
                  {h}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr
                key={i}
                onMouseEnter={() => setHover(rows.indexOf(r))}
                onMouseLeave={() => setHover(null)}
                style={{ background: hover === rows.indexOf(r) ? '#E2F0FF' : undefined }}
              >
                <Box component="td" sx={cellSx}>
                  {fmtDate(r.m.at)}
                </Box>
                <Box component="td" sx={cellSx}>
                  {fmtAge(r.m.ageMo)}
                </Box>
                <Box component="td" sx={cellSx}>
                  {(r.y === undefined ? '—' : round(r.y, chart.digits) + ' ' + chart.unit) +
                    (chart.x === 'length' && r.x !== undefined ? ' @ ' + round(r.x, 1) + ' cm' : '')}
                </Box>
                {r.plotted && r.z !== undefined ? (
                  <>
                    <Box component="td" sx={cellSx}>
                      {fmtPercentile(r.z)}
                    </Box>
                    <Box component="td" sx={cellSx}>
                      {r.z.toFixed(2)}
                    </Box>
                  </>
                ) : (
                  <Box
                    component="td"
                    colSpan={2}
                    sx={{
                      ...cellSx,
                      color: r.implausible || r.m.issue ? '#b91c1c' : 'text.secondary',
                      whiteSpace: 'normal',
                    }}
                  >
                    {(r.implausible || r.m.issue ? '⚠ ' : '') + r.note}
                  </Box>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <Box component="td" colSpan={5} sx={{ ...cellSx, color: 'text.secondary' }}>
                  No measurements in this age range.
                </Box>
              </tr>
            )}
          </tbody>
        </Box>
      </Box>
      {newest.length > 10 && !all && (
        <Button size="small" onClick={() => setAll(true)} sx={{ textTransform: 'none', mt: 0.5 }}>
          {'Show all (' + newest.length + ')'}
        </Button>
      )}
    </Box>
  );
}

interface GrowthCardProps {
  set: ChartSet;
  chart: ChartDef;
  growth: Measurement[];
  sex: GrowthSex;
  thisVisitEnc?: string;
}

function GrowthCard({ set, chart, growth, sex, thisVisitEnc }: GrowthCardProps): React.ReactElement {
  const [hover, setHover] = useState<number | null>(null);
  const { rows, otherAges, table } = chartRows(set, chart, growth, sex);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        {chart.title}
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <Box sx={{ flex: '3 1 520px', minWidth: 300 }}>
          <GrowthChart
            set={set}
            chart={chart}
            rows={rows}
            table={table}
            sex={sex}
            thisVisitEnc={thisVisitEnc}
            hover={hover}
            setHover={setHover}
          />
        </Box>
        <Box sx={{ flex: '2 1 300px', minWidth: 280 }}>
          <GrowthTable set={set} chart={chart} rows={rows} otherAges={otherAges} hover={hover} setHover={setHover} />
        </Box>
      </Stack>
    </Paper>
  );
}

interface GrowthChartsProps {
  patientId?: string;
  birthDate?: string;
  gender?: string;
  /** This visit: its points are marked. */
  encounterId?: string;
  /** This visit's date: the age shown and the chart set opened. */
  visitDate?: string;
}

/** WHO (0–24 months) and CDC (2–20 years) growth charts of the patient's weights and heights, with percentiles. */
export function GrowthCharts({
  patientId,
  birthDate,
  gender,
  encounterId,
  visitDate,
}: GrowthChartsProps): React.ReactElement {
  const { data: observations, isLoading, error } = useGrowthObservations(patientId);
  const fullBirthDate = isFullBirthDate(birthDate) ? birthDate : undefined;
  const sex = growthSexOf(gender);
  const growth = useMemo(
    () => (observations && fullBirthDate && sex ? growthMeasurements(observations, fullBirthDate, sex) : []),
    [observations, fullBirthDate, sex]
  );
  const ageNowMonths = fullBirthDate ? ageMonthsAt(fullBirthDate, visitDate || new Date().toISOString()) : undefined;
  const [setId, setSetId] = useState<ChartSetId>(ageNowMonths !== undefined && ageNowMonths < 24 ? 'who' : 'cdc');
  const [collapsed, setCollapsed] = useState(false);

  if (!fullBirthDate) return <Alert severity="info">No growth charts: the patient has no full date of birth.</Alert>;
  if (!sex) {
    return (
      <Alert severity="info">
        {'No growth charts: WHO and CDC charts are sex-specific and the patient’s sex is ' +
          (gender || 'not recorded') +
          '.'}
      </Alert>
    );
  }
  if (error) return <Alert severity="error">The growth charts could not be loaded: {error.message}</Alert>;
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const set = CHART_SETS[setId];
  const thisVisitEnc = encounterId ? 'Encounter/' + encounterId : undefined;
  return (
    <AccordionCard label="Growth charts" collapsed={collapsed} onSwitch={() => setCollapsed((c) => !c)}>
      <Box sx={{ p: 2 }}>
        <Tabs value={setId} onChange={(_, v: ChartSetId) => setSetId(v)} sx={{ minHeight: 36, mb: 1 }}>
          {(Object.keys(CHART_SETS) as ChartSetId[]).map((id) => (
            <Tab
              key={id}
              value={id}
              label={CHART_SETS[id].label}
              sx={{ textTransform: 'none', minHeight: 36, py: 0 }}
            />
          ))}
        </Tabs>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {(sex === 'female' ? 'Girls' : 'Boys') +
            ' · ' +
            (setId === 'who' ? 'WHO, birth–24 months' : 'CDC, 2–20 years') +
            ' · percentiles ' +
            ordinal(set.pcts[0]) +
            '–' +
            ordinal(set.pcts[set.pcts.length - 1]) +
            (visitDate && ageNowMonths !== undefined ? ' · age at this visit: ' + fmtAge(ageNowMonths) : '')}
        </Typography>
        <Stack spacing={2.5}>
          {set.charts.map((chart) => (
            <GrowthCard
              key={setId + chart.id}
              set={set}
              chart={chart}
              growth={growth}
              sex={sex}
              thisVisitEnc={thisVisitEnc}
            />
          ))}
        </Stack>
      </Box>
    </AccordionCard>
  );
}
