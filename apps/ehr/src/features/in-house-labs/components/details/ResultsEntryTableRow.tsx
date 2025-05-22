import { Typography, TableCell, TableRow } from '@mui/material';
import { TestItemComponent, OBSERVATION_CODES } from 'utils';
import { ResultEntrySelect } from './ResultEntrySelect';
import { ResultEntryNumericInput } from './ResultsEntryNumericInput';
import { useState, useEffect } from 'react';

interface ResultEntryTableRowProps {
  component: TestItemComponent;
  disabled?: boolean;
}

const ROW_STYLING = { paddingLeft: 0 };

export const ResultEntryTableRow: React.FC<ResultEntryTableRowProps> = ({ component, disabled }) => {
  const [isAbnormal, setIsAbnormal] = useState<boolean>(false);

  useEffect(() => {
    if (component.result?.interpretationCode) {
      const code = component.result?.interpretationCode;
      if (code === OBSERVATION_CODES.ABNORMAL) {
        setIsAbnormal(true);
      }
    }
  }, [component.result]);

  let units = '';
  let referenceRange = '';
  let valueElement = <div>Could not parse input type</div>;
  if (component.dataType === 'Quantity') {
    units = component.unit;
    referenceRange = `${component.normalRange.low} - ${component.normalRange.high}`;
  }
  if (component.displayType === 'Numeric') {
    valueElement = (
      <ResultEntryNumericInput
        testItemComponent={component}
        isAbnormal={isAbnormal}
        setIsAbnormal={setIsAbnormal}
        disabled={disabled}
      />
    );
  }
  if (component.displayType === 'Select') {
    valueElement = (
      <ResultEntrySelect
        testItemComponent={component}
        isAbnormal={isAbnormal}
        setIsAbnormal={setIsAbnormal}
        disabled={disabled}
      />
    );
  }

  return (
    <TableRow key={`row-${component.observationDefinitionId}`}>
      <TableCell sx={ROW_STYLING}>
        <Typography variant="body1" sx={{ color: `${isAbnormal ? 'error.dark' : ''}` }}>
          {component.componentName}
        </Typography>
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
};
