import { CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { usePaperworkComponentHelpers } from 'src/hooks/usePaperworkComponentHelpers';
import {
  useDeletePatientConditionPhotoMutation,
  useUpdatePaperworkMutation,
  useUploadPatientConditionPhotoMutation,
} from 'src/telemed/features/paperwork/paperwork.queries';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { PaperworkContext } from 'ui-components/lib/components/paperwork/context';
import { ControlButtons, FileInput } from 'ui-components/lib/components/paperwork/form-components';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { useUploadPhotosStore } from './UploadPhotosListItemButton';

export const UploadPhotosWrapper = ({ onClose }: { onClose: () => void }): JSX.Element => {
  const { paperworkData, isFetching, attachment, isLoading, documentReferenceId, hasConditionStep } =
    useUploadPhotosStore();

  const queryClient = useQueryClient();
  const apiClient = useOystehrAPIClient();
  const updatePaperwork = useUpdatePaperworkMutation();
  const uploadPhoto = useUploadPatientConditionPhotoMutation();
  const deletePhoto = useDeletePatientConditionPhotoMutation();
  const methods = useForm();
  const [uploadedAttachment, setUploadedAttachment] = useState(attachment);

  const appointmentID = paperworkData?.appointment?.id;
  const questionnaireResponseId = paperworkData?.questionnaireResponse?.id;

  const onSubmit = useCallback(async (): Promise<void> => {
    try {
      if (hasConditionStep) {
        if (!apiClient || !questionnaireResponseId) {
          throw new Error('apiClient or questionnaireResponse is not defined');
        }
        await updatePaperwork.mutateAsync({
          apiClient,
          questionnaireResponseId,
          answers: {
            linkId: 'patient-condition-page',
            item: uploadedAttachment
              ? [{ linkId: 'patient-photos', answer: [{ valueAttachment: uploadedAttachment }] }]
              : [],
          },
        });
      } else {
        if (!appointmentID) {
          throw new Error('appointmentID is not defined');
        }
        if (uploadedAttachment?.url) {
          await uploadPhoto.mutateAsync({
            appointmentID,
            z3URL: uploadedAttachment.url,
            title: uploadedAttachment.title,
            mimeType: uploadedAttachment.contentType,
          });
        } else if (documentReferenceId) {
          await deletePhoto.mutateAsync({ documentRefId: documentReferenceId });
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['paperwork'] });
      onClose();
    } catch (error) {
      safelyCaptureException(error);
    }
  }, [
    apiClient,
    appointmentID,
    deletePhoto,
    documentReferenceId,
    hasConditionStep,
    onClose,
    queryClient,
    questionnaireResponseId,
    updatePaperwork,
    uploadPhoto,
    uploadedAttachment,
  ]);

  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);
  const paperworkComponentHelpers = usePaperworkComponentHelpers();

  const outletContext: PaperworkContext = useMemo(() => {
    return {
      appointment: paperworkData?.appointment,
      setSaveButtonDisabled,
      paperworkComponentHelpers,
    } as PaperworkContext;
  }, [paperworkData?.appointment, paperworkComponentHelpers]);

  return (
    <>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        Patient condition photo
      </Typography>
      {isLoading || !apiClient ? (
        <Box sx={{ justifyContent: 'center', display: 'flex' }}>
          <CircularProgress />
        </Box>
      ) : (
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <FormProvider {...methods}>
            <FileInput
              value={uploadedAttachment}
              attachmentType="image"
              description="Photo of patient’s condition (optional)"
              onChange={setUploadedAttachment}
              fieldName="photo"
              fileName="patient-photos"
              usePaperworkContext={() => outletContext}
            />
            <ControlButtons
              submitLabel="Save"
              backButtonLabel="Close"
              onBack={onClose}
              loading={
                saveButtonDisabled ||
                isLoading ||
                isFetching ||
                updatePaperwork.isPending ||
                uploadPhoto.isPending ||
                deletePhoto.isPending
              }
            />
          </FormProvider>
        </form>
      )}
    </>
  );
};
