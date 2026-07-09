import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DataEntryTestItem } from 'utils';

interface InHouseLabSelectProps {
  availableTests: DataEntryTestItem[];
  selectedTestNames?: string[];
  onChange?: (newNames: string[]) => void;
  handleTestSelection?: (testName: string) => void;
}

export const InHouseLabSelect: React.FC<InHouseLabSelectProps> = ({
  availableTests,
  selectedTestNames,
  onChange,
  handleTestSelection,
}) => {
  const [pendingTestNames, setPendingTestNames] = useState<string[]>(selectedTestNames ?? []);

  useEffect(() => {
    if (selectedTestNames !== undefined) {
      setPendingTestNames(selectedTestNames);
    }
  }, [selectedTestNames]);

  if (selectedTestNames === undefined) {
    return (
      <FormControl
        fullWidth
        sx={{
          '& .MuiInputBase-root': { height: '40px' },
          '& .MuiSelect-select': { display: 'flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 },
        }}
      >
        <InputLabel
          id="test-type-label"
          sx={{
            transform: 'translate(14px, 10px) scale(1)',
            '&.MuiInputLabel-shrink': { transform: 'translate(14px, -9px) scale(0.75)' },
          }}
        >
          Test
        </InputLabel>
        <Select
          labelId="test-type-label"
          id="test-type"
          data-testid={dataTestIds.orderInHouseLabPage.testTypeField}
          value=""
          label="Test"
          onChange={(e) => handleTestSelection?.(e.target.value)}
          MenuProps={{ PaperProps: { 'data-testid': dataTestIds.orderInHouseLabPage.testTypeList } }}
        >
          {availableTests.map((test) => (
            <MenuItem key={`${test.name}-${test.adId}`} value={test.name}>
              {test.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <FormControl fullWidth>
      <InputLabel id="test-type-label">Test</InputLabel>
      <Select
        labelId="test-type-label"
        id="test-type"
        data-testid={dataTestIds.orderInHouseLabPage.testTypeField}
        multiple
        value={pendingTestNames}
        label="Test"
        onChange={(e) => {
          const value = e.target.value;
          setPendingTestNames(Array.isArray(value) ? value : [value]);
        }}
        onClose={() => onChange?.(pendingTestNames)}
        renderValue={(selected) =>
          selected.length === 0 ? '' : `${selected.length} test${selected.length > 1 ? 's' : ''} selected`
        }
        MenuProps={{
          autoFocus: false,
          disableAutoFocusItem: true,
          PaperProps: { 'data-testid': dataTestIds.orderInHouseLabPage.testTypeList },
        }}
      >
        {availableTests.map((test) => (
          <MenuItem key={`${test.name}-${test.adId}`} value={test.name}>
            <Checkbox checked={pendingTestNames.includes(test.name)} />
            <ListItemText primary={test.name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
