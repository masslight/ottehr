import {
  Box,
  Chip,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo, useState } from 'react';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import {
  buildVaccineScheduleView,
  VaccineScheduleLane,
  VaccineScheduleLevel,
  VaccineScheduleSource,
} from 'utils/lib/immunization-forecast/schedule-view';

type ScheduleTab = 'children' | 'adults' | 'seasonal';

const LEVEL_COLORS: Record<VaccineScheduleLevel, { bg: string; text: string }> = {
  Routine: { bg: '#C8E6C9', text: '#1B5E20' },
  'Shared decision': { bg: '#E2F0FF', text: '#0D47A1' },
  'Risk-based': { bg: '#FFE0B2', text: '#5F2B00' },
};

const formatDate = (iso: string): string => DateTime.fromISO(iso).toFormat(DATE_FORMAT);

/** "CDC CDSi Supporting Data 4.64, with AIRA … 26.1 for Influenza, COVID-19 and RSV". */
const sourcesText = (sources: VaccineScheduleSource[]): string => {
  const [main, ...others] = [...sources].sort((a, b) => b.antigens.length - a.antigens.length);
  const extras = others.map(
    (source) =>
      `${source.name} ${source.version} for ${source.antigens.slice(0, -1).join(', ')}${
        source.antigens.length > 1 ? ' and ' : ''
      }${source.antigens.slice(-1)}`
  );
  return `${main.name} ${main.version}${extras.length ? `, with ${extras.join('; ')}` : ''}`;
};

const LaneTable = ({ lane }: { lane: VaccineScheduleLane }): ReactElement => {
  const colors = LEVEL_COLORS[lane.level];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Typography variant="h6" color="primary.dark">
          {lane.label}
        </Typography>
        <Chip size="small" label={lane.level} sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 500 }} />
        <Typography variant="body2" color="text.secondary">
          {lane.seriesName} · Target: {lane.target}
        </Typography>
        {lane.guidance.length > 0 && (
          <Tooltip title={lane.guidance.join(' ')}>
            <Typography variant="body2" color="primary" sx={{ cursor: 'help' }}>
              Guidance
            </Typography>
          </Tooltip>
        )}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Dose</TableCell>
            <TableCell>Recommended age</TableCell>
            <TableCell>Minimum age</TableCell>
            <TableCell>Past due after</TableCell>
            <TableCell>Minimum interval</TableCell>
            <TableCell>Recommended interval</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lane.doses.map((dose, index) => (
            <TableRow key={`${dose.label}-${index}`}>
              <TableCell>{dose.label}</TableCell>
              <TableCell>{dose.recommendedAge ?? '—'}</TableCell>
              <TableCell>{dose.minAge ?? '—'}</TableCell>
              <TableCell>{dose.pastDueAge ?? '—'}</TableCell>
              <TableCell>{dose.minInterval ?? '—'}</TableCell>
              <TableCell>{dose.recommendedInterval ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

/** Admin › Clinical › Vaccine Schedule: a read-only reference built from the forecast engine's rules data. */
export const VaccineScheduleAdminPage = (): ReactElement => {
  const [tab, setTab] = useState<ScheduleTab>('children');
  const view = useMemo(() => buildVaccineScheduleView(), []);
  const lanes = tab === 'children' ? view.children : view.adults;

  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, value: ScheduleTab) => setTab(value)} aria-label="Vaccine schedule">
        <Tab label="Children" value="children" />
        <Tab label="Adults" value="adults" />
        <Tab label="Seasonal" value="seasonal" />
      </Tabs>
      <Typography variant="body2" color="text.secondary">
        {tab === 'children' &&
          `Childhood schedule from ${sourcesText(
            view.sources
          )}. Ages and intervals read as the data words them; the series listed is the one the forecast selects by default, and doses are shown as that series holds them.`}
        {tab === 'adults' &&
          `Adult schedule from ${view.sources[0].name} ${view.sources[0].version}: the series the data applies from adolescence on, and the boosters of the childhood series.`}
        {tab === 'seasonal' && 'Season dates from the rules data; they change with each data update, not per practice.'}
        {` Risk-based series need coded patient conditions and are not in the shipped data (version ${view.dataVersion}).`}
      </Typography>

      {tab === 'seasonal' ? (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vaccine</TableCell>
                <TableCell>Series</TableCell>
                <TableCell>Season start</TableCell>
                <TableCell>Season end</TableCell>
                <TableCell>Minimum age</TableCell>
                <TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {view.seasonal.map((row) => (
                <TableRow key={row.group}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{row.seriesName}</TableCell>
                  <TableCell>{row.seasonStart ? formatDate(row.seasonStart) : '—'}</TableCell>
                  <TableCell>{row.seasonEnd ? formatDate(row.seasonEnd) : 'Open'}</TableCell>
                  <TableCell>{row.minAge ?? '—'}</TableCell>
                  <TableCell>{row.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lanes.map((lane) => (
            <LaneTable key={lane.group} lane={lane} />
          ))}
        </Box>
      )}
    </Stack>
  );
};

export default VaccineScheduleAdminPage;
