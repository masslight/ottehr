import {
  Box,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { ProviderVisitTypeSetting, ScheduleVisitType } from 'utils/lib/provider-schedule/types';

interface VisitTypeSettingsTableProps {
  visitTypes: ScheduleVisitType[];
  settings: ProviderVisitTypeSetting[];
  onChange: (settings: ProviderVisitTypeSetting[]) => void;
}

const parseOptionalInt = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Which visit types this provider sees, and how long each takes for them. Durations default to
 * the service's configured length (Admin → Services); an override applies to this provider only.
 */
export const VisitTypeSettingsTable: FC<VisitTypeSettingsTableProps> = ({ visitTypes, settings, onChange }) => {
  const settingFor = (id: string): ProviderVisitTypeSetting =>
    settings.find((s) => s.visitTypeId === id) ?? { visitTypeId: id, enabled: true };

  const update = (id: string, patch: Partial<ProviderVisitTypeSetting>): void => {
    const next = { ...settingFor(id), ...patch };
    const isDefault = next.enabled && next.durationMinutes === undefined && next.maxPerDay === undefined;
    const others = settings.filter((s) => s.visitTypeId !== id);
    onChange(isDefault ? others : [...others, next]);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Turn off visit types this provider doesn&apos;t see. Set a duration to override the practice default for this
        provider; slot counts on the template and calendar use it.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Visit type</TableCell>
              <TableCell align="center">Offered</TableCell>
              <TableCell align="right">Practice default</TableCell>
              <TableCell align="right" sx={{ width: 180 }}>
                Provider duration (min)
              </TableCell>
              <TableCell align="right" sx={{ width: 160 }}>
                Max per day
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visitTypes.map((vt) => {
              const s = settingFor(vt.id);
              return (
                <TableRow key={vt.id} sx={{ opacity: s.enabled ? 1 : 0.55 }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: vt.color }} />
                      {vt.name}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      checked={s.enabled}
                      onChange={(e) => update(vt.id, { enabled: e.target.checked })}
                      inputProps={{ 'aria-label': `${vt.name} offered` }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {vt.defaultDurationMinutes} min
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      disabled={!s.enabled}
                      value={s.durationMinutes ?? ''}
                      placeholder={String(vt.defaultDurationMinutes)}
                      onChange={(e) => update(vt.id, { durationMinutes: parseOptionalInt(e.target.value) })}
                      inputProps={{ min: 5, step: 5, 'aria-label': `${vt.name} duration` }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      disabled={!s.enabled}
                      value={s.maxPerDay ?? ''}
                      placeholder="No limit"
                      onChange={(e) => update(vt.id, { maxPerDay: parseOptionalInt(e.target.value) })}
                      inputProps={{ min: 1, 'aria-label': `${vt.name} max per day` }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
