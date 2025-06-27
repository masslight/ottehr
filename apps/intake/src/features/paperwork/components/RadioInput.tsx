import { FormControlLabel, Grid, Icon, Radio, RadioGroup, RadioGroupProps, Typography, useTheme } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomRadioButtonIcon } from '../../../components/form';
import { otherColors } from '../../../IntakeThemeProvider';
import { RadioStyling } from '../../../types';

interface RadioInputProps extends RadioGroupProps {
  name: string;
  value: string | undefined;
  options: QuestionnaireItemAnswerOption[];
  required?: boolean;
  borderColor?: string;
  borderSelected?: string;
  backgroundSelected?: string;
  centerImages?: boolean;
  onChange: (event: SyntheticEvent) => void;
  radioStyling?: RadioStyling;
}

const RadioInput: FC<RadioInputProps> = ({
  name,
  value,
  options,
  borderColor = 'divider',
  borderSelected = 'primary.main',
  backgroundSelected = otherColors.lightBlue,
  centerImages,
  onChange,
  radioStyling: maybeRadioStyling,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const radioStyling = maybeRadioStyling ?? {
    radio: {
      alignSelf: 'center',
      marginY: 'auto',
    },
    label: {
      ...theme.typography.body2,
      color: theme.palette.text.primary,
    },
  };

  return (
    <RadioGroup
      sx={{
        '.MuiFormControlLabel-label': {
          width: '100%',
        },
        gap: 1,
      }}
      value={value ?? ''}
      aria-labelledby={`${name}-label`}
    >
      {options.map((option) => {
        const gridWidths = {
          desktop: { labelText: 8.5, space: 0.2, image: 2 },
          mobile: { labelText: 12, space: 0, image: 12 },
        };

        if (!option.valueString || !(option as any).description) {
          gridWidths.desktop.labelText = 5.5;
        }

        if (!(option as any).image) {
          gridWidths.desktop.labelText = 11;
        }

        return (
          <FormControlLabel
            value={option.valueString ?? ''}
            control={
              <Radio
                icon={
                  <Icon
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      scale: '100%',
                      mx: 0.5,
                    }}
                  >
                    <CustomRadioButtonIcon
                      color={theme.palette.secondary}
                      checked={false}
                      alt={t('general.button.unchecked')}
                    />
                  </Icon>
                }
                checkedIcon={
                  <Icon sx={{ display: 'flex', justifyContent: 'center', scale: '100%', mx: 0.5 }}>
                    <CustomRadioButtonIcon
                      color={theme.palette.secondary}
                      checked={true}
                      alt={t('general.button.checked')}
                    />
                  </Icon>
                }
                sx={{
                  alignSelf: 'center',
                  // If screen is smaller than small breakpoint
                  [theme.breakpoints.down('md')]: {
                    mt: 0,
                  },
                  ...radioStyling?.radio,
                }}
              />
            }
            key={option.id ?? option.valueString ?? ''}
            label={
              <Grid
                container
                sx={{
                  paddingTop: '5px',
                  paddingBottom: '5px',
                  alignItems: 'center',
                  // If screen is smaller than medium breakpoint
                  [theme.breakpoints.down('md')]: {
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  },
                }}
              >
                {/* description xs ternary makes it work because point comfort doesn't have
                        a description, might be nice to change it later */}
                <Grid
                  item
                  sx={{
                    paddingTop: '0.3rem',
                    paddingBottom: '0.5rem',
                    [theme.breakpoints.down('md')]: {
                      paddingTop: '0.1rem',
                      '&.MuiGrid-item': { marginTop: '0px' },
                    },
                  }}
                >
                  <>
                    {option.valueString && (
                      <Typography variant="h5" color="primary.main" sx={radioStyling?.label}>
                        {option.valueString}
                      </Typography>
                    )}
                    {
                      // todo: define an extension for this if it is actually needed
                      (option as any).description && (
                        <div
                          style={{
                            lineHeight: '20px',
                            // spacing between label and description
                            marginTop: option.valueString ? '5px' : 0,
                          }}
                        >
                          <Typography variant={option.valueString ? 'caption' : 'body2'} color="secondary.main">
                            {(option as any).description}
                          </Typography>
                        </div>
                      )
                    }
                  </>
                </Grid>
                {(option as any).image && (
                  <>
                    <Grid item xs={gridWidths.mobile.space} md={gridWidths.desktop.space}></Grid>
                    <Grid
                      item
                      xs={gridWidths.mobile.image}
                      md={gridWidths.desktop.image}
                      sx={{
                        // If screen is larger than medium breakpoint
                        [theme.breakpoints.up('md')]: {
                          ...(centerImages && { marginLeft: 'auto', marginRight: 'auto' }),
                        },
                      }}
                    >
                      <img
                        alt={(option as any).imageAlt}
                        src={(option as any).image}
                        width={(option as any).imageWidth}
                      ></img>
                    </Grid>
                  </>
                )}
              </Grid>
            }
            onChange={onChange}
            sx={{
              border: '1px solid',
              borderRadius: 2,
              backgroundColor: () => {
                if (value === option.valueString && backgroundSelected) {
                  return backgroundSelected;
                } else {
                  return (option as any).color || theme.palette.background.paper;
                }
              },
              borderColor: value === option.valueString ? borderSelected : borderColor,
              paddingTop: 0,
              paddingBottom: 0,
              paddingRight: 2,
              marginX: 0,
              minHeight: 46,
              height: radioStyling?.height,
            }}
          />
        );
      })}
    </RadioGroup>
  );
};

export default RadioInput;
