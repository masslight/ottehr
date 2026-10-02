import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { FormControlLabel, Grid, Radio, RadioGroup, RadioGroupProps, Typography, useTheme } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getAnswerOptionLabel, getAnswerOptionValue } from 'utils/lib/helpers/paperwork/paperwork';
import { useAnswerOptionLabelWhen } from '../hooks/useAnswerOptionLabelWhen';
import { usePaperworkOtherColors } from '../theme';
import { RadioStyling } from '../types';

interface RadioInputProps extends RadioGroupProps {
  name: string;
  value: string | undefined;
  options: QuestionnaireItemAnswerOption[];
  required?: boolean;
  borderColor?: string;
  backgroundSelected?: string;
  centerImages?: boolean;
  onChange: (event: SyntheticEvent) => void;
  radioStyling?: RadioStyling;
}

export const RadioInput: FC<RadioInputProps> = ({
  name,
  value,
  options,
  borderColor = 'divider',
  backgroundSelected,
  centerImages,
  onChange,
  radioStyling: maybeRadioStyling,
}) => {
  const theme = useTheme();
  const otherColors = usePaperworkOtherColors();
  const { t } = useTranslation();

  const resolvedBackgroundSelected = backgroundSelected ?? otherColors.lightBlue;

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

  const labels = useAnswerOptionLabelWhen(options);

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
        const optionValue = getAnswerOptionValue(option);
        const optionLabel = getAnswerOptionLabel(option);
        const isSelected = value === optionValue;
        const gridWidths = {
          desktop: { labelText: 8.5, space: 0.2, image: 2 },
          mobile: { labelText: 12, space: 0, image: 12 },
        };

        if (!optionValue || !(option as any).description) {
          gridWidths.desktop.labelText = 5.5;
        }

        if (!(option as any).image) {
          gridWidths.desktop.labelText = 11;
        }

        return (
          <FormControlLabel
            value={optionValue ?? ''}
            control={
              <Radio
                disableRipple
                icon={
                  <RadioButtonUncheckedIcon
                    titleAccess={t('general.button.unchecked')}
                    sx={{ fontSize: 24, mx: 0.5 }}
                  />
                }
                checkedIcon={
                  <RadioButtonCheckedIcon titleAccess={t('general.button.checked')} sx={{ fontSize: 24, mx: 0.5 }} />
                }
                sx={{
                  alignSelf: 'center',
                  color: borderColor,
                  '&.Mui-checked': {
                    color: theme.palette.secondary.main,
                  },
                  '&:hover': {
                    backgroundColor: 'transparent',
                  },
                  // If screen is smaller than small breakpoint
                  [theme.breakpoints.down('md')]: {
                    mt: 0,
                  },
                  ...radioStyling?.radio,
                }}
              />
            }
            key={option.id ?? optionValue ?? ''}
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
                    {optionValue && (
                      <Typography variant="h5" color="primary.main" sx={radioStyling?.label}>
                        {labels[optionValue] ? labels[optionValue] : optionLabel}
                      </Typography>
                    )}
                    {
                      // todo: define an extension for this if it is actually needed
                      (option as any).description && (
                        <div
                          style={{
                            lineHeight: '20px',
                            // spacing between label and description
                            marginTop: optionValue ? '5px' : 0,
                          }}
                        >
                          <Typography variant={optionValue ? 'caption' : 'body2'} color="secondary.main">
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
              backgroundColor:
                isSelected && resolvedBackgroundSelected
                  ? resolvedBackgroundSelected
                  : (option as any).color || theme.palette.background.paper,
              borderColor: borderColor,
              '&:hover': {
                backgroundColor:
                  isSelected && resolvedBackgroundSelected ? resolvedBackgroundSelected : theme.palette.action.hover,
              },
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
