import { Checkbox, TableCell, TableRow, Typography } from '@mui/material';
import { FC, useCallback } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getRosFindingFieldKeys } from 'utils/lib/ottehr-config/review-of-systems';
import { RosCardItem } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableRowProps {
  baseKey: string;
  item: RosCardItem;
}

export const RosTableRow: FC<RosTableRowProps> = (props) => {
  const { baseKey, item } = props;
  const { observationMap, update, isLoading, isFieldPending } = useRosObservations();

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
  // Checking either column may rewrite the other, so a request touching either field — including a
  // bulk "Select all" or "Clear ROS" fired elsewhere — locks the whole row.
  const isRowPending = isLoading || isFieldPending(deniesKey) || isFieldPending(reportsKey);

  return (
    // `data-chart-field` is a scroll ANCHOR, not a test hook: Easy Chart opens this table in a dialog from
    // a clicked note row and scrolls to the matching symptom. Exam rows are already addressable through
    // their keyed data-testids; ROS rows had nothing identifying the symptom, so this is the one attribute
    // that makes both sections reachable by the same lookup.
    <TableRow data-chart-field={baseKey} sx={{ '& td': { borderBottom: 'none', py: 0 } }}>
      {/* Indented one step past the section's "Select all" row, which the findings sit under. */}
      <TableCell sx={{ pl: 4, pr: 0 }}>
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
          disabled={isRowPending}
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
          disabled={isRowPending}
          size="small"
          sx={{ p: 0.25, color: 'error.light', '&.Mui-checked': { color: 'error.main' } }}
        />
      </TableCell>
    </TableRow>
  );
};
