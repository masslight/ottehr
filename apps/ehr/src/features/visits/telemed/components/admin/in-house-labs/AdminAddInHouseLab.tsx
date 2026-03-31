import { Grid, Paper } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { AdminInHouseLabItemDefinition, APIError } from 'utils';
import { useAdminAddInHouseLab } from '../admin.queries';
import AdminInHouseLabform from './AdminInHouseLabForm';

export default function AdminAddInHouseLab(): ReactElement {
  const { mutateAsync: addInHouseLabMutateAsync, isPending: isSubmitting } = useAdminAddInHouseLab();
  const navigate = useNavigate();
  const currentUser = useEvolveUser();

  const currentUserId = currentUser?.id ?? '';
  const [submitError, setSubmitError] = useState<OystehrSdkError | APIError | undefined>(undefined);

  // explicitly defining the optional parameters as undefined for clarity
  const defaultValues: AdminInHouseLabItemDefinition = {
    name: '',
    device: undefined,
    cptCode: [{ code: '' }],
    loincCode: undefined,
    repeatTest: false,
    components: [
      {
        dataType: 'string',
        componentName: '',
        loincCode: undefined,
        display: { type: 'Free Text' },
      },
    ],
    note: undefined,
  };

  const onSubmit = useCallback(
    async (formData: AdminInHouseLabItemDefinition) => {
      console.log('oh hai you called submit from the add in house lab page');
      console.log('>>> this is your submitted formData', formData);

      try {
        const result = await addInHouseLabMutateAsync({
          data: formData,
          userId: currentUserId,
        });

        console.log('this is the result after adding in house lab', result);
        setSubmitError(undefined);
        navigate(`/admin/in-house-labs/${result.activityDefinitionId}`);
      } catch (err: unknown) {
        console.error('add in house lab failed', err);
        setSubmitError(err as OystehrSdkError | APIError);
      }
    },
    [addInHouseLabMutateAsync, navigate, currentUserId]
  );

  return (
    <PageContainer tabTitle={'Add In-House Lab'}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: '/admin/in-house-labs', children: 'In-House Labs' },
              {
                link: '#',
                children: 'Add New In-House Lab',
              },
            ]}
          />
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <AdminInHouseLabform
              defaultValues={defaultValues}
              formMode="add"
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
