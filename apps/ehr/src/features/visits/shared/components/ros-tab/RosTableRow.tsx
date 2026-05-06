import { Checkbox, TableCell, TableRow, Typography } from '@mui/material';
import { FC, useCallback, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExamObservationDTO, getRosFindingFieldKeys, RosCardItem } from 'utils';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableRowProps {
  baseKey: string;
  item: RosCardItem;
}

export const RosTableRow: FC<RosTableRowProps> = (props) => {
  const { baseKey, item } = props;
  const { value: allObservations, update, isLoading } = useRosObservations();

  const observationMap = useMemo(() => {
    return (allObservations as ExamObservationDTO[]).reduce(
      (map, obs) => {
        map[obs.field] = obs;
        return map;
      },
      {} as Record<string, ExamObservationDTO>
    );
  }, [allObservations]);

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

  const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
  const deniesObs = observationMap[deniesKey];
  const reportsObs = observationMap[reportsKey];
  const isDenied = deniesObs?.value === true;
  const isReported = reportsObs?.value === true;

  return (
    <TableRow sx={{ '& td': { borderBottom: 'none', py: 0 } }}>
      <TableCell sx={{ pl: 1.5, pr: 0 }}>
        <Typography variant="body2" sx={{ fontSize: 13 }}>
          {item.label}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 0 }} data-testid={dataTestIds.reviewOfSystemsPage.deniesCheckboxCell}>
        <Checkbox
          checked={isDenied}
          onChange={() =>
            isDenied
              ? handleUncheck(deniesKey, item.label, deniesObs?.resourceId)
              : handleCheck(deniesKey, item.label, reportsKey, deniesObs?.resourceId, reportsObs?.resourceId)
          }
          disabled={isLoading}
          size="small"
          sx={{ p: 0.25, color: 'success.light', '&.Mui-checked': { color: 'success.main' } }}
        />
      </TableCell>
      <TableCell align="center" sx={{ px: 0 }} data-testid={dataTestIds.reviewOfSystemsPage.reportsCheckboxCell}>
        <Checkbox
          checked={isReported}
          onChange={() =>
            isReported
              ? handleUncheck(reportsKey, item.label, reportsObs?.resourceId)
              : handleCheck(reportsKey, item.label, deniesKey, reportsObs?.resourceId, deniesObs?.resourceId)
          }
          disabled={isLoading}
          size="small"
          sx={{ p: 0.25, color: 'error.light', '&.Mui-checked': { color: 'error.main' } }}
        />
      </TableCell>
    </TableRow>
  );
};
