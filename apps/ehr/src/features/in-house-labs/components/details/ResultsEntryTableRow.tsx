import { SxProps, TableCell, TableRow, Theme, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { OBSERVATION_CODES, quantityRangeFormat, TestItemComponent } from 'utils';
import { ResultEntrySelect } from './ResultEntrySelect';
import { ResultEntryNumericInput } from './ResultsEntryNumericInput';

interface ResultEntryTableRowProps {
  component: TestItemComponent;
  isLastRow: boolean;
  disabled?: boolean; // equates to the final view
}

const ROW_STYLING = { paddingLeft: 0 };

export const ResultEntryTableRow: React.FC<ResultEntryTableRowProps> = ({ component, disabled, isLastRow }) => {
  const [isAbnormal, setIsAbnormal] = useState<boolean>(false);
  console.log('component', component.result);

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
    referenceRange = quantityRangeFormat(component);
  }
  if (component.dataType === 'CodeableConcept') {
    units = component.unit ?? '';
    referenceRange =
      component.referenceRangeValues
        ?.map((refRange) => {
          return refRange.display.charAt(0).toUpperCase() + refRange.display.slice(1);
        })
        .join(', ') ?? '';
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

  const rowStyling: SxProps<Theme> = isLastRow
    ? { ...ROW_STYLING, borderBottom: 'none', paddingBottom: 0 }
    : ROW_STYLING;

  return (
    <TableRow>
      <TableCell sx={rowStyling}>
        <Typography variant="body1" sx={{ color: `${isAbnormal ? 'error.dark' : ''}` }}>
          {component.componentName}
        </Typography>
      </TableCell>
      <TableCell sx={rowStyling}>{valueElement}</TableCell>
      <TableCell sx={rowStyling}>
        <Typography variant="body1">{units}</Typography>
      </TableCell>
      <TableCell sx={rowStyling}>
        <Typography variant="body1">{referenceRange}</Typography>
      </TableCell>
    </TableRow>
  );
};
