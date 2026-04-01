import { LoadingButton } from '@mui/lab';
import { Box, CircularProgress, FormHelperText, FormLabel, Grid, Paper, Typography, useTheme } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import {
  ADMIN_IN_HOUSE_LAB_FORM_DEFAULT_VALUES,
  AdminInHouseLabItemDefinition,
  APIError,
  InHouseLabAdminItemStatus,
} from 'utils';
import { useAdminGetInHouseLabConfig, useAdminUpdateInHouseLab } from '../admin.queries';
import AdminInHouseLabform from './AdminInHouseLabForm';

export default function AdminInHouseLabDetails(): ReactElement {
  const { activityDefinitionId } = useParams();
  const navigate = useNavigate();
  const currentUser = useEvolveUser();
  const currentUserId = currentUser?.id ?? '';

  const { mutateAsync: updateInHouseLabMutateAsync, isPending: isSubmitting } = useAdminUpdateInHouseLab(
    activityDefinitionId ?? ''
  );
  const {
    data: existingData,
    isPending,
    isError: isFetchDataError,
    status,
  } = useAdminGetInHouseLabConfig({
    userId: currentUserId,
    activityDefinitionId: activityDefinitionId as string,
  });

  useEffect(() => {
    if (status === 'error') enqueueSnackbar('Failed to fetch in-house lab data', { variant: 'error' });
  }, [status]);

  const [submitError, setSubmitError] = useState<OystehrSdkError | APIError | undefined>(undefined);

  // labs TODO: to consider we should check if the ad that loads is the latest and only do editable things if it is
  // this would prevent the edge case of people navigating to an old AD url

  const dataToRender = existingData?.testConfig ?? ADMIN_IN_HOUSE_LAB_FORM_DEFAULT_VALUES;
  console.log('dataToRender', dataToRender);

  const onEditSubmit = useCallback(
    async (formData: AdminInHouseLabItemDefinition) => {
      console.log('submitted formData', formData);
      if (!existingData) return;

      try {
        const result = await updateInHouseLabMutateAsync({
          data: {
            updateType: 'edit',
            data: {
              newData: formData,
              activityDefinitionIdToRetire: existingData.activityDefinitionId,
              canonicalUrl: existingData.canonicalUrl,
              versionToRetire: existingData.version,
            },
          },
          userId: currentUserId,
        });

        console.log('this is the result after editing in house lab', result);
        setSubmitError(undefined);

        // since we get back a brand new ActivityDefinition, we navigate to that page now
        // note we clear the history so user can't go "back" to an outdated ActivityDefinition
        navigate(`/admin/in-house-labs/${result.activityDefinitionId}`, { replace: true });
      } catch (err: unknown) {
        console.error('edit in house lab failed', err);
        setSubmitError(err as OystehrSdkError | APIError);
      }
    },
    [updateInHouseLabMutateAsync, navigate, currentUserId, existingData]
  );

  const onUpdateStatusSubmit = useCallback(async () => {
    if (!existingData) return;

    try {
      const result = await updateInHouseLabMutateAsync({
        data: {
          updateType: 'toggle-status',
          data: {
            activityDefinitionId: existingData.activityDefinitionId,
          },
        },
        userId: currentUserId,
      });

      console.log('this is the result after toggling status in house lab', result);
      setSubmitError(undefined);
    } catch (err: unknown) {
      console.error('toggle status in house lab failed', err);
      setSubmitError(err as OystehrSdkError | APIError);
    }
  }, [updateInHouseLabMutateAsync, existingData, currentUserId]);

  return (
    <PageContainer tabTitle={'In-House Lab Details'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', children: 'Admin' },
                { link: '/admin/in-house-labs', children: 'In-House Labs' },
                {
                  link: '#',
                  children: 'In-House Lab Details',
                },
              ]}
            />
            <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
              {isPending ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                  <CircularProgress />
                </Box>
              ) : isFetchDataError ? (
                <Typography>An error has occurred</Typography>
              ) : (
                <AdminInHouseLabform
                  defaultValues={dataToRender}
                  formMode="edit"
                  onSubmit={onEditSubmit}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'584px'} width={'100%'}>
            {!isPending && existingData && (
              <ToggleStatusSection
                testItemStatus={existingData?.activityDefinitionStatus}
                onSubmit={onUpdateStatusSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}

interface ToggleStatusSectionProps {
  testItemStatus: InHouseLabAdminItemStatus;
  onSubmit: () => Promise<void>;
  isSubmitting?: boolean;
  submitError?: OystehrSdkError | APIError;
}
function ToggleStatusSection(props: ToggleStatusSectionProps): ReactElement {
  const theme = useTheme();
  const { testItemStatus, onSubmit, isSubmitting, submitError } = props;
  const isActive = testItemStatus === 'active';
  const formVerb = isActive ? 'Deactivate' : 'Activate';
  const formLabel = `${formVerb} In-House Test`;
  const formBodyText = isActive
    ? 'When you deactivate this in-house lab, providers will not be able to order it. Historical results are unaffected.'
    : 'Activating this in-house labs will allow providers to order it';

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
              fontWeight: '600 !important',
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
