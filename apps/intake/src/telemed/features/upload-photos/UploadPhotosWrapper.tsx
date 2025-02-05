import { CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PaperworkContext, safelyCaptureException } from 'ui-components';
import { useZapEHRAPIClient } from '../../utils';
import { useUpdatePaperworkMutation } from '../paperwork';
import FileInput from '../../../features/paperwork/components/FileInput';
import ControlButtons from 'ui-components/lib/components/form/ControlButtons';
import { useUploadPhotosStore } from './UploadPhotosListItemButton';

export const UploadPhotosWrapper = ({ onClose }: { onClose: () => void }): JSX.Element => {
  const { paperworkData, isFetching, attachment, isLoading } = useUploadPhotosStore();

  const updatePaperwork = useUpdatePaperworkMutation();
  const apiClient = useZapEHRAPIClient();
  const methods = useForm();
  const [uploadedAttachment, setUploadedAttachment] = useState(attachment);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }
    if (!paperworkData?.questionnaireResponse?.id) {
      throw new Error('questionnaireResponse is not defined');
    }

    await updatePaperwork.mutateAsync(
      {
        apiClient,
        questionnaireResponseId: paperworkData.questionnaireResponse.id,
        answers: {
          linkId: 'patient-condition-page',
          item: [
            {
              linkId: 'patient-photos',
              answer: uploadedAttachment && [{ valueAttachment: uploadedAttachment }],
            },
          ],
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          safelyCaptureException(error);
        },
      }
    );
  }, [apiClient, onClose, paperworkData?.questionnaireResponse?.id, updatePaperwork, uploadedAttachment]);

  const [saveButtonDisabled, setSaveButtonDisabled] = useState(false);

  const outletContext: PaperworkContext = useMemo(() => {
    return {
      appointment: paperworkData?.appointment,
      setSaveButtonDisabled,
    } as PaperworkContext;
  }, [paperworkData?.appointment]);

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
              value={attachment}
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
              loading={saveButtonDisabled || isLoading || isFetching || updatePaperwork.isLoading}
            />
          </FormProvider>
        </form>
      )}
    </>
  );
};
