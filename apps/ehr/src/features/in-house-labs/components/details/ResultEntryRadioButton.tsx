import { Typography, Grid, FormControlLabel, Radio, RadioGroup, Checkbox, Box, SxProps, Theme } from '@mui/material';
import { CodeableConceptComponent } from 'utils';
import { Controller, useFormContext } from 'react-hook-form';

interface ResultEntryRadioButtonProps {
  testItemComponent: CodeableConceptComponent;
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

export const ResultEntryRadioButton: React.FC<ResultEntryRadioButtonProps> = ({ testItemComponent }) => {
  const nullCode = testItemComponent.nullOption?.code;
  const { control } = useFormContext();

  const isChecked = (curValue: string, selectedValue: string): boolean => {
    return curValue === selectedValue;
  };

  const isAbnormal = (curValue: string): boolean => {
    return testItemComponent.abnormalValues.includes(curValue);
  };

  const radioStylingColor = (curValue: string, selectedValue: string): SxProps<Theme> | undefined => {
    if (isChecked(curValue, selectedValue)) {
      return isAbnormal(curValue) ? ABNORMAL_RADIO_COLOR_STYLING : NORMAL_RADIO_COLOR_STYLING;
    }
    return undefined;
  };

  const typographyStyling = (curValue: string, selectedValue: string): SxProps<Theme> => {
    if (selectedValue) {
      if (isChecked(curValue, selectedValue)) {
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
    if (isChecked(curValue, selectedValue)) {
      return isAbnormal(curValue) ? '#FFEBEE' : '#E8F5E9';
    } else {
      return 'transparent';
    }
  };

  return (
    <Controller
      name={testItemComponent.observationDefinitionId}
      control={control}
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
                    control={<Radio sx={radioStylingColor(valueCode, field.value)} />}
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
                    checked={field.value === nullCode}
                    onChange={() => field.onChange(field.value === nullCode ? '' : nullCode)}
                  />
                }
                label={testItemComponent.nullOption.text}
                sx={{ color: 'text.secondary' }}
              />
            </Box>
          )}
        </>
      )}
    />
  );
};
