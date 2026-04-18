import { Checkbox, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { FC, useCallback } from 'react';
import { ExamObservationDTO, RosCard, RosItemConfig } from 'utils';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableProps {
  config: RosItemConfig;
}

const deniesField = (field: string): string => `${field}-denies`;
const reportsField = (field: string): string => `${field}-reports`;

export const RosTable: FC<RosTableProps> = ({ config }) => {
  const { value: allObservations, update } = useRosObservations();
  const observationMap = (allObservations as ExamObservationDTO[]).reduce(
    (map, obs) => {
      map[obs.field] = obs;
      return map;
    },
    {} as Record<string, ExamObservationDTO>
  );

  const handleCheck = useCallback(
    (field: string, label: string, pairedField: string, resourceId?: string, pairedResourceId?: string) => {
      const updates: ExamObservationDTO[] = [{ field, label, value: true, resourceId }];
      if (observationMap[pairedField]?.value) {
        updates.push({ field: pairedField, label, value: false, resourceId: pairedResourceId });
      }
      update(updates);
    },
    [update, observationMap]
  );

  const handleUncheck = useCallback(
    (field: string, label: string, resourceId?: string) => {
      update([{ field, label, value: false, resourceId }]);
    },
    [update]
  );

  const renderSystem = ([systemKey, system]: [string, RosCard]): React.ReactNode => (
    <Paper key={systemKey} variant="outlined" sx={{ height: '100%' }}>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: 13, py: 0.5, borderBottom: '2px solid #e0e0e0' }}>
              {system.label}
            </TableCell>
            <TableCell
              align="center"
              sx={{
                fontWeight: 600,
                fontSize: 11,
                color: 'success.main',
                width: 32,
                py: 0.5,
                px: 0,
                borderBottom: '2px solid #e0e0e0',
              }}
            >
              D
            </TableCell>
            <TableCell
              align="center"
              sx={{
                fontWeight: 600,
                fontSize: 11,
                color: 'error.main',
                width: 32,
                py: 0.5,
                px: 0,
                borderBottom: '2px solid #e0e0e0',
              }}
            >
              R
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(system.items).map(([fieldKey, item]) => {
            const dField = deniesField(fieldKey);
            const rField = reportsField(fieldKey);
            const deniesObs = observationMap[dField];
            const reportsObs = observationMap[rField];
            const isDenied = deniesObs?.value === true;
            const isReported = reportsObs?.value === true;

            return (
              <TableRow key={fieldKey} sx={{ '& td': { borderBottom: 'none', py: 0 } }}>
                <TableCell sx={{ pl: 1.5, pr: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {item.label}
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ px: 0 }}>
                  <Checkbox
                    checked={isDenied}
                    onChange={() =>
                      isDenied
                        ? handleUncheck(dField, item.label, deniesObs?.resourceId)
                        : handleCheck(dField, item.label, rField, deniesObs?.resourceId, reportsObs?.resourceId)
                    }
                    size="small"
                    sx={{ p: 0.25, color: 'success.light', '&.Mui-checked': { color: 'success.main' } }}
                  />
                </TableCell>
                <TableCell align="center" sx={{ px: 0 }}>
                  <Checkbox
                    checked={isReported}
                    onChange={() =>
                      isReported
                        ? handleUncheck(rField, item.label, reportsObs?.resourceId)
                        : handleCheck(rField, item.label, dField, reportsObs?.resourceId, deniesObs?.resourceId)
                    }
                    size="small"
                    sx={{ p: 0.25, color: 'error.light', '&.Mui-checked': { color: 'error.main' } }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );

  const systems = Object.entries(config);

  return (
    <Grid container spacing={1}>
      {systems.map((system) => (
        <Grid item xs={4} key={system[0]}>
          {renderSystem(system)}
        </Grid>
      ))}
    </Grid>
  );
};
