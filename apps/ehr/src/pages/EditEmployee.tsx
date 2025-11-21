import { LoadingButton } from '@mui/lab';
import { Box, Button, Chip, Grid, Paper, Skeleton, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { allLicensesForPractitioner, PractitionerLicense, User, UserActivationMode } from 'utils';
import { getUserDetails, userActivation } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import EmployeeInformationForm from '../components/EmployeeInformation';
import { dataTestIds } from '../constants/data-test-ids';
import { checkUserIsActive } from '../helpers/checkUserIsActive';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

export default function EditEmployeePage(): JSX.Element {
  const { oystehr, oystehrZambda } = useApiClients();
  const [isActive, setIsActive] = useState<boolean>();
  const [user, setUser] = useState<User>();
  const [scheduleId, setScheduleId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({ submit: '' });

  const userLicenses: PractitionerLicense[] = useMemo(() => {
    if (user?.profileResource?.qualification) {
      return allLicensesForPractitioner(user.profileResource);
    }
    return [];
  }, [user]);

  // get the user id from the url
  const { id } = useParams();

  // get the user from the database, wait for the response before continuing
  useEffect(() => {
    let loading = false;

    async function getUser(): Promise<void> {
      if (!oystehr) {
        throw new Error('Oystehr client is undefined');
      }
      if (!oystehrZambda) {
        throw new Error('Zambda Client not found');
      }
      if (id && !loading) {
        loading = true;
        const res = await getUserDetails(oystehrZambda, {
          userId: id,
        });
        if (loading) {
          const { user: appUser, userScheduleId } = res;
          setScheduleId(userScheduleId);
          setUser(appUser);
          setIsActive(checkUserIsActive(appUser));
          loading = false;
        }
      }
    }

    if (!loading) {
      getUser().catch((error) => console.log(error));
    }

    return () => {
      loading = false;
    };
  }, [oystehr, id, oystehrZambda]);

  async function getUserAndUpdatePage(): Promise<void> {
    if (!oystehrZambda) {
      throw new Error('oystehrZambda is not defined');
    }
    const userDetailsTemp = await getUserDetails(oystehrZambda, {
      userId: id,
    });
    const userTemp = userDetailsTemp.user;
    setUser(userTemp);
    setIsActive(checkUserIsActive(userTemp));
  }

  const handleUserActivation = async (mode: UserActivationMode): Promise<void> => {
    setLoading(true);
    if (!oystehrZambda) {
      throw new Error('Zambda Client not found');
    }
    setErrors({ submit: '' });

    if (!user?.id) {
      throw new Error('User ID is undefined');
    }

    try {
      await userActivation(oystehrZambda, { userId: user.id, mode });
      await getUserAndUpdatePage();
      enqueueSnackbar(`User was ${mode}d successfully`, {
        variant: 'success',
      });
    } catch {
      const errorString = `Failed to ${mode} user. Please try again`;
      setErrors((prev) => ({ ...prev, submit: `${errorString}` }));
      enqueueSnackbar(`${errorString}`, {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer tabTitle={'Edit Employee'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/employees', children: 'Employees' },
                { link: '#', children: user?.name || <Skeleton width={150} /> },
              ]}
            />

            {/* Page Title */}
            <Typography
              variant="h3"
              color="primary.dark"
              marginTop={2}
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}
            >
              {user?.name || <Skeleton width={250} />}
              {isActive !== undefined && !isActive && (
                <Chip label="Deactivated" color="error" size="small" sx={{ marginLeft: 3 }} />
              )}
            </Typography>
            <Typography variant="body1" my={2}>
              {user?.email || <Skeleton width={250} />}
            </Typography>

            {/* Page Content */}
            <Box>
              {user && (
                <EmployeeInformationForm
                  submitLabel="Save changes"
                  existingUser={user}
                  isActive={isActive}
                  licenses={userLicenses}
                  getUserAndUpdatePage={getUserAndUpdatePage}
                />
              )}

              {isActive && (
                <Paper sx={{ padding: 3, marginTop: 3 }}>
                  <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    Provider schedule
                  </Typography>
                  {scheduleId ? (
                    <Link to={`/schedule/id/${scheduleId}`}>
                      <Button variant="contained" sx={{ marginTop: 1 }}>
                        Edit schedule
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/schedule/new/provider/${user?.profileResource?.id}`}>
                      <Button variant="contained" sx={{ marginTop: 1 }}>
                        Create schedule
                      </Button>
                    </Link>
                  )}
                </Paper>
              )}

              {/* Activate or Deactivate Profile */}
              {isActive === undefined ? (
                <Skeleton height={300} sx={{ marginTop: -8 }} />
              ) : (
                <Paper sx={{ padding: 3, marginTop: 3 }}>
                  <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    {isActive ? 'Deactivate profile' : 'Activate profile'}
                  </Typography>
                  <Typography variant="body1" marginTop={1}>
                    {isActive
                      ? 'When you deactivate this account, this employee will not have access to the system anymore.'
                      : 'Activate this user account. This will immediately give the user the Staff role.'}
                  </Typography>

                  {/* Error on submit if request fails */}
                  {errors.submit && (
                    <Typography color="error" variant="body2" mt={1}>
                      {errors.submit}
                    </Typography>
                  )}

                  <LoadingButton
                    variant="contained"
                    color={isActive ? 'error' : 'primary'}
                    data-testid={dataTestIds.employeesPage.deactivateUserButton}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 28,
                      marginTop: 4,
                      fontWeight: 'bold',
                      marginRight: 1,
                    }}
                    loading={loading}
                    onClick={
                      isActive ? () => handleUserActivation('deactivate') : () => handleUserActivation('activate')
                    }
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </LoadingButton>
                </Paper>
              )}
            </Box>
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
