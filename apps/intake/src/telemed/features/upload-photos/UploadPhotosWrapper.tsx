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
import { useQueryClient } from 'react-query';

export const UploadPhotosWrapper = ({ onClose }: { onClose: () => void }): JSX.Element => {
  const { paperworkData, isFetching, attachment, isLoading } = useUploadPhotosStore();

  const queryClient = useQueryClient();
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
          item: uploadedAttachment
            ? [
                {
                  linkId: 'patient-photos',
                  answer: [{ valueAttachment: uploadedAttachment }],
                },
              ]
            : [],
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries(['paperwork']);
          onClose();
        },
        onError: (error) => {
          safelyCaptureException(error);
        },
      }
    );
  }, [apiClient, onClose, paperworkData?.questionnaireResponse?.id, queryClient, updatePaperwork, uploadedAttachment]);

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
              loading={saveButtonDisabled || isLoading || isFetching || updatePaperwork.isLoading}
            />
          </FormProvider>
        </form>
      )}
    </>
  );
};
