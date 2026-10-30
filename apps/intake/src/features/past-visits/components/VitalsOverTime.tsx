import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { otherColors } from 'src/IntakeThemeProvider';
import { PastVisitVitals } from 'utils/lib/types/data/appointments/appointments.types';
import {
  buildVitalTrends,
  displayUnit,
  formatVitalDate,
  getLatestChange,
  VitalsUnitSystem,
  VitalTrend,
  VitalTrendPoint,
} from '../vitals-trend.helpers';
import { VitalTrendChart } from './VitalTrendChart';

interface VitalsOverTimeProps {
  vitals: PastVisitVitals[];
  onSelectVisit?: (appointmentId: string) => void;
}

export const VitalsOverTime = ({ vitals, onSelectVisit }: VitalsOverTimeProps): JSX.Element => {
  const [units, setUnits] = useState<VitalsUnitSystem>('us');
  const [showTable, setShowTable] = useState(false);
  const trends = useMemo(() => buildVitalTrends(vitals, units), [vitals, units]);

  return (
    <Box data-testid="vitals-over-time" sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h3" color="primary.main">
            Vitals over time
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Measured by your care team at completed visits.
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={units}
          onChange={(_, value: VitalsUnitSystem | null) => value && setUnits(value)}
          aria-label="Units"
        >
          <ToggleButton value="us" sx={{ px: 1.5, textTransform: 'none' }}>
            lb / ft
          </ToggleButton>
          <ToggleButton value="metric" sx={{ px: 1.5, textTransform: 'none' }}>
            kg / cm
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        {trends.map((trend) => (
          <VitalTrendCard
            key={trend.kind}
            trend={trend}
            unit={displayUnit(trend, units)}
            onSelectPoint={onSelectVisit ? (point) => onSelectVisit(point.appointmentId) : undefined}
          />
        ))}
      </Box>

      <Button
        size="small"
        sx={{ mt: 1, textTransform: 'none' }}
        onClick={() => setShowTable((current) => !current)}
        aria-expanded={showTable}
      >
        {showTable ? 'Hide table' : 'Show as table'}
      </Button>
      {showTable && <VitalsTable vitals={vitals} trends={trends} units={units} />}
    </Box>
  );
};

interface VitalTrendCardProps {
  trend: VitalTrend;
  unit: string;
  onSelectPoint?: (point: VitalTrendPoint) => void;
}

const VitalTrendCard = ({ trend, unit, onSelectPoint }: VitalTrendCardProps): JSX.Element => {
  const latest = trend.points[trend.points.length - 1];
  const change = getLatestChange(trend);

  return (
    <Box
      data-testid={`vital-trend-${trend.kind}`}
      sx={{
        border: '1px solid',
        borderColor: otherColors.borderGray,
        borderRadius: 2,
        backgroundColor: otherColors.white,
        p: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '140px minmax(0, 1fr)' },
        columnGap: 2,
        rowGap: 1,
        alignItems: 'center',
      }}
    >
      <Box>
        <Typography variant="subtitle1" color={otherColors.darkPurple}>
          {trend.title}
        </Typography>
        {latest ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.5 }}>
              <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }} color="text.primary">
                {latest.valueLabel}
              </Typography>
              {unit && (
                <Typography variant="body2" color="text.secondary">
                  {unit}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" component="p">
              {change
                ? `${formatChange(change.amount, trend, unit)} since ${change.sinceDateLabel}`
                : `Measured ${latest.dateLabel}`}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Not recorded at any of your visits yet.
          </Typography>
        )}
      </Box>
      {latest && (
        <VitalTrendChart points={trend.points} unit={unit} title={trend.title} onSelectPoint={onSelectPoint} />
      )}
    </Box>
  );
};

const formatChange = (amount: number, trend: VitalTrend, unit: string): string => {
  if (amount === 0) return 'No change';
  const direction = amount > 0 ? '▲' : '▼';
  // US heights are labeled in feet and inches, so their change reads in inches
  const changeUnit = unit || trend.unit;
  return `${direction} ${Math.abs(amount)} ${changeUnit}`;
};

interface VitalsTableProps {
  vitals: PastVisitVitals[];
  trends: VitalTrend[];
  units: VitalsUnitSystem;
}

const VitalsTable = ({ vitals, trends, units }: VitalsTableProps): JSX.Element => {
  const rows = [...vitals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const valueFor = (trend: VitalTrend, appointmentId: string): string => {
    const point = trend.points.find((candidate) => candidate.appointmentId === appointmentId);
    if (!point) return '—';
    const unit = displayUnit(trend, units);
    return unit ? `${point.valueLabel} ${unit}` : point.valueLabel;
  };

  return (
    <Box sx={{ overflowX: 'auto', mt: 1 }}>
      <Table size="small" aria-label="Vitals by visit">
        <TableHead>
          <TableRow>
            <TableCell>Visit date</TableCell>
            {trends.map((trend) => (
              <TableCell key={trend.kind} align="right">
                {trend.title}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((visit) => (
            <TableRow key={visit.appointmentId}>
              <TableCell>{formatVitalDate(visit.date, visit.timezone)}</TableCell>
              {trends.map((trend) => (
                <TableCell key={trend.kind} align="right">
                  {valueFor(trend, visit.appointmentId)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};
