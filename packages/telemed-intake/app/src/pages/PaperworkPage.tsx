import { useCallback, useEffect, useMemo, useState } from 'react';
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

const PaperworkPage = (): JSX.Element => {
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
  const { fileURLs, patchFileURLs } = getSelectors(useFilesStore, ['fileURLs', 'patchFileURLs']); // use FilesStore.setState(...) and NOT filesStore.setState(...)

  const { items, nextPage, pageName, currentPage, currentIndex } = usePaperworkPageInfo({
    location,
    paperworkQuestions,
  });

  // File upload variables
  const fileItems = items.filter((item) => item.type === 'File');
  const [fileUploads, setFileUploads] = useState<FileUpload>({});
  const allFileKeys = Object.keys(fileUploads);

  // Create object keys for each file input using the input name if the key doesn't already exist
  useEffect(() => {
    if (fileItems.length > 0) {
      fileItems.forEach((fileItem) => {
        !(fileItem.id in fileUploads) &&
          setFileUploads((prev) => ({ ...prev, [fileItem.id]: { fileData: null, uploadFailed: false } }));
      });
    }
  }, [fileItems, fileUploads]);

  const onSubmit = useCallback(
    async (data: FieldValues): Promise<void> => {
      if (!paperworkQuestions) {
        throw new Error('paperworkQuestions is not defined');
      }

      // Upload files to z3 if the page includes File type input
      if (fileItems.length > 0) {
        let uploadResponse: any;

        for (const fileItem of fileItems) {
          const fileId = fileItem.id;
          const fileData = fileUploads[fileId].fileData;

          if (patientInfo.id && fileData) {
            await createZ3Object.mutateAsync(
              {
                apiClient,
                fileType: fileId,
                fileFormat: getFileTypeFromFile(data[fileId] || ''),
                file: fileData,
                appointmentID,
              },
              {
                onSuccess: (response) => {
                  uploadResponse = response;
                },
                onError: (error) => {
                  throw error;
                },
              }
            );
          }

          if (fileData && !uploadResponse) {
            // Reset fields if Z3 upload fails
            setFileUploads((prev) => ({
              ...prev,
              [fileId]: { fileData: null, uploadFailed: true },
            }));
            data[fileId] = undefined;
          } else if (fileData && uploadResponse) {
            data[fileId] = uploadResponse.z3URL;

            // Reset file data when user continues to next  page
            setFileUploads((prev) => ({
              ...prev,
              [fileId]: { fileData: null, uploadFailed: prev[fileId].uploadFailed },
            }));
          } else {
            // Reset state for files because upload blob url overwrites Front and Back Url data
            // Only when cards are not being cleared
            if (data[fileId]) {
              data[fileId] = fileURLs?.[fileId]?.z3Url;
            }
          }
        }
      }

      // Update state.fileURLs
      if (fileItems.length > 0) {
        const formFileKeys = fileItems.map((item) => item.id);
        const fileUploadData: any = filterObject(data, (key) => formFileKeys.includes(key));
        const fileURLsUpdated: FileURLs = {};
        formFileKeys.forEach((key) => {
          fileURLsUpdated[key] = {
            ...fileURLs?.[key],
            z3Url: fileUploadData[key],
            localUrl: fileUploadData[key] ? fileURLs?.[key].localUrl : undefined, // Reset localUrl if no data[fileId]
          };
        });
        patchFileURLs(fileURLsUpdated);
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
      createZ3Object,
      apiClient,
      appointmentID,
      fileURLs,
      patchFileURLs,
      allFileKeys,
      navigate,
      nextPage?.slug,
    ]
  );

  const mapQuestionsToFormInputFields = useMapQuestionsToFormInputFields({
    getLabel: (item) => item.text.replace('{patientFirstName}', patientInfo?.firstName || 'Patient'),
    getDefaultValue: (item) =>
      completedPaperwork[item.id] || fileURLs?.[item.id]?.localUrl || fileURLs?.[item.id]?.presignedUrl,
    getFileOptions: (item) => ({
      description: item.attachmentText,
      onUpload: setFileUploads,
      uploadFile: (fileType: string, tempURL: string) =>
        patchFileURLs({ [fileType]: { ...fileURLs?.[fileType], localUrl: tempURL } }),
      uploadFailed: fileUploads[item.id]?.uploadFailed,
      resetUploadFailed: () =>
        setFileUploads((prev) => ({
          ...prev,
          [item.id]: { ...prev[item.id], uploadFailed: false },
        })),
      onClear: () => {
        setFileUploads((prev) => ({
          ...prev,
          [item.id]: { ...prev[item.id], fileData: null },
        }));
        patchFileURLs({
          [item.id]: { localUrl: undefined, presignedUrl: undefined, z3Url: undefined },
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
            onBack:
              currentIndex === 0 ? () => navigate(IntakeFlowPageRoute.PatientInformation.path) : () => navigate(-1),
          }),
          [createZ3Object.isLoading, navigate, currentIndex]
        )}
      />
    </CustomContainer>
  );
};

export default PaperworkPage;
