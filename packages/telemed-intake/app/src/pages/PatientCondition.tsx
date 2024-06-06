import { FC, useCallback, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageForm, filterObject, formInputStringToBoolean, getFileTypeFromFile } from 'ottehr-components';
import { FileURLs, FileUpload, getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer } from '../features/common';
import { useCreateZ3ObjectMutation, useFilesStore } from '../features/files';
import { usePaperworkStore } from '../features/paperwork';
import { usePatientInfoStore } from '../features/patient-info';
import { useMapQuestionsToFormInputFields, usePaperworkPageInfo, useZapEHRAPIClient } from '../utils';

const PatientCondition: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const apiClient = useZapEHRAPIClient();
  const createZ3Object = useCreateZ3ObjectMutation();

  const { paperworkQuestions, patchCompletedPaperwork } = getSelectors(usePaperworkStore, [
    'paperworkQuestions',
    'patchCompletedPaperwork',
  ]);
  const { completedPaperwork } = usePaperworkStore.getState();
  const { patientInfo } = getSelectors(usePatientInfoStore, ['patientInfo']);
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const { fileURLs, patchFileURLs } = getSelectors(useFilesStore, ['fileURLs', 'patchFileURLs']);

  const { items, nextPage, pageName, currentPage, currentIndex } = usePaperworkPageInfo({
    location,
    paperworkQuestions,
  });

  const fileItems = items.filter((item) => item.type === 'Photos');
  const [fileUploads, setFileUploads] = useState<FileUpload>({});
  const allFileKeys = Object.keys(fileUploads);

  const onSubmit = useCallback(
    async (data: FieldValues): Promise<void> => {
      if (!paperworkQuestions) {
        throw new Error('paperworkQuestions is not defined');
      }

      // Upload files to z3 if the page includes File type input
      const photoItem = fileItems[0];
      if (photoItem) {
        const photoUploads = filterObject(fileUploads, (key) => key.startsWith(photoItem.id)) as FileUpload;
        let uploadResponse: any;

        for (const photoItem in photoUploads) {
          const fileId = photoItem;
          const fileData = photoUploads[photoItem].fileData;

          if (patientInfo.id && fileData) {
            uploadResponse = await createZ3Object.mutateAsync({
              apiClient,
              fileType: fileId,
              fileFormat: getFileTypeFromFile(photoUploads[photoItem].fileData?.name || ''),
              file: fileData,
              appointmentID,
            });
          }

          if (fileData && !uploadResponse) {
            // Reset fields if Z3 upload fails
            setFileUploads((prev) => ({
              ...prev,
              [fileId]: { fileData: null, uploadFailed: true },
            }));
          } else if (fileData && uploadResponse) {
            // Reset file data when user continues to next page
            setFileUploads((prev) => ({
              ...prev,
              [fileId]: { fileData: null, uploadFailed: prev[fileId].uploadFailed },
            }));
          }

          // Update state.fileURLs
          patchFileURLs({
            [fileId]: {
              ...fileURLs?.[fileId],
              z3Url: uploadResponse.z3URL,
              localUrl: uploadResponse.z3URL ? fileURLs?.[fileId].localUrl : undefined,
            },
          });
        }
      }

      // Update completed paperwork state
      // Filter out file data
      formInputStringToBoolean(data, items);
      const paperworkData = filterObject(data, (key) => !allFileKeys.includes(key));
      patchCompletedPaperwork(paperworkData);
      useFilesStore.setState({});

      if (currentIndex === paperworkQuestions.length - 1) {
        navigate(IntakeFlowPageRoute.ReviewPaperwork.path);
      } else {
        navigate(`/paperwork/${nextPage?.slug || ''}`);
      }
    },
    [
      paperworkQuestions,
      fileItems,
      items,
      patchCompletedPaperwork,
      currentIndex,
      fileUploads,
      patientInfo.id,
      patchFileURLs,
      fileURLs,
      createZ3Object,
      apiClient,
      appointmentID,
      allFileKeys,
      navigate,
      nextPage?.slug,
    ]
  );
  const mapQuestionsToFormInputFields = useMapQuestionsToFormInputFields({
    getLabel: (item) => item.text.replace('{patientFirstName}', patientInfo?.firstName || 'Patient'),
    getDefaultValue: (item) =>
      item.type === 'Photos'
        ? (filterObject(fileURLs || {}, (key) => key.startsWith(item.id)) as FileURLs)
        : completedPaperwork[item.id] || fileURLs?.[item.id]?.localUrl || fileURLs?.[item.id]?.presignedUrl,
    getFileOptions: (item) => ({
      description: item.attachmentText,
      onUpload: setFileUploads,
      uploadFile: (fileType: string, tempURL: string) =>
        patchFileURLs({ [fileType]: { ...fileURLs?.[fileType], localUrl: tempURL } }),
      uploadFailed: Object.keys(fileUploads)
        .map((name) => ({ name, uploadFailed: fileUploads[name].uploadFailed }))
        .reduce(
          (prev, curr) => {
            prev[curr.name] = curr.uploadFailed;
            return prev;
          },
          {} as Record<string, boolean>
        ),
      resetUploadFailed: (fileType: string) =>
        setFileUploads((prev) => ({
          ...prev,
          [fileType]: { ...prev[fileType], uploadFailed: false },
        })),
      onClear: (fileType: string) => {
        setFileUploads((prev) => {
          delete prev[fileType];
          return prev;
        });
        useFilesStore.setState((prevState) => {
          const fileURLs = prevState.fileURLs;
          if (fileURLs) {
            delete fileURLs[fileType];
          }
          return { fileURLs };
        });
      },
      fileType: item.id,
    }),
  });

  const onFormValuesChange = useCallback(
    (formValues: FieldValues): void => {
      patchCompletedPaperwork(filterObject(formValues, (key) => !allFileKeys.includes(key)));
    },
    [allFileKeys, patchCompletedPaperwork]
  );

  const formElements = useMemo(() => mapQuestionsToFormInputFields(items), [mapQuestionsToFormInputFields, items]);

  return (
    <CustomContainer
      title={pageName}
      description={items[0]?.type === 'Description' ? items[0]?.text : undefined}
      bgVariant={currentPage.slug}
    >
      <PageForm
        formElements={formElements}
        onSubmit={onSubmit}
        onFormValuesChange={onFormValuesChange}
        controlButtons={useMemo(
          () => ({
            loading: createZ3Object.isLoading,
          }),
          [createZ3Object.isLoading]
        )}
      />
    </CustomContainer>
  );
};

export default PatientCondition;
