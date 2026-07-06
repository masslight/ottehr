import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { FormControl, InputLabel, ListItemText, MenuItem, Select } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DataEntryTestItem } from 'utils';

interface InHouseLabSelectProps {
  availableTests: DataEntryTestItem[];
  selectedTestNames: string[];
  onChange: (newNames: string[]) => void;
}

export const InHouseLabSelect: React.FC<InHouseLabSelectProps> = ({ availableTests, selectedTestNames, onChange }) => {
  const [pendingTestNames, setPendingTestNames] = useState<string[]>(selectedTestNames);

  // Sync internal pending state when committed selection changes externally
  // (e.g. via lab sets, prefill, or the delete button in the table)
  useEffect(() => {
    setPendingTestNames(selectedTestNames);
  }, [selectedTestNames]);

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
        onClose={() => onChange(pendingTestNames)}
        renderValue={(selected) =>
          selected.length === 0 ? '' : `${selected.length} test${selected.length > 1 ? 's' : ''} selected`
        }
        MenuProps={{
          autoFocus: false,
          disableAutoFocusItem: true,
          PaperProps: {
            'data-testid': dataTestIds.orderInHouseLabPage.testTypeList,
          },
        }}
      >
        {availableTests.map((test) => {
          const selected = pendingTestNames.includes(test.name);
          const SelectionIcon = selected ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
          return (
            <MenuItem key={`${test.name}-${test.adId}`} value={test.name}>
              <SelectionIcon fontSize="small" style={{ marginRight: 8, padding: 9, boxSizing: 'content-box' }} />
              <ListItemText primary={test.name} />
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};
