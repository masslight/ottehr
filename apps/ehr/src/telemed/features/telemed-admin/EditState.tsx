import { LoadingButton } from '@mui/lab';
import {
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
import { Location } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { Link, useParams } from 'react-router-dom';
import { AllStatesToVirtualLocationsData, isLocationVirtual, StateType } from 'utils';
import { STATES_URL } from '../../../App';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import { useApiClients } from '../../../hooks/useAppClients';
import PageContainer from '../../../layout/PageContainer';
import { dataTestIds } from '../../../constants/data-test-ids';

export default function EditStatePage(): JSX.Element {
  const { oystehr } = useApiClients();
  const theme = useTheme();
  const [isOperateInStateChecked, setIsOperateInStateChecked] = useState<boolean>(false);
  const { state } = useParams();
  const fullLabel = `${state} - ${AllStatesToVirtualLocationsData[state as StateType]?.name}`;

  if (!oystehr || !state) {
    throw new Error('oystehr or state is not initialized.');
  }

  const { data: location, isFetching } = useQuery(
    ['state-location-data'],
    () => getStateLocation(oystehr, state as StateType),
    {
      onSuccess: (location) => {
        setIsOperateInStateChecked(Boolean(location && location.status === 'active'));
      },
    }
  );

  const mutation = useMutation(({ location, newStatus }: { location: Location; newStatus: string }) =>
    updateStateLocationStatus(oystehr, location, newStatus)
  );

  const onSwitchChange = (value: boolean): void => {
    setIsOperateInStateChecked(value);
  };

  const onSubmit = async (event: any): Promise<void> => {
    event.preventDefault();
    const newStatus = isOperateInStateChecked ? 'active' : 'suspended';
    if (!location) {
      enqueueSnackbar('Location was not loaded.', {
        variant: 'error',
      });
      throw new Error('Location was not loaded.');
    }
    mutation.mutate(
      { newStatus, location },
      {
        onSuccess(data) {
          console.log(`${data}`);
          enqueueSnackbar(`State was updated successfully`, {
            variant: 'success',
          });
        },
        onError(error) {
          console.log(`error while updating state: ${error}`);
          enqueueSnackbar('An error has occurred while updating state. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  return (
    <PageContainer tabTitle={'Edit State'}>
      <form onSubmit={onSubmit}>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: STATES_URL, children: 'States' },
                { link: '#', children: fullLabel || <Skeleton width={150} /> },
              ]}
            />

            {/* Page Title */}
            <Typography
              data-testid={dataTestIds.editState.stateNameTitle}
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
                sx={{ ...theme.typography.h4, color: theme.palette.primary.dark, mb: 1, fontWeight: '600 !important' }}
              >
                State information
              </FormLabel>

              <Box sx={{ marginTop: '10px' }}>
                <TextField
                  data-testid={dataTestIds.editState.stateNameField}
                  id="outlined-read-only-input"
                  label="State name"
                  value={fullLabel}
                  sx={{ marginBottom: 2 }}
                  margin="dense"
                  InputProps={{
                    readOnly: true,
                  }}
                />
              </Box>
              <Box>
                {isFetching ? (
                  <Skeleton width={140} height={38} />
                ) : (
                  <FormControlLabel
                    control={
                      <Switch
                        data-testid={dataTestIds.editState.operateInStateToggle}
                        checked={isOperateInStateChecked}
                        onChange={(event) => onSwitchChange(event.target.checked)}
                      />
                    }
                    label="Operate in state"
                  />
                )}
              </Box>

              {/* Update State and Cancel Buttons */}
              <Grid>
                <LoadingButton
                  data-testid={dataTestIds.editState.saveChangesButton}
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
                  loading={isFetching || mutation.isLoading}
                  disabled={false}
                >
                  Save changes
                </LoadingButton>

                <Link to={STATES_URL}>
                  <Button
                    data-testid={dataTestIds.editState.cancelButton}
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

async function getStateLocation(oystehr: Oystehr, state: StateType): Promise<Location | undefined> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'address-state',
          value: state,
        },
      ],
    })
  ).unbundle();

  return resources.find(isLocationVirtual);
}

async function updateStateLocationStatus(
  oystehr: Oystehr,
  location: Location,
  status: string
): Promise<Location | undefined> {
  const updatedLocation = await oystehr.fhir.patch<Location>({
    resourceType: 'Location',
    id: location.id ?? '',
    operations: [
      {
        op: location.status ? 'replace' : 'add',
        path: '/status',
        value: status,
      },
    ],
  });
  return updatedLocation;
}
