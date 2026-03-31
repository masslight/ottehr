import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  lighten,
  TextField,
  Theme,
  Typography,
  useTheme,
} from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { AdminInHouseLabItemDefinition, APIError } from 'utils';
import { AdminInHouseLabItemDefinitionSchema } from 'utils';
import CPTCodeList from './components/CPTCodeList';
import TestComponentList from './components/TestComponentList';

export interface AdminInHouseLabFormProps {
  defaultValues: AdminInHouseLabItemDefinition;
  formMode: 'add' | 'edit';
  onSubmit: (data: AdminInHouseLabItemDefinition) => void;
  isSubmitting?: boolean;
  submitError?: OystehrSdkError | APIError;
}

export default function AdminInHouseLabform(props: AdminInHouseLabFormProps): ReactElement {
  const { defaultValues, formMode, onSubmit, isSubmitting, submitError } = props;

  const theme = useTheme();
  const methods = useForm<AdminInHouseLabItemDefinition>({
    defaultValues,
    resolver: zodResolver(AdminInHouseLabItemDefinitionSchema),
  });
  const formErrors = methods.formState.errors;
  console.log('>>>formErrors', formErrors);
  const hasFormErrors = Object.keys(formErrors).length > 0;
  console.log('>>>hasFormErrors', hasFormErrors);

  const formLabel = formMode === 'add' ? 'Add New In-House Lab' : 'Edit In-House Lab';

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <FormLabel
          sx={{
            ...theme.typography.h4,
            color: theme.palette.primary.dark,
            mb: 2,
            fontWeight: '600 !important',
            display: 'block',
          }}
        >
          {formLabel}
        </FormLabel>
        <SubSection theme={theme}>
          <Controller
            name="name"
            control={methods.control}
            render={({ field: { onChange, value }, fieldState }) => (
              <TextField
                id="test-name-input"
                label="Test Name"
                required
                value={value ?? ''}
                onChange={onChange}
                sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
                margin="dense"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          ></Controller>
          <Controller
            name="device"
            control={methods.control}
            render={({ field: { onChange, value }, fieldState }) => (
              <TextField
                id="device-input"
                label="Device"
                value={value ?? ''}
                onChange={onChange}
                sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
                margin="dense"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          ></Controller>
          <Controller
            name="repeatTest"
            control={methods.control}
            render={({ field }) => (
              <FormControlLabel
                label={
                  <Typography
                    sx={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: theme.palette.text.primary,
                    }}
                  >
                    Is Repeatable Test
                  </Typography>
                }
                sx={{
                  backgroundColor: 'transparent',
                  pr: 0,
                }}
                control={
                  <Checkbox
                    {...field}
                    size="medium"
                    sx={{
                      color: theme.palette.primary.main,
                      '&.Mui-checked': {
                        color: theme.palette.primary.main,
                      },
                      '&.Mui-disabled': {
                        color: lighten(theme.palette.primary.main, 0.4),
                      },
                    }}
                    checked={!!field.value}
                  />
                }
              />
            )}
          ></Controller>
        </SubSection>

        <SubSection label="CPT Codes" theme={theme}>
          <CPTCodeList theme={theme} />
        </SubSection>

        <SubSection label="Test Components" theme={theme}>
          <TestComponentList theme={theme} />
        </SubSection>

        <SubSection label={''} theme={theme}>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            Submit
          </LoadingButton>
          {submitError && (
            <FormHelperText sx={{ color: theme.palette.error.main }}>{submitError.message}</FormHelperText>
          )}
        </SubSection>

        {hasFormErrors && <FormHelperText sx={{ color: theme.palette.error.main }}>Please fix errors</FormHelperText>}
      </form>
    </FormProvider>
  );
}

type SubSectionProps = PropsWithChildren<{
  label?: string;
  theme: Theme;
  actionButton?: ReactNode;
}>;

function SubSection(props: SubSectionProps): ReactElement {
  const { children, label, theme, actionButton } = props;

  return (
    <Box sx={{ marginBottom: 3 }}>
      {label && (
        <FormLabel
          sx={{
            ...theme.typography.h5,
            color: theme.palette.primary.dark,
            mb: 2,
            fontWeight: '600 !important',
            display: 'block',
          }}
        >
          {label}
        </FormLabel>
      )}
      {children}
      {actionButton && (
        <Grid
          container
          sx={{
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Grid item>{actionButton}</Grid>
        </Grid>
      )}
    </Box>
  );
}
