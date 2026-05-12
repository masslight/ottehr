import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DataEntryTestItem } from 'utils';

interface InHouseLabSelectProps {
  availableTests: DataEntryTestItem[];
  handleTestSelection: (testName: string) => void;
}

export const InHouseLabSelect: React.FC<InHouseLabSelectProps> = ({ availableTests, handleTestSelection }) => {
  return (
    <FormControl
      fullWidth
      sx={{
        '& .MuiInputBase-root': {
          height: '40px',
        },
        '& .MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <InputLabel
        id="test-type-label"
        sx={{
          transform: 'translate(14px, 10px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)',
          },
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
        onChange={(e) => handleTestSelection(e.target.value)}
        MenuProps={{
          PaperProps: {
            'data-testid': dataTestIds.orderInHouseLabPage.testTypeList,
          },
        }}
      >
        {availableTests.map((test) => (
          <MenuItem key={`${test.name}-${test.adId}`} value={test.name}>
            {test.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
