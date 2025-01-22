import { Box, Button, FormControl, IconButton, InputAdornment, MenuItem, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { ClearIcon } from '@mui/x-date-pickers';
import { useLocationsOptions } from './useLocationsOptions';
import { PartialSearchOptionsState, SearchOptionsFilters } from './types';

export const PatientsSearchFilters: React.FC<{
  searchFilters: SearchOptionsFilters;
  setSearchField: ({ field, value }: { field: keyof SearchOptionsFilters; value: string }) => void;
  resetFilters: () => void;
  search: (overridedParams?: PartialSearchOptionsState) => void;
}> = ({ searchFilters, setSearchField, resetFilters: resetFilters, search }) => {
  const [showAdditionalSearch, setShowAdditionalSearch] = useState(true);
  const { location: locationOptions } = useLocationsOptions();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    search({ pagination: { offset: 0 } });
  };

  return (
    <FormControl component="form" onSubmit={handleSubmit} fullWidth>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          sx={{ flex: 1 }}
          label="Name"
          placeholder="Last, First, Middle"
          value={searchFilters.name}
          onChange={(e) => setSearchField({ field: 'name', value: e.target.value })}
        />
        <TextField
          sx={{ flex: 1 }}
          label="DOB"
          type="date"
          value={searchFilters.dob}
          onChange={(e) => setSearchField({ field: 'dob', value: e.target.value })}
          InputProps={{
            endAdornment: searchFilters.dob && (
              <InputAdornment position="end">
                <IconButton onClick={() => setSearchField({ field: 'dob', value: '' })} edge="end">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <Button
          type="button"
          onClick={() => setShowAdditionalSearch(!showAdditionalSearch)}
          startIcon={showAdditionalSearch ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          color="primary"
        >
          Additional search
        </Button>
      </Box>

      {showAdditionalSearch && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 3 }}>
          <TextField
            label="Phone"
            placeholder="(XXX) XX-XXXX"
            value={searchFilters.phone}
            onChange={(e) => setSearchField({ field: 'phone', value: e.target.value })}
          />
          <TextField
            label="Address"
            value={searchFilters.address}
            onChange={(e) => setSearchField({ field: 'address', value: e.target.value })}
          />
          <TextField
            label="Email"
            placeholder="example@mail.com"
            value={searchFilters.email}
            onChange={(e) => setSearchField({ field: 'email', value: e.target.value })}
          />
          {/* <TextField
                label="Subscriber Number (Insurance)"
                value={searchFilters.subscriberNumber}
                onChange={(e) => setSearchField({ field: 'subscriberNumber', value: e.target.value })}
              /> */}
          <FormControl fullWidth>
            <TextField
              select
              label="Status"
              value={searchFilters.status}
              onChange={(e) => setSearchField({ field: 'status', value: e.target.value })}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Deceased">Deceased</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </FormControl>
          <FormControl fullWidth>
            <TextField
              select
              label="Location"
              value={searchFilters.location}
              onChange={(e) => setSearchField({ field: 'location', value: e.target.value })}
            >
              <MenuItem value="All">All</MenuItem>
              {locationOptions.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </FormControl>
        </Box>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'end', gap: 3 }}>
        <Button type="button" onClick={resetFilters}>
          Reset filters
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SearchIcon />}
          type="submit"
          sx={{ mr: 1, borderRadius: 28 }}
        >
          Search
        </Button>
      </Box>
    </FormControl>
  );
};
