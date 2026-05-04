import { Grid, Paper } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import PageContainer from 'src/layout/PageContainer';
import { AdminAddLabSetInput, AdminLabSet, APIError, LabType } from 'utils';
import { useAdminAddLabSet } from '../admin.queries';
import AdminLabSetForm from './AdminLabSetForm';

export default function AdminAddLabSet(): ReactElement {
  const { mutateAsync: addLabSetMutateAsync, isPending: isSubmitting } = useAdminAddLabSet();
  const navigate = useNavigate();

  const [submitError, setSubmitError] = useState<OystehrSdkError | APIError | undefined>(undefined);

  const onSubmit = useCallback(
    async (labSetData: AdminLabSet) => {
      console.log('submitted labSet data', labSetData);

      let labSet: AdminAddLabSetInput['labSet'];

      if (labSetData.listType === LabType.inHouse) {
        labSet = {
          listType: LabType.inHouse,
          listName: labSetData.listName,
          labs: labSetData.labs,
        };
      } else {
        labSet = {
          listType: LabType.external,
          listName: labSetData.listName,
          labs: labSetData.labs,
        };
      }

      try {
        const result = await addLabSetMutateAsync({ labSet });

        console.log('this is the result after adding this lab set', result);
        setSubmitError(undefined);
        navigate(`/admin/lab-sets/${result.labSetId}`);
      } catch (err: unknown) {
        console.error('add lab set failed', err);
        setSubmitError(err as OystehrSdkError | APIError);
      }
    },
    [addLabSetMutateAsync, navigate]
  );

  return (
    <PageContainer tabTitle={'Add Lab Set'}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: '/admin/lab-sets', children: 'Lab Sets' },
              {
                link: '#',
                children: 'Add New Lab Set',
              },
            ]}
          />
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <AdminLabSetForm formMode="add" onSubmit={onSubmit} isSubmitting={isSubmitting} submitError={submitError} />
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
