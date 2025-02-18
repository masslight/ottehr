import { FC, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { Autocomplete, MenuItem, SelectProps, TextField, useTheme } from '@mui/material';
import { VirtualizedListbox } from './VirtualizedListbox';
import { IntakeThemeContext } from 'ui-components/lib/contexts';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { useFormContext } from 'react-hook-form';
import { useAnswerOptionsQuery } from '../../../telemed/features/paperwork';
import { AnswerLoadingOptions, GetAnswerOptionsRequest } from 'utils';

type PrunedSelectProps = Omit<
  SelectProps<HTMLTextAreaElement>,
  'onKeyDown' | 'onKeyUp' | 'onChange' | 'onBlur' | 'onFocus' | 'onInvalid' | 'componentsProps' | 'slotProps'
>;
type FreeMultiSelectInputProps = {
  name: string;
  value: string | string[] | undefined;
  options: QuestionnaireItemAnswerOption[];
  placeholder?: string;
  virtualization?: boolean;
  freeSolo?: boolean;
  multiple?: boolean;
  dynamicAnswerOptions?: AnswerLoadingOptions;
  answerValueSet?: string;
  onChange: (e: any) => void;
} & PrunedSelectProps;

const FreeMultiSelectInput: FC<FreeMultiSelectInputProps> = ({
  name,
  options: staticOptions,
  freeSolo,
  disabled,
  placeholder: customPlaceholder,
  multiple,
  virtualization = true,
  dynamicAnswerOptions,
  answerValueSet,
  onChange,
  ...otherProps
}) => {
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);
  const [inputValue, setInputValue] = useState<string>('');

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
  const valueType = dynamicAnswerOptions?.answerSource !== undefined ? 'Reference' : 'String';

  const { data } = useAnswerOptionsQuery(usesDynamicOptions, fetchOptionsInput);

  const { getValues } = useFormContext();

  const defaultOrNull: any = multiple ? [] : null;
  const placeholder = (() => {
    if (customPlaceholder) {
      return customPlaceholder;
    }
    if (freeSolo && multiple) {
      return 'Type or select all that apply';
    }
    if (freeSolo) {
      return 'Type or select...';
    }
    if (multiple) {
      return 'Select all that apply...';
    }
    return 'Select...';
  })();

  const selectionHandler = useCallback(
    (e: any): void => {
      const targetVal = e?.selectedOption ?? e?.target?.value;
      if (!targetVal) {
        return;
      }
      if (multiple) {
        const value = getValues(name)?.answer?.map((i: any) => i.valueString) ?? [];
        const newVal = [...value, targetVal];
        onChange({ target: { value: newVal } });
      } else {
        onChange({ target: { value: targetVal } });
      }
      setInputValue('');
    },
    [getValues, multiple, name, onChange]
  );

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
    const value = new Set(otherProps.value);
    return baseOptions.filter((option) => {
      return option.valueString && !value.has(option.valueString);
    });
  }, [usesDynamicOptions, multiple, otherProps.value, data, staticOptions]);

  return (
    <Autocomplete
      {...otherProps}
      sx={{
        '& ': {
          margin: '0px',
        },
        '& .MuiAutocomplete-iconOpen': {
          marginRight: '10px',
        },
        '& .MuiFilledInput-root': {
          fontSize: 16,
          padding: 0.25,
          backgroundColor: `${theme.palette.background.paper}`,
          borderRadius: '8px',
          border: '1px solid',
          borderColor: otherColors.lightGray,
          '&::before, ::after, :hover:not(.Mui-disabled, .Mui-error)::before': {
            borderBottom: 0,
          },
        },
        '& .Mui-focused': {
          boxShadow: `${otherColors.primaryBoxShadow} 0 0 0 0.2rem`,
          borderColor: `${theme.palette.primary.main}`,
        },
        '& .Mui-disabled': {
          backgroundColor: 'white',
        },
      }}
      autoComplete
      value={otherProps.value || null}
      disableClearable
      disabled={disabled}
      id={name}
      options={options}
      filterOptions={(options, state) => {
        const { inputValue, getOptionLabel } = state;
        const filtered = options.filter((option) => {
          return getOptionLabel(option)
            ?.toLowerCase()
            ?.startsWith(inputValue?.toLowerCase());
        });
        return filtered;
      }}
      freeSolo={freeSolo}
      fullWidth
      ListboxComponent={virtualization ? VirtualizedListbox : undefined}
      multiple={multiple}
      onChange={selectionHandler}
      onBlur={() => freeSolo && selectionHandler({ selectedOption: inputValue })}
      defaultValue={defaultOrNull}
      renderTags={(_options, _getTagProps) => null}
      getOptionLabel={(option) => {
        return labelForOption(option);
      }}
      isOptionEqualToValue={(option, value) => {
        if (typeof option === 'object') {
          if (valueType === 'String') {
            return option.valueString === value;
          } else {
            return option?.valueReference?.reference === value?.reference;
          }
        } else {
          return option === value;
        }
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
      }}
      renderOption={
        virtualization
          ? (props, option, state) => {
              const onClickCopy = { ...props }.onClick;
              const newOnClick = (e: any): void => {
                onClickCopy?.({ ...e, selectedOption: valueForOption(option, valueType) } as any);
              };
              const propsCopy = { ...props, onClick: newOnClick };
              return [propsCopy, { id: idForOption(option), label: labelForOption(option) }, state.index] as ReactNode;
            }
          : (props, option, _state) => {
              return (
                <MenuItem
                  key={idForOption(option)}
                  value={valueForOption(option, valueType)}
                  sx={{
                    whiteSpace: 'normal',
                  }}
                  onClick={(e) => {
                    props?.onClick?.({ ...e, selectedOption: valueForOption(option, valueType) } as any);
                  }}
                >
                  {labelForOption(option)}
                </MenuItem>
              );
            }
      }
      renderInput={(params) => {
        return <TextField {...params} variant="filled" placeholder={placeholder} />;
      }}
    />
  );
};

const labelForOption = (option: any): string => {
  if (option?.valueString !== undefined) {
    return option.valueString;
  } else if (option?.valueReference?.display !== undefined) {
    return `${option?.valueReference?.display}`;
  } else if (option?.display !== undefined) {
    return `${option.display}`;
  }
  return `${option}`;
};

const idForOption = (option: any): string => {
  return option.id ?? option.valueString ?? option.valueReference?.reference ?? `${option}`;
};

const valueForOption = (option: any, valueType: 'String' | 'Reference'): any => {
  const defaultVal = valueType === 'String' ? '' : null;
  return option?.[`value${valueType}`] ?? defaultVal;
};

export default FreeMultiSelectInput;
