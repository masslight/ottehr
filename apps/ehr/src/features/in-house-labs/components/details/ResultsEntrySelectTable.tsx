import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { TestItemComponent } from 'utils';
import { ResultEntrySelect } from './ResultEntrySelect';
import { ResultEntryNumericInput } from './ResultsEntryNumericInput';
import { ReactElement } from 'react';

interface ResultEntryTableProps {
  selectComponents: TestItemComponent[];
  result: string | null;
  setResult: React.Dispatch<React.SetStateAction<string | null>>;
}

const HEADER_ROW_STYLING = { borderBottom: 'none', padding: '0 8px 6px 0' };
const ROW_STYLING = { paddingLeft: 0 };

export const ResultEntryTable: React.FC<ResultEntryTableProps> = ({ selectComponents, result, setResult }) => {
  console.log('selectComponents', selectComponents);
  console.log('result', result);

  const getRowData = (
    component: TestItemComponent
  ): { name: string; valueElement: ReactElement; units: string; referenceRange: string } => {
    let units = '';
    let referenceRange = '';
    let valueElement = <div>Could not parse input type</div>;
    if (component.dataType === 'Quantity') {
      units = component.unit;
      referenceRange = `${component.normalRange.low} - ${component.normalRange.high}`;
    }
    if (component.displayType === 'Numeric') {
      valueElement = <ResultEntryNumericInput testItemComponent={component} result={result} setResult={setResult} />;
    }
    if (component.displayType === 'Select') {
      valueElement = <ResultEntrySelect testItemComponent={component} result={result} setResult={setResult} />;
    }

    return { name: component.componentName, valueElement, units, referenceRange };
  };

  return (
    <TableContainer>
      <Table
        aria-label="lab results table"
        sx={{ backgroundColor: 'rgba(217, 217, 217, 0.2)', padding: 2, borderCollapse: 'separate' }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '23%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                NAME
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '28%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                VALUE
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '15%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                UNITS
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '25%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                REFERENCE RANCE
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {selectComponents.map((component, idx) => {
            const { name, valueElement, units, referenceRange } = getRowData(component);

            return (
              <TableRow key={idx}>
                <TableCell sx={ROW_STYLING}>
                  <Typography variant="body1">{name}</Typography>
                </TableCell>
                <TableCell sx={ROW_STYLING}>{valueElement}</TableCell>
                <TableCell sx={ROW_STYLING}>
                  <Typography variant="body1">{units}</Typography>
                </TableCell>
                <TableCell sx={ROW_STYLING}>
                  <Typography variant="body1">{referenceRange}</Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
