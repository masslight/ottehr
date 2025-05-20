import { Typography, TableCell, TableRow } from '@mui/material';
import { TestItemComponent } from 'utils';
import { ResultEntrySelect } from './ResultEntrySelect';
import { ResultEntryNumericInput } from './ResultsEntryNumericInput';
import { useState } from 'react';

interface ResultEntryTableRowProps {
  component: TestItemComponent;
}

const ROW_STYLING = { paddingLeft: 0 };

export const ResultEntryTableRow: React.FC<ResultEntryTableRowProps> = ({ component }) => {
  const [isAbnormal, setIsAbnormal] = useState<boolean>(false);

  const assessAbnormality = (entry: string): void => {
    if (component.dataType === 'Quantity' && component.normalRange.low && component.normalRange.high) {
      console.log('entry', entry);
      const entryNum = parseFloat(entry);
      console.log('entryNum', entryNum);
      if (component.dataType === 'Quantity') {
        const { high, low } = component.normalRange;
        if (entryNum >= high || entryNum <= low) setIsAbnormal(true);
        if (entryNum < high && entryNum > low) setIsAbnormal(false);
      }
    }
    if (component.dataType === 'CodeableConcept' && component.abnormalValues) {
      if (component.abnormalValues.includes(entry)) {
        setIsAbnormal(true);
      } else {
        setIsAbnormal(false);
      }
    }
  };

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
        assessAbnormality={assessAbnormality}
      />
    );
  }
  if (component.displayType === 'Select') {
    valueElement = (
      <ResultEntrySelect testItemComponent={component} isAbnormal={isAbnormal} assessAbnormality={assessAbnormality} />
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
