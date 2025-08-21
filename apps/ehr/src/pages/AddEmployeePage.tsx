import { LoadingButton } from '@mui/lab';
import { Box, Paper, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APIErrorCode } from 'utils';
import { createUser } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

export default function AddEmployeePage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string | undefined>(undefined);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [lastName, setLastName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const applicationID = import.meta.env.VITE_APP_OYSTEHR_APPLICATION_ID;

  async function createEmployee(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda || !email || !firstName || !lastName) {
      throw new Error('oystehrZambda, email, firstName, or lastName is not set');
    }
    setLoading(true);
    try {
      const createUserResponse = await createUser(oystehrZambda, {
        email,
        firstName,
        lastName,
        applicationID,
      });
      navigate(`/employee/${createUserResponse.userID}`);
    } catch (error: any) {
      let parsedError = error;

      if (typeof error.message === 'string') {
        try {
          parsedError = JSON.parse(error.message);
        } catch {
          // ignore parse error, keep original
        }
      }

      if (parsedError?.code === APIErrorCode.USER_ALREADY_EXISTS) {
        enqueueSnackbar('User is already a member of the project', { variant: 'error' });
        return;
      }

      enqueueSnackbar('Unexpected error while creating user', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <>
        <Box marginX={12}>
          {/* Breadcrumbs */}
          <CustomBreadcrumbs
            chain={[
              { link: '/employees', children: 'Employees' },
              { link: '#', children: 'Add user' },
            ]}
          />
          <Paper sx={{ padding: 2 }}>
            {/* Page title */}
            <Typography variant="h3" color="primary.dark" marginBottom={1}>
              Add user
            </Typography>
            <Typography variant="body1" sx={{ marginBottom: 2 }}>
              This will immediately give the user the Staff role.
            </Typography>
            <form onSubmit={createEmployee}>
              <TextField
                label="Email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                sx={{
                  marginBottom: 3,
                  width: 300,
                }}
              />
              <br />
              <TextField
                label="First name"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                sx={{
                  marginBottom: 3,
                  width: 300,
                }}
              />
              <br />
              <TextField
                label="Last name"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                sx={{
                  marginBottom: 3,
                  width: 300,
                }}
              />
              <br />
              <LoadingButton type="submit" loading={loading} variant="contained" sx={{ marginTop: 2 }}>
                Save
              </LoadingButton>
            </form>
          </Paper>
        </Box>
      </>
    </PageContainer>
  );
}
