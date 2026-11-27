import {
  alpha,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ReactElement } from 'react';
import { VitalAlertIcon } from 'src/features/visits/shared/components/vitals/components/VitalAlertIcon';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetMeasureKey } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { cellOf, FlowsheetCell, measureLabel, VisitColumn } from '../format';
import { FlowsheetMeasure } from '../registry';
import { VisitLink } from './VisitLink';

export interface FlowsheetHighlight {
  visitIndex: number;
  key: FlowsheetMeasureKey;
}

interface FlowsheetTableProps {
  rows: FlowsheetMeasure[];
  columns: VisitColumn[];
  unitSystem: VitalsHeaderUnitSystem;
  highlight: FlowsheetHighlight | null;
}

const FLAG_LABELS: Record<VitalAlertCriticality, string> = {
  [VitalAlertCriticality.Critical]: 'Critical',
  [VitalAlertCriticality.Abnormal]: 'Abnormal',
};

const FLAG_COLORS: Record<VitalAlertCriticality, string> = {
  [VitalAlertCriticality.Critical]: 'error.main',
  [VitalAlertCriticality.Abnormal]: 'warning.main',
};

const pinnedSx = { position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'background.paper', minWidth: 190 };

const CellValue = ({ cell }: { cell: FlowsheetCell }): ReactElement => (
  <>
    <Tooltip
      arrow
      placement="top"
      title={
        <Stack>
          {cell.hoverLines.map((line, index) => (
            <Typography key={index} variant="caption">
              {line}
            </Typography>
          ))}
        </Stack>
      }
    >
      <Box component="span">
        {cell.text}
        {cell.moreCount > 0 && (
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 'normal' }}>
            {` + ${cell.moreCount} more`}
          </Box>
        )}
      </Box>
    </Tooltip>
    {cell.flag && (
      <Tooltip title={FLAG_LABELS[cell.flag]}>
        <Box component="span" aria-label={FLAG_LABELS[cell.flag]}>
          <VitalAlertIcon criticality={cell.flag} />
        </Box>
      </Tooltip>
    )}
  </>
);

export const FlowsheetTable = ({ rows, columns, unitSystem, highlight }: FlowsheetTableProps): ReactElement => {
  const theme = useTheme();
  // Gradients over the cell's own background keep the sticky header and first column opaque.
  const overlay = (opacity: number): string => {
    const tint = alpha(theme.palette.primary.main, opacity);
    return `linear-gradient(${tint}, ${tint})`;
  };
  const columnSx = (visit: VisitColumn, isHighlighted: boolean): Record<string, unknown> => ({
    ...(visit.isCurrent ? { backgroundImage: overlay(0.1) } : {}),
    ...(isHighlighted
      ? { backgroundImage: overlay(0.25), boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}` }
      : {}),
  });

  return (
    <TableContainer
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', maxHeight: '60vh' }}
    >
      <Table stickyHeader size="small" sx={{ width: 'max-content', minWidth: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...pinnedSx, zIndex: 3, fontWeight: 700 }}>Measure</TableCell>
            {columns.map((visit, visitIndex) => {
              const isHighlighted = highlight?.visitIndex === visitIndex;
              return (
                <TableCell
                  key={visitIndex}
                  data-highlighted={isHighlighted || undefined}
                  sx={{
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'bottom',
                    ...columnSx(visit, isHighlighted),
                  }}
                >
                  {visit.isCurrent && (
                    <Typography variant="caption" display="block" color="primary.dark">
                      This visit
                    </Typography>
                  )}
                  <VisitLink visit={visit} />
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell component="th" scope="row" sx={{ ...pinnedSx, fontWeight: 600 }}>
                {measureLabel(row, unitSystem)}
              </TableCell>
              {columns.map((visit, visitIndex) => {
                const cell = cellOf(row, visit, unitSystem);
                const isHighlighted = highlight?.visitIndex === visitIndex && highlight.key === row.key;
                return (
                  <TableCell
                    key={visitIndex}
                    data-highlighted={isHighlighted || undefined}
                    sx={{
                      whiteSpace: 'nowrap',
                      color: cell?.flag ? FLAG_COLORS[cell.flag] : cell ? 'text.primary' : 'text.disabled',
                      fontWeight: cell?.flag ? 'bold' : undefined,
                      ...columnSx(visit, isHighlighted),
                    }}
                  >
                    {cell ? <CellValue cell={cell} /> : '-'}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
