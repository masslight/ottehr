import { SxProps, TableCell, TableRow, Theme, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import { DataEntryComponent, OBSERVATION_CODES, quantityRangeFormat } from 'utils';
import { NullOptionCheckbox } from './NullOptionCheckbox';
import { ResultEntryFreeText } from './ResultEntryFreeText';
import { ResultEntrySelect } from './ResultEntrySelect';
import { ResultEntryNumericInput } from './ResultsEntryNumericInput';

interface ResultEntryTableRowProps {
  component: DataEntryComponent;
  isLastRow: boolean;
  disabled?: boolean; // equates to the final view
}

const ROW_STYLING = { paddingLeft: 0 };

export const ResultEntryTableRow: React.FC<ResultEntryTableRowProps> = ({ component, disabled, isLastRow }) => {
  const [isAbnormal, setIsAbnormal] = useState<boolean>(false);
  const { control } = useFormContext();
  const nullOptionAvailable = component.displayType === 'Numeric';
  const nullCode = nullOptionAvailable ? component.nullOption?.code : undefined;
  console.log('component', component.result);

  useEffect(() => {
    if (component.result?.interpretationCode) {
      const code = component.result?.interpretationCode;
      if (code === OBSERVATION_CODES.ABNORMAL) {
        setIsAbnormal(true);
      }
    }
  }, [component.result]);

  const renderTableCellsForDisplayType = (field: ControllerRenderProps<FieldValues, string>): JSX.Element => {
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
          field={field}
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
          field={field}
          disabled={disabled}
        />
      );
    }
    if (component.displayType === 'Free Text') {
      valueElement = <ResultEntryFreeText testItemComponent={component} disabled={disabled} />;
    }

    return (
      <>
        <TableCell sx={rowStyling}>{valueElement}</TableCell>
        <TableCell sx={rowStyling}>
          <Typography variant="body1">{units}</Typography>
        </TableCell>
        <TableCell sx={rowStyling}>
          <Typography variant="body1">{referenceRange}</Typography>
        </TableCell>
      </>
    );
  };

  const rowStyling: SxProps<Theme> = isLastRow
    ? { ...ROW_STYLING, borderBottom: 'none', paddingBottom: 0 }
    : ROW_STYLING;

  return (
    <Controller
      name={component.observationDefinitionId}
      control={control}
      rules={{ required: 'Please select a value' }}
      defaultValue={''}
      render={({ field }) => (
        <>
          <TableRow>
            <TableCell sx={rowStyling}>
              <Typography variant="body1" sx={{ color: `${isAbnormal ? 'error.dark' : ''}` }}>
                {component.componentName}
              </Typography>
            </TableCell>
            {renderTableCellsForDisplayType(field)}
          </TableRow>
          {nullOptionAvailable && (
            <TableRow>
              <TableCell colSpan={4} sx={{ paddingLeft: 0 }}>
                <NullOptionCheckbox
                  disabled={!!disabled}
                  nullCode={nullCode}
                  field={field}
                  label={component?.nullOption?.text}
                ></NullOptionCheckbox>
              </TableCell>
            </TableRow>
          )}
        </>
      )}
    />
  );
};
