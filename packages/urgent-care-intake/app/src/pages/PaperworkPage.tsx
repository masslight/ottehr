import { useLocation, useNavigate } from 'react-router-dom';
import { CustomContainer } from '../components';
import { IntakeDataContext } from '../store/IntakeContext';
// import { ContactInfo } from '../types';
import { useTheme } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useState } from 'react';
import { ErrorDialog, useZambdaClient, StringFormat, PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../IntakeThemeProvider';
import { zapehrApi } from '../api';
import { safelyCaptureException } from '../helpers/sentry';
import { updateCompletedPaperwork, updateFileURLs } from '../store/IntakeActions';
import { VisitType } from '../store/types';
import { FileURLs, FileUpload, Question, fileFormats } from '../types/types';

// Checkbox values are returned as 'true' and 'false' instead of true and false respectively.
// This sets them as booleans.
function formInputStringToBoolean(data: any, questions: Question[]): any {
  for (const questionTemp of questions) {
    if (questionTemp.type !== 'Checkbox') {
      continue;
    }

    for (const responseTemp of Object.keys(data)) {
      if (questionTemp.id === responseTemp) {
        if (data[responseTemp] === 'true') {
          data[responseTemp] = true;
        } else if (data[responseTemp] === 'false') {
          data[responseTemp] = false;
        }
        break;
      }
    }
  }
}

// To keep file data separate from form data filter it out. Once to get the file data
// then another time to get non-file form data
function filterObject(obj: any, callback: (key: string) => boolean): object {
  return Object.fromEntries(Object.entries(obj).filter(([key, _]) => callback(key)));
}

const PaperworkPage = (): JSX.Element => {
  const location = useLocation();
  const theme = useTheme();
  const { t } = useTranslation();
  const slug = location.pathname.replace('/paperwork/', '');
  const [fileErrorDialogOpen, setFileErrorDialogOpen] = useState<boolean>(false);
  const { state, dispatch } = useContext(IntakeDataContext);
  if (!state.paperworkQuestions) {
    throw new Error('paperworkQuestions is not defined');
  }
  const currentPage = state.paperworkQuestions.find((pageTemp) => pageTemp.slug === slug);
  if (!currentPage) {
    throw new Error('currentPage is not defined');
  }

  const pageName = currentPage.page;
  const items = currentPage.questions;

  useEffect(() => {
    mixpanel.track(pageName);
  }, [pageName]);

  const navigate = useNavigate();
  const currentIndex = state.paperworkQuestions.findIndex((pageTemp) => pageTemp.page === pageName);
  const nextIndex = state.paperworkQuestions[currentIndex + 1];

  // File upload variables
  const fileItems = items.filter((item) => item.type === 'File');
  const [fileUploads, setFileUploads] = useState<FileUpload>({});
  const [loading, setLoading] = useState<boolean>(false);
  const zambdaClient = useZambdaClient({ tokenless: true });

  // Create object keys for each file input using the input name if the key doesn't already exist
  useEffect(() => {
    if (fileItems.length > 0) {
      fileItems.forEach((fileItem) => {
        !(fileItem.id in fileUploads) &&
          setFileUploads((prev) => ({ ...prev, [fileItem.id]: { fileData: null, uploadFailed: false } }));
      });
    }
  }, [fileItems, fileUploads]);

  const onSubmit = async (data: any): Promise<void> => {
    if (!state.paperworkQuestions) {
      throw new Error('paperworkQuestions is not defined');
    }

    // Upload files to z3 if the page includes File type input
    if (fileItems.length > 0) {
      let uploadResponse: any;

      setLoading(true);

      if (!zambdaClient) {
        throw new Error('Zambda client is not found');
      }

      for (const fileItem of fileItems) {
        const fileId = fileItem.id;
        const fileData = fileUploads[fileId].fileData;
        const fileFormat = fileData?.type.split('/')[1];
        if (fileFormat && !fileFormats.includes(fileFormat)) {
          setFileErrorDialogOpen(true);
          setLoading(false);
          return;
        }

        if (state.appointmentID && fileData) {
          uploadResponse = await zapehrApi
            .createZ3Object(state.appointmentID, fileId, fileData.type.split('/')[1], zambdaClient, fileData, dispatch)
            .catch((error: any) => {
              safelyCaptureException(error);
              console.error(error);
            });
        }

        if (fileData && !uploadResponse) {
          // Reset fields if Z3 upload fails
          setFileUploads((prev) => ({
            ...prev,
            [fileId]: { fileData: null, uploadFailed: true },
          }));
          data[fileId] = undefined;
          setLoading(false);
          return;
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
            data[fileId] = state.fileURLs?.[fileId].z3Url;
          }
        }
      }
      setLoading(false);
    }

    // Update state.fileURLs
    if (fileItems.length > 0) {
      const formFileKeys = fileItems.map((item) => item.id);
      const fileUploadData: any = filterObject(data, (key) => formFileKeys.includes(key));
      const fileURLsUpdated: FileURLs = {};
      formFileKeys.forEach((key) => {
        fileURLsUpdated[key] = {
          ...state.fileURLs?.[key],
          z3Url: fileUploadData[key],
          localUrl: fileUploadData[key] ? state.fileURLs?.[key].localUrl : undefined, // Reset localUrl if no data[fileId]
        };
      });
      updateFileURLs({ ...state.fileURLs, ...fileURLsUpdated }, dispatch);
    }

    // Update completed paperwork state
    // Filter out file data
    formInputStringToBoolean(data, items);
    const allFileKeys = Object.keys(fileUploads);
    const paperworkData = filterObject(data, (key) => !allFileKeys.includes(key));
    updateCompletedPaperwork({ ...state.completedPaperwork, ...paperworkData }, dispatch);

    if (currentIndex === state.paperworkQuestions.length - 1) {
      navigate(IntakeFlowPageRoute.ReviewPaperwork.path);
    } else {
      navigate(`/paperwork/${nextIndex.slug}`);
    }
  };

  return (
    // if the first item is a description, it can be the custom container description
    <CustomContainer
      title={pageName}
      description={items[0]?.type === 'Description' ? items[0]?.text : undefined}
      bgVariant={currentPage.slug}
    >
      <PageForm
        formElements={items
          .filter((item, index: number) => !(item.type === 'Description' && index === 0))
          .map((item) => ({
            type: item.type,
            name: item.id,
            // todo don't hardcode specific item
            label: item.text.replace('{patientFirstName}', state.patientInfo?.firstName || 'Patient'),
            defaultValue:
              state.completedPaperwork[item.id] ||
              state.fileURLs?.[item.id]?.localUrl ||
              state.fileURLs?.[item.id]?.presignedUrl,
            required: item.required,
            enableWhen: item.enableWhen,
            requireWhen: item.requireWhen,
            width: item.width,
            placeholder: item.placeholder,
            fileOptions: {
              description: item.attachmentText,
              onUpload: setFileUploads,
              uploadFile: (fileType: string, tempURL: string) =>
                updateFileURLs(
                  { ...state.fileURLs, [fileType]: { ...state.fileURLs?.[fileType], localUrl: tempURL } },
                  dispatch,
                ),
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
                updateFileURLs(
                  { ...state.fileURLs, [item.id]: { localUrl: undefined, presignedUrl: undefined, z3Url: undefined } },
                  dispatch,
                );
              },
              fileType: item.id,
            },
            multiline: item.multiline,
            minRows: item.minRows,
            infoText: item.infoText,
            infoTextSecondary: item.infoTextSecondary,
            selectOptions: item.options?.map((itemTemp) => ({
              label: itemTemp,
              value: itemTemp,
            })),
            radioOptions: item.options?.map((itemTemp) => ({
              label: itemTemp,
              value: itemTemp,
            })),
            format: item.format as StringFormat,
            borderColor: otherColors.borderGray,
            backgroundSelected: otherColors.lightBlue,
            radioStyling: {
              radio: {
                alignSelf: 'center',
                marginY: 'auto',
              },
              label: {
                ...theme.typography.body2,
                color: theme.palette.text.primary,
              },
            },
          }))}
        onSubmit={onSubmit}
        controlButtons={{
          backButton: state.visitType !== VisitType.WalkIn || currentIndex !== 0,
          loading: loading,
        }}
      />
      <ErrorDialog
        open={fileErrorDialogOpen}
        title={t('paperwork.errors.file.title')}
        description={t('paperwork.errors.file.description')}
        closeButtonText={t('paperwork.errors.file.close')}
        handleClose={() => setFileErrorDialogOpen(false)}
      />
    </CustomContainer>
  );
};

export default PaperworkPage;
