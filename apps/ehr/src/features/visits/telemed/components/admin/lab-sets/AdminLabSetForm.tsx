import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Theme,
  useTheme,
} from '@mui/material';
import { PropsWithChildren, ReactElement, ReactNode, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import {
  DataEntryTestItem,
  ExternalLabSetDTO,
  InHouseLabSetDTO,
  LabSetDTO,
  LabSetDTOSchema,
  LabSetStatus,
  LabType,
  LabTypeDisplay,
  nameLabTest,
  OrderableItemSearchResult,
} from 'utils';
import { AdminLabSetExternalSelection } from './components/AdminLabSetExternalSelection';
import { AdminLabSetInHouseSelection } from './components/AdminLabSetInHouseSelection';

export interface AdminLabSetFormProps {
  defaultValues?: LabSetDTO;
  formMode: 'add' | 'edit';
  onSubmit: (data: LabSetDTO) => void;
  isSubmitting: boolean;
  submitError?: Error | null;
}

export default function AdminLabSetForm(props: AdminLabSetFormProps): ReactElement {
  const { formMode, onSubmit, isSubmitting, submitError, defaultValues } = props;
  const [selectedInHouseTests, setSelectedInHouseTests] = useState<DataEntryTestItem[]>([]);
  const [selectedExternalTests, setSelectedExternalTests] = useState<OrderableItemSearchResult[]>([]);
  const [labsErrorMessage, setLabsErrorMessage] = useState<string | undefined>(undefined);

  const valuesForForm = defaultValues ?? {
    listId: '',
    listName: '',
    listType: undefined,
    listStatus: LabSetStatus.active,
    labs: [],
  };

  const defaultInHouseLabs =
    defaultValues?.listType === LabType.inHouse ? (defaultValues as InHouseLabSetDTO).labs : undefined;
  const defaultExternalLabSetDTO =
    defaultValues?.listType === LabType.external ? (defaultValues as ExternalLabSetDTO) : undefined;

  const theme = useTheme();
  const methods = useForm<LabSetDTO>({
    defaultValues: valuesForForm,
    resolver: zodResolver(LabSetDTOSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const selectedListType = useWatch({ control: methods.control, name: 'listType' });

  useEffect(() => {
    const labs =
      selectedListType === LabType.inHouse
        ? selectedInHouseTests.map((t) => ({
            display: t.name,
            adUrl: t.adUrl,
          }))
        : selectedExternalTests.map((r) => ({
            display: nameLabTest(r.item.itemName, r.lab.labName, false),
            itemCode: r.item.itemCode,
            labGuid: r.lab.labGuid,
          }));

    // here to help with form validation
    // labs form data is tied to multiple fields (which are also conditionally rendered)
    // so things need to be handled somewhat manually
    methods.setValue('labs', labs, {
      shouldDirty: true,
      shouldTouch: true,
    });
    if (labs.length > 0) {
      setLabsErrorMessage(undefined);
    }
  }, [methods, selectedInHouseTests, selectedExternalTests, selectedListType]);

  useEffect(() => {
    // for validating the labs form data
    methods.register('labs');
  }, [methods]);

  const formLabel = formMode === 'add' ? 'Add New Lab Set' : 'Edit Lab Set';
  const submitButtonText = formMode === 'add' ? 'Submit' : 'Save changes';

  const handleFormSubmit = methods.handleSubmit(onSubmit, (formErrors) => {
    if (formErrors.labs) {
      setLabsErrorMessage(formErrors.labs.message);
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleFormSubmit} noValidate>
        <FormLabel
          sx={{
            ...theme.typography.h4,
            color: theme.palette.primary.dark,
            mb: 2,
            display: 'block',
          }}
        >
          {formLabel}
        </FormLabel>
        <SubSection theme={theme}>
          <Controller
            name="listName"
            control={methods.control}
            rules={{ required: true }}
            render={({ field: { onChange, value }, fieldState }) => (
              <TextField
                id="lab-set-name-input"
                label="Lab Set Name"
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
            name="listType"
            control={methods.control}
            rules={{ required: true }}
            render={({ field: { onChange, value }, fieldState }) => (
              <FormControl sx={{ marginTop: 2, marginBottom: 1, width: '100%' }} required error={!!fieldState.error}>
                <InputLabel id="list-type-label">Lab Type</InputLabel>
                <Select
                  labelId="list-type-label"
                  id="list-type-select"
                  value={value ?? ''}
                  label="Lab Type"
                  inputProps={{ readOnly: formMode === 'edit' }}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange(val);
                    if (val !== selectedListType) {
                      // if changing types clear out the current selected values
                      setSelectedInHouseTests([]);
                      setSelectedExternalTests([]);
                    }
                  }}
                  sx={{
                    ...(formMode === 'edit' && {
                      pointerEvents: 'none',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                    }),
                  }}
                >
                  <MenuItem value={LabType.inHouse}>{LabTypeDisplay[LabType.inHouse]}</MenuItem>
                  <MenuItem value={LabType.external}>{LabTypeDisplay[LabType.external]}</MenuItem>
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          ></Controller>
        </SubSection>

        {selectedListType && (
          <FormControl error={!!labsErrorMessage} fullWidth>
            <SubSection label={'Select Labs to Include in the Set '} theme={theme}>
              {selectedListType === LabType.inHouse ? (
                <AdminLabSetInHouseSelection onTestsChange={setSelectedInHouseTests} defaultLabs={defaultInHouseLabs} />
              ) : (
                <AdminLabSetExternalSelection
                  onTestsChange={setSelectedExternalTests}
                  defaultLabs={defaultExternalLabSetDTO}
                />
              )}

              {labsErrorMessage && (
                <FormHelperText sx={{ color: theme.palette.error.main }}>{labsErrorMessage}</FormHelperText>
              )}
            </SubSection>
          </FormControl>
        )}

        <SubSection label={''} theme={theme}>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {submitButtonText}
          </LoadingButton>
          {submitError && (
            <FormHelperText sx={{ color: theme.palette.error.main }}>{submitError.message}</FormHelperText>
          )}
        </SubSection>
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
