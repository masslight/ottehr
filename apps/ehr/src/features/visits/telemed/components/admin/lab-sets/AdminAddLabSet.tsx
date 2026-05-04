import { Grid, Paper } from '@mui/material';
import { ReactElement, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import PageContainer from 'src/layout/PageContainer';
import { AdminLabSetFormInput, LabType } from 'utils';
import { useAdminAddLabSet } from '../admin.queries';
import AdminLabSetForm from './AdminLabSetForm';

export default function AdminAddLabSet(): ReactElement {
  const { mutateAsync: addLabSetMutateAsync, isPending: isSubmitting, error: submitError } = useAdminAddLabSet();
  const navigate = useNavigate();

  const onSubmit = useCallback(
    async (labSetData: AdminLabSetFormInput) => {
      console.log('submitted labSet data', labSetData);

      let labSetFormInput: AdminLabSetFormInput;

      if (labSetData.listType === LabType.inHouse) {
        labSetFormInput = {
          listType: LabType.inHouse,
          listName: labSetData.listName,
          labs: labSetData.labs,
        };
      } else {
        labSetFormInput = {
          listType: LabType.external,
          listName: labSetData.listName,
          labs: labSetData.labs,
        };
      }

      try {
        const result = await addLabSetMutateAsync({ labSetFormInput });

        console.log('this is the result after adding this lab set', result);
        navigate(`/admin/lab-sets/${result.labSetId}`);
      } catch (err: unknown) {
        console.error('add lab set failed', err);
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
