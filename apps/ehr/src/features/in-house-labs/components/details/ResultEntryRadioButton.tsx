import { Typography, Grid, FormControlLabel, Radio, RadioGroup, Checkbox, Box, SxProps, Theme } from '@mui/material';
import { CodeableConceptComponent } from 'utils';
import { Controller, useFormContext } from 'react-hook-form';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';

interface ResultEntryRadioButtonProps {
  testItemComponent: CodeableConceptComponent;
  disabled?: boolean; // equates to the final view
}

const ABNORMAL_FONT_COLOR = '#F44336';
const ABNORMAL_RADIO_COLOR_STYLING = {
  color: ABNORMAL_FONT_COLOR,
  '&.Mui-checked': {
    color: ABNORMAL_FONT_COLOR,
  },
};

const NORMAL_FONT_COLOR = '#4CAF50';
const NORMAL_RADIO_COLOR_STYLING = {
  color: NORMAL_FONT_COLOR,
  '&.Mui-checked': {
    color: NORMAL_FONT_COLOR,
  },
};

const NEUTRAL_RADIO_STYLING = {
  color: 'primary.main',
  '&.Mui-disabled': {
    color: 'primary.main',
    '& .MuiSvgIcon-root': {
      fill: 'primary.main',
    },
  },
};

export const ResultEntryRadioButton: React.FC<ResultEntryRadioButtonProps> = ({ testItemComponent, disabled }) => {
  const nullCode = testItemComponent.nullOption?.code;
  const { control } = useFormContext();

  const isChecked = (curValue: string, selectedValue: string): boolean => {
    return curValue === selectedValue;
  };

  const isNeutral = !testItemComponent.abnormalValues.length;

  const isAbnormal = (curValue: string): boolean => {
    if (isNeutral) return false;
    return testItemComponent.abnormalValues.includes(curValue);
  };

  const radioStylingColor = (curValue: string, selectedValue: string): SxProps<Theme> | undefined => {
    if (isChecked(curValue, selectedValue)) {
      if (!isNeutral) {
        return isAbnormal(curValue) ? ABNORMAL_RADIO_COLOR_STYLING : NORMAL_RADIO_COLOR_STYLING;
      } else {
        return NEUTRAL_RADIO_STYLING;
      }
    }
    return undefined;
  };

  const typographyStyling = (curValue: string, selectedValue: string): SxProps<Theme> => {
    if (selectedValue) {
      const valIsChecked = isChecked(curValue, selectedValue);
      if (valIsChecked && isNeutral) return { fontWeight: 'bold' };
      if (valIsChecked) {
        if (isAbnormal(curValue)) {
          return {
            color: ABNORMAL_FONT_COLOR,
            fontWeight: 'bold',
          };
        } else {
          return {
            color: NORMAL_FONT_COLOR,
            fontWeight: 'bold',
          };
        }
      } else {
        return {
          color: 'text.disabled',
          fontWeight: 'bold',
        };
      }
    } else {
      if (isNeutral) return { fontWeight: 'bold' };
      if (isAbnormal(curValue)) {
        return {
          color: ABNORMAL_FONT_COLOR,
          fontWeight: 'bold',
        };
      } else {
        return {
          color: NORMAL_FONT_COLOR,
          fontWeight: 'bold',
        };
      }
    }
  };

  const getBackgroundColor = (curValue: string, selectedValue: string): string => {
    if (isChecked(curValue, selectedValue) && !isNeutral) {
      return isAbnormal(curValue) ? '#FFEBEE' : '#E8F5E9';
    } else {
      return 'transparent';
    }
  };

  const finalViewNullOptionCheckboxStyling = (curValue: string): SxProps<Theme> => {
    const isFinalView = !!disabled;
    if (isFinalView) {
      const isChecked = curValue === nullCode;
      if (isChecked) {
        return NEUTRAL_RADIO_STYLING;
      } else {
        return {};
      }
    }
    return {};
  };

  const finalViewNullOptionCheckboxLabelStyling = (curValue: string): SxProps<Theme> => {
    const isFinalView = !!disabled;
    if (isFinalView) {
      const isChecked = curValue === nullCode;
      if (isChecked) {
        return {
          color: 'text.primary',
          '& .MuiFormControlLabel-label': {
            color: 'text.primary',
          },
          '&.Mui-disabled .MuiFormControlLabel-label': {
            color: 'text.primary',
          },
        };
      } else {
        return {};
      }
    }
    return {};
  };

  return (
    <Controller
      name={testItemComponent.observationDefinitionId}
      control={control}
      rules={{ required: 'Please select a value' }}
      defaultValue={''}
      render={({ field }) => (
        <>
          <RadioGroup
            value={field.value === nullCode ? '' : field.value}
            onChange={(e) => field.onChange(e.target.value)}
          >
            <Grid container spacing={2}>
              {testItemComponent.valueSet.map((valueCode) => (
                <Grid item xs={6} key={valueCode}>
                  <FormControlLabel
                    value={valueCode}
                    control={<Radio sx={radioStylingColor(valueCode, field.value)} disabled={!!disabled} />}
                    label={<Typography sx={typographyStyling(valueCode, field.value)}>{valueCode}</Typography>}
                    sx={{
                      margin: 0,
                      padding: 2,
                      width: '100%',
                      border: '1px solid #E0E0E0',
                      borderRadius: 1,
                      backgroundColor: getBackgroundColor(valueCode, field.value),
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </RadioGroup>

          {testItemComponent.nullOption && (
            <Box mt={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    icon={<RadioButtonUncheckedIcon />}
                    checkedIcon={<RadioButtonCheckedIcon />}
                    disabled={!!disabled}
                    checked={field.value === nullCode}
                    onChange={() => field.onChange(field.value === nullCode ? '' : nullCode)}
                    sx={disabled ? finalViewNullOptionCheckboxStyling(field.value) : {}}
                  />
                }
                label={testItemComponent.nullOption.text}
                sx={disabled ? finalViewNullOptionCheckboxLabelStyling(field.value) : {}}
              />
            </Box>
          )}
        </>
      )}
    />
  );
};
