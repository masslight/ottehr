import { FC, useContext, useMemo } from 'react';
import { SelectProps, MenuItem, Select, useTheme } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { IntakeThemeContext, RenderLabelFromSelect } from 'ui-components';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { AnswerLoadingOptions, GetAnswerOptionsRequest } from 'utils';
import { useAnswerOptionsQuery } from '../../../telemed/features/paperwork';

type SelectInputProps = {
  name: string;
  value: string | string[] | undefined;
  options: QuestionnaireItemAnswerOption[];
  placeholder?: string;
  dynamicAnswerOptions?: AnswerLoadingOptions;
  answerValueSet?: string;
} & SelectProps;

// todo: delete this component; keeping it around in order to scope css in case it helps with the FreeMultiSelectInput component
const SelectInput: FC<SelectInputProps> = ({
  name,
  value,
  options: staticOptions,
  placeholder,
  dynamicAnswerOptions,
  answerValueSet,
  ...otherProps
}) => {
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);
  const { multiple } = otherProps;
  console.log('dynamicAnswerOptions', dynamicAnswerOptions);

  const fetchOptionsInput: GetAnswerOptionsRequest | undefined = (() => {
    if (dynamicAnswerOptions !== undefined) {
      const { strategy, answerSource } = dynamicAnswerOptions;
      if (strategy !== 'dynamic') {
        return undefined;
      } else {
        if (answerSource !== undefined) {
          return {
            answerSource,
          };
        } else if (answerValueSet !== undefined) {
          return {
            answerValueSet,
          };
        }
      }
    }
    return undefined;
  })();
  const usesDynamicOptions = fetchOptionsInput !== undefined;

  console.log('useDynamicOptions', usesDynamicOptions);

  const { data, status: optionLoadingStatus } = useAnswerOptionsQuery(usesDynamicOptions, fetchOptionsInput);

  console.log('data', data);
  console.log('option loading status', optionLoadingStatus);

  const defaultVal = multiple ? [] : '';

  // todo: only 1 select component should be needed
  const options = useMemo(() => {
    let baseOptions = [];
    if (usesDynamicOptions) {
      baseOptions = (data ?? []) as QuestionnaireItemAnswerOption[];
    } else {
      baseOptions = staticOptions;
    }
    if (!multiple) {
      return baseOptions;
    }
    return baseOptions.filter((option) => {
      return option.valueString && value === option.valueString;
    });
  }, [usesDynamicOptions, multiple, data, staticOptions, value]);

  return (
    <Select
      id={name}
      labelId={`${name}-label`}
      IconComponent={ExpandMore}
      multiple={multiple}
      displayEmpty
      value={value ?? defaultVal}
      {...otherProps}
      fullWidth
      disableUnderline
      // To stop it adding a padding-right on the main element, shifting the background image
      MenuProps={{ disableScrollLock: true, PaperProps: { style: { maxHeight: 400 } } }}
      sx={{
        '& .MuiInputBase-input': {
          borderRadius: '8px',
          backgroundColor: theme.palette.background.paper,
          border: '1px solid',
          borderColor: otherColors.lightGray,
          padding: '10px 26px 10px 12px',
          '&:focus': {
            borderRadius: '8px',
            backgroundColor: theme.palette.background.paper,
          },
          '& p': {
            whiteSpace: 'normal',
          },
        },
        '& .MuiSelect-icon': {
          marginRight: '10px',
        },
        '& .MuiSelect-iconOpen': {
          marginRight: '10px',
        },
      }}
      renderValue={(selected: any) => {
        if (!selected) {
          return (
            <RenderLabelFromSelect styles={{ color: otherColors.placeholder }}>
              {placeholder ?? 'Select...'}
            </RenderLabelFromSelect>
          );
        }
        return <RenderLabelFromSelect>{selected as string}</RenderLabelFromSelect>;
      }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.id ?? option.valueString ?? ''}
          value={option.valueString ?? ''}
          sx={{
            whiteSpace: 'normal',
          }}
        >
          {option.valueString}
        </MenuItem>
      ))}
    </Select>
  );
};

export default SelectInput;
