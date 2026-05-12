import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableCellProps,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { CPTCodeDTO, DataEntryTestItem, REPEAT_TEST_CPT_CODE_MODIFIER } from 'utils';
import { configCptCodeTestId, configRunAsRepeatBtnTestId } from '../../utils/test-ids';

interface InHouseSelectedTestTableProps {
  selectedTests: DataEntryTestItem[];
  setSelectedTests: (value: React.SetStateAction<DataEntryTestItem[]>) => void;
  displayRunAsRepeat: boolean;
}

interface ColumnConfig {
  name: string;
  props?: TableCellProps;
}

export const InHouseSelectedTestTable: React.FC<InHouseSelectedTestTableProps> = ({
  selectedTests,
  setSelectedTests,
  displayRunAsRepeat,
}) => {
  const formatCptCodesForCell = (cptCodes: CPTCodeDTO[], orderMode: DataEntryTestItem['orderMode']): string => {
    const cptCodesFormatted = cptCodes.map((c) => {
      // these modifiers are pulled from the activity definition are specific to the test (ex: alcohol confirmation test)
      let modifier = c.modifier ? c.modifier.map((m) => `-${m.code}`).join(',') : '';

      // we handle 91 for repeat tests on the fly since a test getting this modifier is dependant on the user selecting run as repeat
      if (orderMode === 'repeat' && !modifier.includes(REPEAT_TEST_CPT_CODE_MODIFIER.code)) {
        modifier += `-${REPEAT_TEST_CPT_CODE_MODIFIER.code}`;
      }

      const isStandard = orderMode === 'standard';

      return `${c.code}${modifier}${!isStandard ? ' (QW)' : ''}`;
    });
    return cptCodesFormatted.join('; ');
  };

  const repeatColumn: ColumnConfig[] = displayRunAsRepeat
    ? [
        {
          name: 'Run as repeat',
          props: { align: 'center' },
        },
      ]
    : [];

  const columns: ColumnConfig[] = [
    {
      name: 'Test',
      props: { width: displayRunAsRepeat ? '35%' : '50%' },
    },
    {
      name: 'CPT Code',
      props: { width: displayRunAsRepeat ? '35%' : '50%' },
    },
    ...repeatColumn,
    {
      name: '',
    },
  ];

  return (
    <TableContainer sx={{ mb: '8px' }}>
      <Table
        size="small"
        sx={{
          '& .MuiTableCell-root': {
            py: 0.5,
            px: 1,
          },
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((column, idx) => (
              <TableCell {...(column?.props ?? {})} key={`selected-lab-header-${idx}`}>
                <Typography variant="overline">{column.name}</Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {selectedTests.map((test) => (
            <TableRow key={test.name}>
              <TableCell>{test.name}</TableCell>
              <TableCell data-testid={configCptCodeTestId(test.name)}>
                {formatCptCodesForCell(test.cptCode, test.orderMode)}
              </TableCell>
              {displayRunAsRepeat && (
                <TableCell align="center">
                  {test.repeatable && (
                    <Checkbox
                      data-testid={configRunAsRepeatBtnTestId(test.name)}
                      size="small"
                      sx={{
                        p: 0.5,
                      }}
                      checked={test.orderMode === 'repeat'}
                      onChange={(e) => {
                        const checked = e.target.checked;

                        const orderMode = checked ? 'repeat' : 'standard';

                        setSelectedTests((prev) =>
                          prev.map((item) => (item.name === test.name ? { ...item, orderMode } : item))
                        );
                      }}
                    />
                  )}
                </TableCell>
              )}
              <TableCell align="right">
                <DeleteIconButton
                  onClick={() =>
                    setSelectedTests((prev) =>
                      prev.filter((tempLab) => {
                        const tempLabName = tempLab.name;
                        const labName = test.name;

                        return tempLabName !== labName;
                      })
                    )
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
