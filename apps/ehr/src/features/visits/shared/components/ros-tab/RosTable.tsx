import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FC, useCallback } from 'react';
import { ExamObservationDTO, RosCard, RosItemConfig } from 'utils';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableProps {
  config: RosItemConfig;
}

// Each ROS item has two fields: one for "denies" (normal) and one for "reports" (abnormal)
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
      // Uncheck the paired field if it was checked
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

  return (
    <Box>
      {Object.entries(config).map(([systemKey, system]: [string, RosCard]) => (
        <Accordion key={systemKey} defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#F5F5F5', borderRadius: '4px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {system.label}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: '60%' }}>Finding</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: '20%', color: 'success.main' }}>
                    Denies
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: '20%', color: 'error.main' }}>
                    Reports
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
                    <TableRow key={fieldKey} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 13 }}>
                          {item.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0 }}>
                        <Checkbox
                          checked={isDenied}
                          onChange={() =>
                            isDenied
                              ? handleUncheck(dField, item.label, deniesObs?.resourceId)
                              : handleCheck(dField, item.label, rField, deniesObs?.resourceId, reportsObs?.resourceId)
                          }
                          size="small"
                          sx={{ color: 'success.light', '&.Mui-checked': { color: 'success.main' } }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0 }}>
                        <Checkbox
                          checked={isReported}
                          onChange={() =>
                            isReported
                              ? handleUncheck(rField, item.label, reportsObs?.resourceId)
                              : handleCheck(rField, item.label, dField, reportsObs?.resourceId, deniesObs?.resourceId)
                          }
                          size="small"
                          sx={{ color: 'error.light', '&.Mui-checked': { color: 'error.main' } }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
