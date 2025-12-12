import ScannerIcon from '@mui/icons-material/Scanner';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, debounce, Grid, IconButton, Paper, Stack, TextField, Typography, useTheme } from '@mui/material';
import { styled } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PatientDocumentFoldersColumn,
  PatientDocumentFoldersColumnSkeleton,
} from 'src/features/visits/shared/components/patient/docs/PatientDocumentFoldersColumn';
import {
  DocumentTableActions,
  PatientDocumentsExplorerTable,
} from 'src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import { getFullName } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import DateSearch, { CustomFormEventHandler } from '../components/DateSearch';
import { LoadingScreen } from '../components/LoadingScreen';
import { RoundedButton } from '../components/RoundedButton';
import { ScannerModal } from '../components/ScannerModal';
import { useGetPatient } from '../hooks/useGetPatient';
import { PatientDocumentsFilters, PatientDocumentsFolder, useGetPatientDocs } from '../hooks/useGetPatientDocs';
import { usePatientStore } from '../state/patient.store';

const FileAttachmentHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const PatientDocumentsExplorerPage: FC = () => {
  const theme = useTheme();

  const { id: patientId } = useParams();
  const navigate = useNavigate();

  const { patient, loading: isLoadingPatientData } = useGetPatient(patientId);
  useEffect(() => {
    if (!patient) return;
    usePatientStore.setState({
      patient: patient,
    });
  }, [patient]);

  const {
    documents,
    isLoadingDocuments,
    documentsFolders,
    isLoadingFolders,
    searchDocuments,
    downloadDocument,
    documentActions,
  } = useGetPatientDocs(patientId!);

  const [searchDocNameFieldValue, setSearchDocNameFieldValue] = useState<string>('');
  const [docNameTextDebounced, setDocNameTextDebounced] = useState<string>('');
  const [searchDocAddedDate, setSearchDocAddedDate] = useState<DateTime | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>(undefined);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  const shouldShowClearFilters = searchDocNameFieldValue.trim().length > 0 || searchDocAddedDate || selectedFolder;

  const handleBackClickWithConfirmation = (): void => {
    navigate(-1);
  };

  useEffect(() => {
    const searchDateFromState = searchDocAddedDate ? searchDocAddedDate : undefined;
    const filters: PatientDocumentsFilters = {
      documentName: docNameTextDebounced,
      documentsFolder: selectedFolder,
      dateAdded: searchDateFromState,
    };

    searchDocuments(filters);
  }, [docNameTextDebounced, searchDocAddedDate, selectedFolder, searchDocuments]);

  const debounceTextInput = useMemo(
    () =>
      debounce((value: string, onDebounced: (v: string) => void) => {
        onDebounced(value);
      }, 2000),
    []
  );

  const handleSearchDocAddedDateChange: CustomFormEventHandler = useCallback(
    (event: any, value: any, field: string): void => {
      if (field === 'date') {
        const selectedDate = DateTime.fromISO(value);
        setSearchDocAddedDate(selectedDate);
      }
    },
    []
  );

  const handleSearchButtonClick = useCallback(() => {
    const searchDateFromState = searchDocAddedDate ? searchDocAddedDate : undefined;
    const filters: PatientDocumentsFilters = {
      documentName: docNameTextDebounced,
      documentsFolder: selectedFolder,
      dateAdded: searchDateFromState,
    };

    searchDocuments(filters);
  }, [docNameTextDebounced, searchDocAddedDate, searchDocuments, selectedFolder]);

  const handleSearchInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const textValue = e.target.value;
      setSearchDocNameFieldValue(textValue);
      debounceTextInput(textValue, () => {
        setDocNameTextDebounced(textValue);
      });
    },
    [debounceTextInput]
  );

  const handleFolderSelected = useCallback(
    (folder: PatientDocumentsFolder) => {
      const folderToSelect: PatientDocumentsFolder | undefined = folder.id !== selectedFolder?.id ? folder : undefined;

      setSelectedFolder(folderToSelect);
    },
    [selectedFolder?.id]
  );

  const handleClearFilters = useCallback(() => {
    setSearchDocAddedDate(null);
    setSelectedFolder(undefined);
    setDocNameTextDebounced('');
    setSearchDocNameFieldValue('');
    searchDocuments({});
  }, [searchDocuments]);

  const handleOpenScanModal = useCallback(() => {
    setIsScanModalOpen(true);
  }, []);

  const handleCloseScanModal = useCallback(() => {
    setIsScanModalOpen(false);
  }, []);

  const handleScanComplete = useCallback(
    async (fileBlob: Blob | Blob[], fileName: string): Promise<void> => {
      const folderId = selectedFolder?.id;
      if (!folderId) {
        enqueueSnackbar('No folder selected', { variant: 'error' });
        return;
      }

      try {
        // Since this page uses PDF format (default), fileBlob should be a single Blob
        if (Array.isArray(fileBlob)) {
          console.error('Unexpected array of blobs for PDF output format');
          enqueueSnackbar('Failed to upload scanned document', { variant: 'error' });
          return;
        }

        // Ensure fileName ends with .pdf extension
        const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const file = new File([fileBlob], finalFileName, { type: 'application/pdf' });

        await documentActions.uploadDocumentAction({
          docFile: file,
          fileName: finalFileName,
          fileFolderId: folderId,
        });

        enqueueSnackbar('Successfully uploaded scanned document', { variant: 'success' });
      } catch (error) {
        console.error('Error uploading scanned document:', error);
        enqueueSnackbar('Failed to upload scanned document', { variant: 'error' });
      }
    },
    [documentActions, selectedFolder?.id]
  );

  const handleDocumentUploadInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const { files } = event.target;

      const allFiles = (files && Array.from(files)) ?? [];
      const selectedFile = allFiles.at(0);

      if (!selectedFile) {
        console.warn('No file selected/available - earlier skip!');
        return;
      }

      const fileName = selectedFile.name;

      const validFileNamePattern = /^[a-zA-Z0-9+!\-_'()\\.@$]+$/;
      if (!validFileNamePattern.test(fileName)) {
        enqueueSnackbar(
          "Invalid file name. Spaces are not allowed. Only letters, numbers, and these characters are allowed: + ! - _ ' ( ) . @ $",
          {
            variant: 'error',
          }
        );
        event.target.value = '';
        return;
      }

      const folderId = selectedFolder?.id;
      if (!folderId) {
        console.warn('No folder selected - earlier skip!');
        return;
      }

      await documentActions.uploadDocumentAction({
        docFile: selectedFile,
        fileName: fileName,
        fileFolderId: folderId,
      });

      event.target.value = '';
    },
    [documentActions, selectedFolder?.id]
  );

  const documentTableActions: DocumentTableActions = useMemo(() => {
    return {
      isActionAllowed: (): boolean => {
        return true;
      },
      onDocumentDownload: downloadDocument,
    };
  }, [downloadDocument]);

  if (isLoadingPatientData) return <LoadingScreen />;

  return (
    <Box>
      <Header handleDiscard={handleBackClickWithConfirmation} id={patientId} />
      <Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CustomBreadcrumbs
            chain={[
              { link: '/patients', children: 'Patients' },
              {
                link: `/patient/${patient?.id}`,
                children: patient ? getFullName(patient) : '',
              },
              {
                link: '#',
                children: `Patient Profile`,
              },
            ]}
          />
          <Typography variant="subtitle1" color="primary.main">
            Docs
          </Typography>

          <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
            <Grid
              container
              sx={{
                height: 'auto',
                width: '50%',
                backgroundColor: 'transparent',
              }}
            >
              <Grid item xs={7}>
                <TextField
                  disabled={false}
                  value={searchDocNameFieldValue}
                  onChange={handleSearchInputChange}
                  fullWidth
                  size="small"
                  label="Document"
                  placeholder="Search"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    endAdornment: (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconButton
                          aria-label="clear patient search"
                          onClick={handleSearchButtonClick}
                          onMouseDown={(event) => event.preventDefault()}
                          sx={{ p: 0 }}
                        >
                          <SearchOutlinedIcon />
                        </IconButton>
                      </Box>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={4}>
                <Box sx={{ ml: 2, flexDirection: 'row' }}>
                  <DateSearch
                    label="Added Date"
                    date={searchDocAddedDate}
                    setDate={setSearchDocAddedDate}
                    updateURL={false}
                    storeDateInLocalStorage={false}
                    closeOnSelect={true}
                    small={true}
                    handleSubmit={handleSearchDocAddedDateChange}
                  />
                </Box>
              </Grid>

              <Grid item xs={1}>
                <Box sx={{ ml: 2, flexDirection: 'row' }}>
                  {shouldShowClearFilters && (
                    <RoundedButton
                      target="_blank"
                      variant="text"
                      sx={{ color: theme.palette.error.main }}
                      onClick={handleClearFilters}
                    >
                      Clear filters
                    </RoundedButton>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Grid
              container
              sx={{
                height: 'auto',
                width: '100%',
              }}
            >
              <Grid item xs={3}>
                <Box
                  sx={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 2,
                  }}
                >
                  {isLoadingFolders ? (
                    <PatientDocumentFoldersColumnSkeleton stubsCount={4} />
                  ) : (
                    <PatientDocumentFoldersColumn
                      documentsFolders={documentsFolders}
                      selectedFolder={selectedFolder}
                      onFolderSelected={handleFolderSelected}
                    />
                  )}
                </Box>
              </Grid>

              <Grid item xs={9} sx={{ pl: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {selectedFolder ? (
                    <Typography color="primary.main" sx={{ flexGrow: 1, fontSize: '24px', fontWeight: 800 }}>
                      {selectedFolder.folderName} {isLoadingDocuments ? '' : `- ${documents?.length ?? 0}`}
                    </Typography>
                  ) : (
                    <Typography color="primary.main" sx={{ flexGrow: 1, fontSize: '24px', fontWeight: 800 }}>
                      All documents
                    </Typography>
                  )}

                  <RoundedButton
                    disabled={!selectedFolder || documentActions.isUploading}
                    loading={documentActions.isUploading}
                    component="label"
                    target="_blank"
                    variant="outlined"
                    startIcon={<UploadFileIcon fontSize="small" />}
                  >
                    Upload
                    <FileAttachmentHiddenInput
                      onChange={handleDocumentUploadInputChange}
                      type="file"
                      capture="environment"
                    />
                  </RoundedButton>

                  <RoundedButton
                    disabled={!selectedFolder}
                    variant="outlined"
                    startIcon={<ScannerIcon fontSize="small" />}
                    onClick={handleOpenScanModal}
                  >
                    Scan
                  </RoundedButton>
                </Box>

                <PatientDocumentsExplorerTable
                  isLoadingDocs={isLoadingDocuments}
                  documents={documents}
                  documentTableActions={documentTableActions}
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Box>

      <ScannerModal open={isScanModalOpen} onClose={handleCloseScanModal} onScanComplete={handleScanComplete} />
    </Box>
  );
};

export default PatientDocumentsExplorerPage;
