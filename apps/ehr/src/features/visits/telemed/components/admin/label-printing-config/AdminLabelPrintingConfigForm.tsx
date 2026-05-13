import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import {
  APIError,
  getLabelTypeMetadata,
  LabelOrientationSchema,
  LabelPrintingConfig,
  LabelPrintingConfigSchema,
  MANUFACTURER_TO_LABEL_MAPPING,
  PrintModeSchema,
  SupportedPrinterManufacturerSchema,
} from 'utils';

export interface AdminPrintingConfigFormProps {
  defaultValues: LabelPrintingConfig;
  formMode: 'add' | 'edit';
  onSubmit: (data: LabelPrintingConfig) => void;
  isSubmitting?: boolean;
  submitError?: OystehrSdkError | APIError;
}

export default function AdminLabelPrintingConfigForm(props: AdminPrintingConfigFormProps): ReactElement {
  const { defaultValues, onSubmit, isSubmitting, submitError } = props;
  const theme = useTheme();

  const methods = useForm<LabelPrintingConfig>({
    defaultValues,
    resolver: zodResolver(LabelPrintingConfigSchema),
  });

  const selectedMode = methods.watch('mode');
  const selectedManufacturer = methods.watch('printerAndLabelConfig.printerManufacturer');

  const manufacturerEntry = selectedManufacturer ? MANUFACTURER_TO_LABEL_MAPPING[selectedManufacturer] : undefined;

  const formErrors = methods.formState.errors;
  const hasFormErrors = Object.keys(formErrors).length > 0;
  if (hasFormErrors) console.log('formErrors', formErrors);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Grid container direction="row" alignItems="center" justifyContent="space-between">
          <Grid item xs={10} sm={10} md={10}>
            <Grid container direction="row" rowSpacing={2}>
              <FormLabel
                sx={{
                  ...theme.typography.h4,
                  color: theme.palette.primary.dark,
                  mb: 2,
                  display: 'block',
                }}
              >
                Configure Print Settings
              </FormLabel>
              <Typography
                sx={{
                  ...theme.typography.body1,
                  marginBottom: 3,
                }}
              >
                Update label printing preferences. Select "manual" mode to print exclusively from the browser by
                default.
                <br />
                <br />
                If you do not see your printer manufacturer and/or label type, please select "manual" mode.
              </Typography>
              <Grid item width="100%">
                <Controller
                  name="mode"
                  control={methods.control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required size="small">
                      <InputLabel id="printing-mode-dropdown-label">Mode</InputLabel>
                      <Select
                        {...field}
                        label="Mode"
                        value={field.value ?? 'manual'}
                        fullWidth
                        onChange={(e) => field.onChange(e)}
                        error={!!fieldState.error}
                      >
                        {PrintModeSchema.options.map((mode) => (
                          <MenuItem key={mode} value={mode}>
                            {capitalizeFirstLetter(mode)}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText error={!!fieldState.error}>{fieldState.error?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>
              {selectedMode === 'integrated' && (
                <>
                  {/* all the other integrated mode fields */}
                  <Grid item width="100%">
                    <Controller
                      name="printerAndLabelConfig.printerManufacturer"
                      control={methods.control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required size="small">
                          <InputLabel id="manufacturer-dropdown-label">Printer Manufacturer</InputLabel>
                          <Select
                            {...field}
                            label="Printer Manufacturer"
                            value={field.value ?? ''}
                            fullWidth
                            onChange={(e) => {
                              field.onChange(e);
                              // reset the supported label types so we don't get weird caches
                              methods.resetField('printerAndLabelConfig.labelType');
                            }}
                            error={!!fieldState.error}
                          >
                            {SupportedPrinterManufacturerSchema.options.map((manufacturer) => (
                              <MenuItem key={manufacturer} value={manufacturer}>
                                {manufacturer}
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText error={!!fieldState.error}>{fieldState.error?.message}</FormHelperText>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item width="100%">
                    <Controller
                      name="printerAndLabelConfig.labelType"
                      control={methods.control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required size="small">
                          <InputLabel id="labelType-dropdown-label">Label Type</InputLabel>
                          <Select
                            {...field}
                            label="Label Type"
                            value={field.value ?? ''}
                            fullWidth
                            onChange={(e) => {
                              const labelType = e.target.value;
                              field.onChange(labelType);

                              const defaultLabelOrientation = getLabelTypeMetadata(selectedManufacturer, labelType)
                                ?.defaultOrientation;

                              if (defaultLabelOrientation)
                                methods.setValue('printerAndLabelConfig.orientation', defaultLabelOrientation, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                            }}
                            error={!!fieldState.error}
                          >
                            {manufacturerEntry?.labelTypeSchema.options.map((labelType) => (
                              <MenuItem key={labelType} value={labelType}>
                                {labelType}
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText error={!!fieldState.error}>{fieldState.error?.message}</FormHelperText>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item width="100%">
                    <Controller
                      name="printerAndLabelConfig.orientation"
                      control={methods.control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required size="small">
                          <InputLabel id="orientation-dropdown-label">Label Orientation</InputLabel>
                          <Select
                            {...field}
                            label="Label Orientation"
                            value={field.value ?? ''}
                            fullWidth
                            onChange={field.onChange}
                            error={!!fieldState.error}
                          >
                            {LabelOrientationSchema.options.map((orientation) => (
                              <MenuItem key={orientation} value={orientation}>
                                {capitalizeFirstLetter(orientation)}
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText error={!!fieldState.error}>{fieldState.error?.message}</FormHelperText>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item width="100%">
                    <Controller
                      name="openPdfOnPrint"
                      control={methods.control}
                      defaultValue={false}
                      render={({ field }) => (
                        <FormControlLabel
                          label={<Typography>Open pdf on print?</Typography>}
                          control={
                            <Checkbox
                              {...field}
                              size="medium"
                              sx={{
                                color: theme.palette.primary.main,
                                '&.Mui-checked': {
                                  color: theme.palette.primary.main,
                                },
                              }}
                              checked={!!field.value}
                            />
                          }
                        />
                      )}
                    />
                  </Grid>
                </>
              )}
              <Grid item>
                <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={isSubmitting}>
                  Submit
                </LoadingButton>
                {hasFormErrors && <FormHelperText error={true}>Please fix errors: </FormHelperText>}
                {submitError && <FormHelperText error={true}>{submitError.message}</FormHelperText>}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </FormProvider>
  );
}

const capitalizeFirstLetter = (val: string): string => {
  return val[0].toUpperCase() + val.slice(1);
};
