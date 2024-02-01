import { Box, Grid, Paper, Typography, Skeleton, Chip } from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { useEffect, useState } from 'react';
import PageContainer from '../layout/PageContainer';
import useAppClient from '../hooks/useAppClient';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@zapehr/sdk';
import EmployeeInformationForm from '../components/EmployeeInformationForm';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { checkUserIsActive } from '../helpers/checkUserIsActive';
import { deactivateUser, updateUser } from '../api/api';
import { useZambdaClient } from '../hooks/useZambdaClient';

export default function EditEmployeePage(): JSX.Element {
  const appClient = useAppClient();
  const zambdaClient = useZambdaClient();
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState<boolean>();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({ submit: '' });

  // get the user id from the url
  const { id } = useParams();

  // get the user from the database, wait for the response before continuing
  useEffect(() => {
    async function getUser(): Promise<void> {
      if (!appClient) {
        throw new Error('App client is undefined');
      }
      if (id) {
        const zapEHRUser = await appClient.getUser(id);
        setUser(zapEHRUser);
        setIsActive(checkUserIsActive(zapEHRUser));
      }
    }
    getUser().catch((error) => console.log(error));
  }, [appClient, id]);

  const handleUserActivation = async (mode: 'activate' | 'deactivate'): Promise<void> => {
    setLoading(true);
    if (!zambdaClient) {
      throw new Error('Zambda Client not found');
    }
    let apiErr = false;
    try {
      mode === 'deactivate'
        ? await deactivateUser(zambdaClient, { user: user })
        : await updateUser(zambdaClient, { userId: user?.id });
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: `Failed to ${mode} user. Please try again` }));
      apiErr = true;
    } finally {
      setLoading(false);
      if (mode === 'deactivate') {
        !apiErr && navigate('/employees');
      } else {
        !apiErr && setIsActive(true);
      }
    }
  };

  return (
    <PageContainer tabTitle={'Edit Employee'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item xs={6}>
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
              <EmployeeInformationForm submitLabel="Save changes" existingUser={user} isActive={isActive} />

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
                      : 'Activate this user account.'}
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
