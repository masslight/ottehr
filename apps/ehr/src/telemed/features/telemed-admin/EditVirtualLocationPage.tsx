import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Skeleton,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Location, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { AllStates, isLocationVirtual, useSuccessQuery } from 'utils';
import { VIRTUAL_LOCATIONS_URL } from '../../../App';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useApiClients } from '../../../hooks/useAppClients';
import PageContainer from '../../../layout/PageContainer';

const displayStates = AllStates.map((state) => state.value);

interface FormData {
  name: string;
  state: string;
  operateInLocation: boolean;
}

export default function EditVirtualLocationPage(): JSX.Element {
  const { oystehr } = useApiClients();
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const [originalLocation, setOriginalLocation] = useState<Location | null>(null);

  if (!oystehr || !id) {
    throw new Error('oystehr or location id is not initialized.');
  }

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      state: '',
      operateInLocation: false,
    },
    mode: 'onChange',
  });

  const getVirtualLocationDataQueryResult = useQuery({
    queryKey: ['virtual-location-data'],
    queryFn: (): Promise<{ location: Location; schedule: Schedule | undefined } | undefined> =>
      getVirtualLocation(oystehr, id),
  });

  const fullLabel = originalLocation?.name || 'Loading...';

  useSuccessQuery(getVirtualLocationDataQueryResult.data, (data) => {
    if (data) {
      setOriginalLocation(data.location);
      setValue('name', data.location.name || '');
      setValue('state', data.location.address?.state || '');
      setValue('operateInLocation', data.location.status === 'active');
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ location }: { location: Location }) => {
      if (oystehr) {
        return await updateLocation(oystehr, location);
      }
      throw new Error('Oystehr client not defined');
    },
  });

  const onSubmit = async (formData: FormData): Promise<void> => {
    if (!originalLocation) {
      enqueueSnackbar('Location was not loaded.', {
        variant: 'error',
      });
      throw new Error('Location was not loaded.');
    }

    const updatedLocation: Location = {
      ...originalLocation,
      name: formData.name,
      address: {
        ...originalLocation.address,
        state: formData.state,
      },
      status: formData.operateInLocation ? 'active' : 'suspended',
    };

    mutation.mutate(
      { location: updatedLocation },
      {
        onSuccess(data) {
          console.log(`${data}`);
          enqueueSnackbar(`Virtual location was updated successfully`, {
            variant: 'success',
          });
          // Update the original location to reflect the changes
          setOriginalLocation(updatedLocation);
        },
        onError(error: any) {
          console.log(`error while updating virtual location: ${error}`);
          enqueueSnackbar('An error has occurred while updating virtual location. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  const isLoading = getVirtualLocationDataQueryResult.isFetching || getVirtualLocationDataQueryResult.isLoading;

  return (
    <PageContainer tabTitle={'Edit Virtual Location'}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: VIRTUAL_LOCATIONS_URL, children: 'Virtual Locations' },
                { link: '#', children: fullLabel || <Skeleton width={150} /> },
              ]}
            />

            {/* Page Title */}
            <Typography
              data-testid={dataTestIds.editVirtualLocation.locationNameTitle}
              variant="h3"
              color="primary.dark"
              marginTop={2}
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}
            >
              {fullLabel || <Skeleton width={250} />}
            </Typography>

            {/* Page Content */}
            <Paper sx={{ padding: 3 }}>
              <FormLabel
                sx={{
                  ...theme.typography.h4,
                  color: theme.palette.primary.dark,
                  mb: 1,
                  fontWeight: '600 !important',
                }}
              >
                Location information
              </FormLabel>

              <Box sx={{ marginTop: '10px' }}>
                {isLoading ? (
                  <Skeleton width="100%" height={56} />
                ) : (
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: 'Location name is required' }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        data-testid={dataTestIds.editVirtualLocation.locationNameField}
                        {...field}
                        label="Location name"
                        sx={{ marginBottom: 2 }}
                        fullWidth
                        required
                        margin="dense"
                        error={!!error}
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              </Box>

              <Box sx={{ marginTop: '10px' }}>
                {isLoading ? (
                  <Skeleton width="100%" height={56} />
                ) : (
                  <Controller
                    name="state"
                    control={control}
                    rules={{ required: 'Location state is required' }}
                    render={({ field, fieldState: { error } }) => (
                      <Autocomplete
                        options={displayStates}
                        getOptionLabel={(option: string) => option}
                        value={field.value}
                        onChange={(_, value) => field.onChange(value || '')}
                        renderInput={(params) => (
                          <TextField
                            data-testid={dataTestIds.editVirtualLocation.locationStateField}
                            {...params}
                            label="Location state"
                            required
                            error={!!error}
                            helperText={error?.message}
                          />
                        )}
                      />
                    )}
                  />
                )}
              </Box>

              <Box>
                {isLoading ? (
                  <Skeleton width={140} height={38} />
                ) : (
                  <Controller
                    name="operateInLocation"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            data-testid={dataTestIds.editVirtualLocation.operateInLocationToggle}
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        }
                        label="Active"
                      />
                    )}
                  />
                )}
              </Box>

              {getVirtualLocationDataQueryResult.data?.schedule && (
                <Box sx={{ marginTop: '10px' }}>
                  <Link to={`/schedule/id/${getVirtualLocationDataQueryResult.data.schedule.id}`}>
                    <Button variant="contained" sx={{ marginTop: 1, marginBottom: 1 }}>
                      Edit schedule
                    </Button>
                  </Link>
                </Box>
              )}

              {/* Update State and Cancel Buttons */}
              <Grid>
                <LoadingButton
                  data-testid={dataTestIds.editVirtualLocation.saveChangesButton}
                  variant="contained"
                  color="primary"
                  sx={{
                    textTransform: 'none',
                    borderRadius: 28,
                    marginTop: 3,
                    fontWeight: 'bold',
                    marginRight: 1,
                  }}
                  type="submit"
                  loading={isLoading || mutation.isPending}
                  disabled={!isDirty || isLoading}
                >
                  Save changes
                </LoadingButton>

                <Link to={VIRTUAL_LOCATIONS_URL}>
                  <Button
                    data-testid={dataTestIds.editVirtualLocation.cancelButton}
                    variant="text"
                    color="primary"
                    sx={{
                      textTransform: 'none',
                      borderRadius: 28,
                      marginTop: 3,
                      fontWeight: 'bold',
                    }}
                  >
                    Cancel
                  </Button>
                </Link>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </form>
    </PageContainer>
  );
}

async function getVirtualLocation(
  oystehr: Oystehr,
  id: string
): Promise<{ location: Location; schedule: Schedule | undefined } | undefined> {
  const resources = (
    await oystehr.fhir.search<Location | Schedule>({
      resourceType: 'Location',
      params: [
        {
          name: '_id',
          value: id,
        },
        {
          name: '_revinclude',
          value: 'Schedule:actor:Location',
        },
      ],
    })
  ).unbundle();

  const location = resources.find(isLocationVirtual);
  if (!location) {
    return undefined;
  }

  const schedule = resources.find((res) => res.resourceType === 'Schedule') as Schedule | undefined;

  return { location, schedule };
}

async function updateLocation(oystehr: Oystehr, location: Location): Promise<Location | undefined> {
  const updatedLocation = await oystehr.fhir.update<Location>({
    id: location.id,
    ...location,
  });
  return updatedLocation;
}
