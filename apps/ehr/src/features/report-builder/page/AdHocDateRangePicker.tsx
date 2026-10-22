// The reports' date-range picker: a relative range, one custom day or a custom range — shared by the ad-hoc
// report builder and the system report viewer.
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, TextField } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { AdHocDateRangeFilter } from 'utils/lib/types/adhoc/query/date-range';

export function rangeFromControls(
  filter: AdHocDateRangeFilter,
  customDate: string,
  customStartDate: string,
  customEndDate: string
): { start: string; end: string } {
  const today = DateTime.now().setZone('America/New_York').startOf('day');
  switch (filter) {
    case 'today':
      return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'yesterday': {
      const y = today.minus({ days: 1 });
      return { start: y.toISO() ?? '', end: y.endOf('day').toISO() ?? '' };
    }
    case 'last-7-days':
      return { start: today.minus({ days: 6 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'last-30-days':
      return { start: today.minus({ days: 29 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'last-90-days':
      return { start: today.minus({ days: 89 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'last-365-days':
      return { start: today.minus({ days: 364 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'this-month':
      return { start: today.startOf('month').toISO() ?? '', end: today.endOf('month').toISO() ?? '' };
    case 'last-month': {
      const m = today.minus({ months: 1 });
      return { start: m.startOf('month').toISO() ?? '', end: m.endOf('month').toISO() ?? '' };
    }
    case 'this-year':
      return { start: today.startOf('year').toISO() ?? '', end: today.endOf('year').toISO() ?? '' };
    case 'last-year': {
      const y = today.minus({ years: 1 });
      return { start: y.startOf('year').toISO() ?? '', end: y.endOf('year').toISO() ?? '' };
    }
    case 'custom': {
      const d = DateTime.fromISO(customDate).setZone('America/New_York');
      return { start: d.startOf('day').toISO() ?? '', end: d.endOf('day').toISO() ?? '' };
    }
    case 'customRange': {
      const s = DateTime.fromISO(customStartDate).setZone('America/New_York');
      const e = DateTime.fromISO(customEndDate).setZone('America/New_York');
      return { start: s.startOf('day').toISO() ?? '', end: e.endOf('day').toISO() ?? '' };
    }
    default:
      return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
  }
}

export interface AdHocDateRangePickerProps {
  dateRange: AdHocDateRangeFilter;
  customDate: string;
  customStartDate: string;
  customEndDate: string;
  setDateRange: (dateRange: AdHocDateRangeFilter) => void;
  setCustomDate: (customDate: string) => void;
  setCustomStartDate: (customStartDate: string) => void;
  setCustomEndDate: (customEndDate: string) => void;
}

export function AdHocDateRangePicker(props: AdHocDateRangePickerProps): React.ReactElement {
  return (
    <>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="adhoc-date-range-label">Date Range</InputLabel>
        <Select
          labelId="adhoc-date-range-label"
          id="adhoc-date-range"
          value={props.dateRange}
          label="Date Range"
          onChange={(e: SelectChangeEvent<AdHocDateRangeFilter>) =>
            props.setDateRange(e.target.value as AdHocDateRangeFilter)
          }
        >
          <MenuItem value="today">Today</MenuItem>
          <MenuItem value="yesterday">Yesterday</MenuItem>
          <MenuItem value="last-7-days">Last 7 Days</MenuItem>
          <MenuItem value="last-30-days">Last 30 Days</MenuItem>
          <MenuItem value="last-90-days">Last 90 Days</MenuItem>
          <MenuItem value="last-365-days">Last 365 Days</MenuItem>
          <MenuItem value="this-month">This Month</MenuItem>
          <MenuItem value="last-month">Last Month</MenuItem>
          <MenuItem value="this-year">This Year</MenuItem>
          <MenuItem value="last-year">Last Year</MenuItem>
          <MenuItem value="custom">Custom Date</MenuItem>
          <MenuItem value="customRange">Custom Date Range</MenuItem>
        </Select>
      </FormControl>

      {props.dateRange === 'custom' && (
        <TextField
          type="date"
          size="small"
          value={props.customDate}
          onChange={(e) => props.setCustomDate(e.target.value)}
          sx={{ minWidth: 160 }}
          InputLabelProps={{ shrink: true }}
        />
      )}
      {props.dateRange === 'customRange' && (
        <>
          <TextField
            type="date"
            size="small"
            label="Start"
            value={props.customStartDate}
            onChange={(e) => props.setCustomStartDate(e.target.value)}
            sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            size="small"
            label="End"
            value={props.customEndDate}
            onChange={(e) => props.setCustomEndDate(e.target.value)}
            sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
          />
        </>
      )}
    </>
  );
}
