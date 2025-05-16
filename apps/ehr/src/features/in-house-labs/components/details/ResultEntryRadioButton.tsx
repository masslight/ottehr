import { Typography, Grid, FormControlLabel, Radio, RadioGroup, Checkbox, Box, SxProps, Theme } from '@mui/material';
import { CodeableConceptComponent } from 'utils';

interface ResultEntryRadioButtonProps {
  testItemComponent: CodeableConceptComponent;
  result: string | null;
  setResult: React.Dispatch<React.SetStateAction<string | null>>;
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

export const ResultEntryRadioButton: React.FC<ResultEntryRadioButtonProps> = ({
  testItemComponent,
  result,
  setResult,
}) => {
  console.log('check whats here', testItemComponent);

  const isChecked = (valueCode: string): boolean => {
    return result === valueCode;
  };

  const isAbnormal = (valueCode: string): boolean => {
    return testItemComponent.abnormalValues.includes(valueCode);
  };

  const radioStylingColor = (valueCode: string): SxProps<Theme> | undefined => {
    if (isChecked(valueCode)) {
      return isAbnormal(valueCode) ? ABNORMAL_RADIO_COLOR_STYLING : NORMAL_RADIO_COLOR_STYLING;
    }
    return undefined;
  };

  const typographyStyling = (valueCode: string): SxProps<Theme> => {
    if (result) {
      if (isChecked(valueCode)) {
        if (isAbnormal(valueCode)) {
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
      if (isAbnormal(valueCode)) {
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

  const getBackgroundColor = (valueCode: string): string => {
    if (isChecked(valueCode)) {
      return isAbnormal(valueCode) ? '#FFEBEE' : '#E8F5E9';
    } else {
      return 'transparent';
    }
  };

  return (
    <>
      <RadioGroup value={result} onChange={(e) => setResult(e.target.value)}>
        <Grid container spacing={2}>
          {testItemComponent.valueSet.map((valueCode) => {
            return (
              <Grid item xs={6}>
                <FormControlLabel
                  value={valueCode}
                  control={<Radio checked={isChecked(valueCode)} sx={radioStylingColor(valueCode)} />}
                  label={<Typography sx={typographyStyling(valueCode)}>{valueCode}</Typography>}
                  sx={{
                    margin: 0,
                    padding: 2,
                    width: '100%',
                    border: '1px solid #E0E0E0',
                    borderRadius: 1,
                    backgroundColor: getBackgroundColor(valueCode),
                  }}
                />
              </Grid>
            );
          })}
        </Grid>
      </RadioGroup>

      {testItemComponent.nullOption && (
        <Box mt={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isChecked(testItemComponent.nullOption.code)}
                onChange={() => setResult(testItemComponent.nullOption?.code || 'Unknown')}
              />
            }
            label={testItemComponent.nullOption.text}
            sx={{ color: 'text.secondary' }}
          />
        </Box>
      )}
    </>
  );
};
