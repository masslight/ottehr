import { Checkbox, TableCell, TableRow, Typography } from '@mui/material';
import { FC, useCallback, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosCardItem } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosSelectAllRowProps {
  items: Record<string, RosCardItem>;
}

/**
 * "Denies everything in this system" row. Checking it denies every finding of the system and, like
 * checking a single Denies box, clears the paired Reports boxes; unchecking it clears the denials.
 */
export const RosSelectAllRow: FC<RosSelectAllRowProps> = ({ items }) => {
  const { observationMap, update, isLoading, isFieldPending } = useRosObservations();

  const baseKeys = useMemo(() => Object.keys(items), [items]);

  const deniedCount = baseKeys.filter(
    (baseKey) => observationMap[getRosFindingFieldKeys(baseKey).deniesKey]?.value === true
  ).length;
  const allDenied = baseKeys.length > 0 && deniedCount === baseKeys.length;

  // Locked while any of the system's findings has a request in flight, so a row toggle and this
  // bulk write can never race each other.
  const isSystemPending =
    isLoading ||
    baseKeys.some((baseKey) => {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
      return isFieldPending(deniesKey) || isFieldPending(reportsKey);
    });

  const onChange = useCallback(() => {
    const updates: ExamObservationDTO[] = [];

    baseKeys.forEach((baseKey) => {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
      const label = items[baseKey].label;
      const deniesObs = observationMap[deniesKey];
      const reportsObs = observationMap[reportsKey];

      if (allDenied) {
        updates.push({ field: deniesKey, label, value: false, resourceId: deniesObs?.resourceId });
        return;
      }

      if (deniesObs?.value !== true) {
        updates.push({ field: deniesKey, label, value: true, resourceId: deniesObs?.resourceId });
      }
      if (reportsObs?.value === true) {
        updates.push({ field: reportsKey, label, value: false, resourceId: reportsObs.resourceId });
      }
    });

    if (updates.length > 0) {
      update(updates);
    }
  }, [allDenied, baseKeys, items, observationMap, update]);

  return (
    <TableRow sx={{ '& td': { borderBottom: 'none', py: 0 } }}>
      <TableCell sx={{ pl: 1.5, pr: 0 }}>
        <Typography variant="body2" sx={{ fontSize: 13 }}>
          Select all
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 0 }} data-testid={dataTestIds.reviewOfSystemsPage.selectAllDeniesCell}>
        <Checkbox
          checked={allDenied}
          indeterminate={!allDenied && deniedCount > 0}
          onChange={onChange}
          disabled={isSystemPending}
          size="small"
          sx={{
            p: 0.25,
            color: 'success.light',
            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: 'success.main' },
          }}
        />
      </TableCell>
      <TableCell sx={{ px: 0 }} />
    </TableRow>
  );
};
