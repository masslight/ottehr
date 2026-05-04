import { LoadingButton } from '@mui/lab';
import { Box, CircularProgress, FormHelperText, FormLabel, Grid, Paper, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import PageContainer from 'src/layout/PageContainer';
import { AdminLabSetFormInput, LabSetStatus } from 'utils';
import { useAdminGetLabSetDetail, useAdminUpdateLabSet } from '../admin.queries';
import AdminLabSetForm from './AdminLabSetForm';

export default function AdminLabSetDetails(): ReactElement {
  const { listId: labSetId } = useParams();

  const { mutateAsync: updateLabSet, isPending: isUpdating, error: updateError } = useAdminUpdateLabSet(labSetId ?? '');

  const {
    data: existingData,
    isPending: isFetching,
    isError: isFetchDataError,
    status,
  } = useAdminGetLabSetDetail({
    labSetId: labSetId as string,
  });

  useEffect(() => {
    if (status === 'error') enqueueSnackbar('Failed to fetch lab set data', { variant: 'error' });
  }, [status]);

  const dataToRender = existingData?.labSetDTO ?? undefined;
  console.log('dataToRender', dataToRender);

  const onEdit = useCallback(
    async (labSetData: AdminLabSetFormInput) => {
      console.log('submitted formData', labSetData);

      try {
        const result = await updateLabSet({
          updateType: 'edit',
          data: labSetData,
        });

        console.log('this is the result after editing in house lab', result);
      } catch (err: unknown) {
        console.error('edit in house lab failed', err);
      }
    },
    [updateLabSet]
  );

  const onToggleStatus = useCallback(async () => {
    if (!dataToRender) return;

    try {
      const result = await updateLabSet({
        updateType: 'toggle-status',
        data: {
          labSetId: dataToRender.listId,
        },
      });

      console.log('this is the result after toggling status for the lab set', result);
    } catch (err: unknown) {
      console.error('toggle status in house lab failed', err);
    }
  }, [updateLabSet, dataToRender]);

  return (
    <PageContainer tabTitle={'Lab Set Details'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', children: 'Admin' },
                { link: '/admin/lab-sets', children: 'Lab Sets' },
                {
                  link: '#',
                  children: 'Lab Set Details',
                },
              ]}
            />
            <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
              {isFetching ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                  <CircularProgress />
                </Box>
              ) : isFetchDataError ? (
                <Typography>An error has occurred</Typography>
              ) : (
                <AdminLabSetForm
                  defaultValues={dataToRender}
                  formMode="edit"
                  onSubmit={onEdit}
                  isSubmitting={isUpdating}
                  submitError={updateError}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {!isUpdating && dataToRender && (
              <ToggleStatusSection
                labSetStatus={dataToRender.listStatus}
                onSubmit={onToggleStatus}
                isSubmitting={isUpdating}
                submitError={updateError}
              />
            )}
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}

interface ToggleStatusSectionProps {
  labSetStatus: LabSetStatus;
  onSubmit: () => Promise<void>;
  isSubmitting?: boolean;
  submitError?: Error | null;
}

function ToggleStatusSection(props: ToggleStatusSectionProps): ReactElement {
  const theme = useTheme();
  const { labSetStatus, onSubmit, isSubmitting, submitError } = props;
  const isActive = labSetStatus === LabSetStatus.active;
  const formVerb = isActive ? 'Deactivate' : 'Activate';
  const formLabel = `${formVerb} Lab Set`;
  const formBodyText = isActive
    ? 'Deactivating this lab set will make it unavailable from the order page. You can continue to edit it.'
    : 'Activating this lab set will allow providers to use it to populate the order page.';

  return (
    <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit();
        }}
      >
        <Box sx={{ marginBottom: 3 }}>
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
          <Typography
            sx={{
              ...theme.typography.body1,
              marginBottom: 3,
            }}
          >
            {formBodyText}
          </Typography>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={isSubmitting}
            color={isActive ? 'error' : 'primary'}
          >
            {formVerb}
          </LoadingButton>
          {submitError && (
            <FormHelperText sx={{ color: theme.palette.error.main }}>{submitError.message}</FormHelperText>
          )}
        </Box>
      </form>
    </Paper>
  );
}
