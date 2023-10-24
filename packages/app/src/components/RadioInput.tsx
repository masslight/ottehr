import {
  FormControl,
  FormControlLabel,
  Grid,
  Icon,
  Radio,
  RadioGroup,
  RadioGroupProps,
  SxProps,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, SyntheticEvent } from 'react';
import { Controller, FieldValues, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { customRadioButtonCheckedIcon, customRadioButtonUncheckedIcon } from '../assets/icons';
import { RadioOption } from '../types';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';

type RadioInputProps = {
  backgroundSelected?: string;
  borderColor?: string;
  borderSelected?: string;
  centerImages?: boolean;
  getSelected: () => FieldValues;
  helperText?: string;
  label: string;
  name: string;
  onChange: (event: SyntheticEvent) => void;
  options: RadioOption[];
  radioStyling?: RadioStyling;
  required?: boolean;
} & RadioGroupProps;

export type RadioStyling = {
  height?: string;
  label?: SxProps;
  radio?: SxProps;
};

export const RadioInput: FC<RadioInputProps> = ({
  backgroundSelected,
  borderColor = 'primary.contrast',
  borderSelected,
  centerImages,
  defaultValue,
  getSelected,
  helperText,
  label,
  name,
  onChange,
  options,
  radioStyling,
  required,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const theme = useTheme();
  const { t } = useTranslation();

  const selected = getSelected();
  // const defaultValue = options.length === 1 ? options[0].value : '';

  return (
    <Controller
      control={control}
      defaultValue={defaultValue}
      name={name}
      render={({ field }) => {
        return (
          <FormControl error={!!errors[name]} required={required} sx={{ mt: 3.5, width: '100%' }}>
            {/* Had to add a margin here and on FormControl because none of the variants worked properly */}
            {/* Same for padding. I want to emphasize how much I hate this. */}
            <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink sx={{ mt: -2.25 }}>
              {label}
            </BoldPrimaryInputLabel>
            <RadioGroup
              {...field}
              // This is gross but amounts to allowing the value from the form to be over-written with the supplied
              // value prop
              sx={{
                '.MuiFormControlLabel-label': {
                  width: '100%',
                },
                gap: 1,
              }}
              value={field.value || 'unknown'}
            >
              {options.map((option) => {
                const gridWidths = {
                  desktop: { image: 2, labelText: 8.5, space: 0.2 },
                  mobile: { image: 12, labelText: 12, space: 0 },
                };

                if (!option.label || !option.description) {
                  gridWidths.desktop.labelText = 5.5;
                }

                if (!option.image) {
                  gridWidths.desktop.labelText = 11;
                }

                return (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Radio
                        checkedIcon={
                          <Icon sx={{ display: 'flex', justifyContent: 'center', scale: '75%' }}>
                            <img alt={t('general.button.checked')} src={customRadioButtonCheckedIcon} />
                          </Icon>
                        }
                        icon={
                          <Icon sx={{ display: 'flex', justifyContent: 'center', scale: '75%' }}>
                            <img alt={t('general.button.unchecked')} src={customRadioButtonUncheckedIcon} />
                          </Icon>
                        }
                        sx={{
                          ...radioStyling?.radio,
                          alignSelf: 'start',
                          mt: '8px',
                          // If screen is smaller than medium breakpoint
                          [theme.breakpoints.down('md')]: {
                            mt: 0,
                          },
                        }}
                      />
                    }
                    label={
                      <Grid
                        container
                        sx={{
                          alignItems: 'center',
                          pb: '5px',
                          pt: '5px',
                          // If screen is smaller than medium breakpoint
                          [theme.breakpoints.down('md')]: {
                            alignItems: 'flex-start',
                            flexDirection: 'column',
                          },
                        }}
                      >
                        {/* description xs ternary makes it work because some options might not have a description,
                            might be nice to change it later */}
                        <Grid
                          item
                          md={gridWidths.desktop.labelText}
                          sx={{ margin: '0 !important' }}
                          xs={gridWidths.mobile.labelText}
                        >
                          <>
                            {option.label && (
                              <Typography color="secondary.main" sx={radioStyling?.label} variant="h5">
                                {option.label}
                              </Typography>
                            )}
                            {option.description && (
                              <div
                                style={{
                                  lineHeight: '20px',
                                  // spacing between label and description
                                  marginTop: option.label ? '5px' : 0,
                                }}
                              >
                                <Typography color="secondary.main" variant={option.label ? 'caption' : 'body2'}>
                                  {option.description}
                                </Typography>
                              </div>
                            )}
                          </>
                        </Grid>
                        {option.image && (
                          <>
                            <Grid item md={gridWidths.desktop.space} xs={gridWidths.mobile.space}></Grid>
                            <Grid
                              item
                              md={gridWidths.desktop.image}
                              sx={{
                                // If screen is larger than medium breakpoint
                                [theme.breakpoints.up('md')]: {
                                  ...(centerImages && { marginLeft: 'auto', marginRight: 'auto' }),
                                },
                              }}
                              xs={gridWidths.mobile.image}
                            >
                              <img alt={option.imageAlt} src={option.image} width={option.imageWidth} />
                            </Grid>
                          </>
                        )}
                      </Grid>
                    }
                    onChange={onChange}
                    sx={{
                      backgroundColor: () => {
                        if (selected[name] === option.value) {
                          if (backgroundSelected) {
                            return backgroundSelected;
                          } else {
                            return option.color || theme.palette.background.paper;
                          }
                        } else {
                          return option.color || theme.palette.background.paper;
                        }
                      },
                      border: '1px solid',
                      borderColor: selected[name] === option.value ? borderSelected : borderColor,
                      borderRadius: 2,
                      height: radioStyling?.height,
                      minHeight: 46,
                      mx: 0,
                      pb: 0,
                      pr: 2,
                      pt: 0,
                    }}
                    value={option.value}
                  />
                );
              })}
            </RadioGroup>
            <InputHelperText errors={errors} helperText={helperText} name={name} />
          </FormControl>
        );
      }}
    />
  );
};
