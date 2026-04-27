import { Checkbox, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { FC, useCallback } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExamObservationDTO, getRosFindingFieldKeys, RosCard, RosItemConfig } from 'utils';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableProps {
  config: RosItemConfig;
}

const ROS_FINDING_CELL_STYLE = {
  fontWeight: 600,
  fontSize: 11,
  width: 32,
  py: 0.5,
  px: 0,
  borderBottom: '2px solid #e0e0e0',
};

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
      <Table size="small" sx={{ tableLayout: 'fixed' }} data-testid={dataTestIds.reviewOfSystemsPage.rosTable}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: 13, py: 0.5, borderBottom: '2px solid #e0e0e0' }}>
              {system.label}
            </TableCell>
            <TableCell
              align="center"
              sx={{
                ...ROS_FINDING_CELL_STYLE,
                color: 'success.main',
              }}
            >
              D
            </TableCell>
            <TableCell
              align="center"
              sx={{
                ...ROS_FINDING_CELL_STYLE,
                color: 'error.main',
              }}
            >
              R
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(system.items).map(([baseKey, item]) => {
            const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
            const deniesObs = observationMap[deniesKey];
            const reportsObs = observationMap[reportsKey];
            const isDenied = deniesObs?.value === true;
            const isReported = reportsObs?.value === true;

            return (
              <TableRow key={baseKey} sx={{ '& td': { borderBottom: 'none', py: 0 } }}>
                <TableCell sx={{ pl: 1.5, pr: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {item.label}
                  </Typography>
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ px: 0 }}
                  data-testid={dataTestIds.reviewOfSystemsPage.deniesCheckboxCell}
                >
                  <Checkbox
                    checked={isDenied}
                    onChange={() =>
                      isDenied
                        ? handleUncheck(deniesKey, item.label, deniesObs?.resourceId)
                        : handleCheck(deniesKey, item.label, reportsKey, deniesObs?.resourceId, reportsObs?.resourceId)
                    }
                    size="small"
                    sx={{ p: 0.25, color: 'success.light', '&.Mui-checked': { color: 'success.main' } }}
                  />
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ px: 0 }}
                  data-testid={dataTestIds.reviewOfSystemsPage.reportsCheckboxCell}
                >
                  <Checkbox
                    checked={isReported}
                    onChange={() =>
                      isReported
                        ? handleUncheck(reportsKey, item.label, reportsObs?.resourceId)
                        : handleCheck(reportsKey, item.label, deniesKey, reportsObs?.resourceId, deniesObs?.resourceId)
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
    <Grid container spacing={1} data-testid={dataTestIds.reviewOfSystemsPage.rosTableContainer}>
      {systems.map((system) => (
        <Grid item xs={4} key={system[0]}>
          {renderSystem(system)}
        </Grid>
      ))}
    </Grid>
  );
};
