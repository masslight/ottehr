import React, { FC } from 'react';
import { FormControl, Grid, InputLabel, MenuItem, Select } from '@mui/material';
import { DateTime } from 'luxon';
import { ApptTab, UnsignedFor } from '../../utils';
import { useTrackingBoardStore } from '../../state';
import { getSelectors } from '../../../shared/store/getSelectors';
import { StateSelect } from './StateSelect';
import DateSearch from '../../../components/DateSearch';

const selectOptions = [
  {
    label: 'Under 12 hours',
    value: UnsignedFor.under12,
  },
  {
    label: '12 - 24 hours',
    value: UnsignedFor['12to24'],
  },
  {
    label: 'More than 24 hours',
    value: UnsignedFor.more24,
  },
  {
    label: 'All',
    value: UnsignedFor.all,
  },
];

export const TrackingBoardFilters: FC<{ tab: ApptTab }> = (props) => {
  const { tab } = props;

  const { date, unsignedFor } = getSelectors(useTrackingBoardStore, ['date', 'unsignedFor']);

  const useDate = tab === ApptTab.complete;
  const useUnsigned = tab === ApptTab['not-signed'];

  return (
    <Grid container spacing={2} sx={{ padding: 2, paddingTop: 0 }}>
      <Grid item xs={6}>
        <StateSelect />
      </Grid>
      {useDate && (
        <Grid item xs={6}>
          <DateSearch
            label="Date"
            date={date}
            setDate={(date) => useTrackingBoardStore.setState({ date })}
            updateURL={false}
            storeDateInLocalStorage={false}
            defaultValue={DateTime.now().toLocaleString(DateTime.DATE_SHORT)}
          />
        </Grid>
      )}
      {useUnsigned && (
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel>Unsigned for</InputLabel>
            <Select
              value={unsignedFor}
              label="Unsigned for"
              onChange={(event) => useTrackingBoardStore.setState({ unsignedFor: event.target.value as UnsignedFor })}
            >
              {selectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      )}
    </Grid>
  );
};
