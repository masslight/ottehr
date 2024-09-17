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
import { FhirClient } from '@zapehr/sdk';
import { Location } from 'fhir/r4';
import { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { Link, useParams } from 'react-router-dom';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import { useApiClients } from '../../../hooks/useAppClients';
import PageContainer from '../../../layout/PageContainer';
import { AllStatesToNames, StateType } from '../../../types/types';

export default function EditStatePage(): JSX.Element {
  const { fhirClient } = useApiClients();
  const theme = useTheme();
  const [isOperateInStateChecked, setIsOperateInStateChecked] = useState<boolean>(false);
  const [stateName, setStateName] = useState<string | undefined>(undefined);
  const { state } = useParams();
  const fullLabel = `${state} - ${AllStatesToNames[state as StateType]}`;

  if (!fhirClient || !state) {
    throw new Error('fhirClient or state is not initialized.');
  }

  const { data: location, isFetching } = useQuery(
    ['state-location-data'],
    () => getStateLocation(fhirClient, state as StateType),
    {
      onSuccess: (location) => {
        setIsOperateInStateChecked(Boolean(location && location.status === 'active'));
        setStateName(location?.name);
      },
    },
  );

  const mutation = useMutation(({ location, newStatus }: { location: Location; newStatus: string }) =>
    updateStateLocationStatusAndName(fhirClient, location, newStatus, stateName ?? ''),
  );

  const onSwitchChange = (value: boolean): void => {
    setIsOperateInStateChecked(value);
  };

  const onSubmit = async (event: any): Promise<void> => {
    event.preventDefault();
    const newStatus = isOperateInStateChecked ? 'active' : 'suspended';
    if (!location) {
      throw new Error('Location was not loaded.');
    }
    mutation.mutate({ newStatus, location });
  };

  return (
    <PageContainer tabTitle={'Edit State'}>
      <form onSubmit={onSubmit}>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/telemed-admin/states', children: 'States' },
                { link: '#', children: fullLabel || <Skeleton width={150} /> },
              ]}
            />

            {/* Page Title */}
            <Typography
              variant="h3"
              color="primary.main"
              marginTop={2}
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}
            >
              {fullLabel || <Skeleton width={250} />}
            </Typography>

            {/* Page Content */}
            <Paper sx={{ padding: 3 }}>
              <FormLabel
                sx={{ ...theme.typography.h4, color: theme.palette.primary.main, mb: 1, fontWeight: '600 !important' }}
              >
                State information
              </FormLabel>

              <Box sx={{ marginTop: '10px' }}>
                {isFetching ? (
                  <Skeleton width={195} height={75} sx={{ marginBottom: 1 }} />
                ) : (
                  <TextField
                    id="outlined-input"
                    label="State name"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    sx={{ marginBottom: 2 }}
                    margin="dense"
                  />
                )}
              </Box>
              <Box>
                {isFetching ? (
                  <Skeleton width={140} height={38} />
                ) : (
                  <FormControlLabel
                    control={
                      <Switch
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

                <Link to="/telemed-admin/states">
                  <Button
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

async function getStateLocation(fhirClient: FhirClient, state: StateType): Promise<Location | undefined> {
  const resources = (await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [
      {
        name: 'address-state',
        value: state,
      },
      // {
      //   name: 'name:contains',
      //   value: 'virtual',
      // },
    ],
  })) as Location[];

  return resources.find(
    (loca) =>
      loca.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release')
        ?.valueCoding?.code === 'vi',
  );
}

async function updateStateLocationStatusAndName(
  fhirClient: FhirClient,
  location: Location,
  status: string,
  name: string,
): Promise<Location | undefined> {
  const updatedLocation = await fhirClient.patchResource<Location>({
    resourceType: 'Location',
    resourceId: location.id ?? '',
    operations: [
      {
        op: location.status ? 'replace' : 'add',
        path: '/status',
        value: status,
      },
      {
        op: location.name ? 'replace' : 'add',
        path: '/name',
        value: name,
      },
    ],
  });
  return updatedLocation;
}
