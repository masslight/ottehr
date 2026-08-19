import ScannerIcon from '@mui/icons-material/Scanner';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, debounce, Grid, IconButton, Stack, styled, TextField, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useCallback, useEffect, useMemo, useState } from 'react';
import DateSearch, { CustomFormEventHandler } from 'src/components/DateSearch';
import { RoundedButton } from 'src/components/RoundedButton';
import { ScannerModal } from 'src/components/ScannerModal';
import { PatientDocumentsFilters, PatientDocumentsFolder, useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { PatientVisitOption, usePatientVisitOptions } from 'src/hooks/usePatientVisitOptions';
import { isSyntheticFolderId } from 'utils/lib/types/data/custom-folder.types';
import { PatientDocumentFoldersColumn, PatientDocumentFoldersColumnSkeleton } from './PatientDocumentFoldersColumn';
import {
  DocumentTableActions,
  DocumentTableActionType,
  PatientDocumentsExplorerTable,
} from './PatientDocumentsExplorerTable';
import { VisitFilterAutocomplete } from './VisitFilterAutocomplete';

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

const VALID_FILE_NAME_PATTERN = /^[a-zA-Z0-9+!\-_'()\\.@$ ]+$/;

export type PatientDocumentsExplorerProps = {
  patientId: string;
  /**
   * Scopes the explorer to a single visit: documents and folder counters are filtered to it, uploads
   * and scans are filed against it, and the visit filter is hidden (the visit is already fixed).
   * Omit for the patient-level Docs view.
   */
  encounterId?: string;
  /** Preselect this folder once folders have loaded, matched case-insensitively on display name. */
  initialFolderName?: string;
  /**
   * Browse-only: hides upload/scan and the rename/delete row actions. Downloading stays available.
   * Set by visit surfaces when the chart is locked or the user may not edit it.
   */
  readOnly?: boolean;
};

/**
 * The documents explorer shared by the patient Docs page, the Progress Note Documents tab and the
 * Visit Details "Visit Documents" section: search + date filter, folder sidebar, and the documents
 * table with upload/scan.
 */
export const PatientDocumentsExplorer: FC<PatientDocumentsExplorerProps> = ({
  patientId,
  encounterId,
  initialFolderName,
  readOnly = false,
}) => {
  const theme = useTheme();
  const isVisitScoped = !!encounterId;

  const {
    documents,
    isLoadingDocuments,
    documentsFolders,
    isLoadingFolders,
    searchDocuments,
    downloadDocument,
    renameDocument,
    documentActions,
  } = useGetPatientDocs(patientId, undefined, { uploadEncounterId: encounterId });

  const { visitOptions, isLoading: isLoadingVisits } = usePatientVisitOptions(isVisitScoped ? undefined : patientId);

  const [searchDocNameFieldValue, setSearchDocNameFieldValue] = useState<string>('');
  const [docNameTextDebounced, setDocNameTextDebounced] = useState<string>('');
  const [searchDocAddedDate, setSearchDocAddedDate] = useState<DateTime | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisitOption | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>(undefined);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [pendingSelectInternalName, setPendingSelectInternalName] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingSelectInternalName) return;
    const found = documentsFolders.find((f) => f.internalName === pendingSelectInternalName);
    if (found) {
      setSelectedFolder(found);
      setPendingSelectInternalName(null);
    }
  }, [documentsFolders, pendingSelectInternalName]);

  // Used by the Patient Follow-up Task "Go To Task" deep link from completed practice-managed forms.
  useEffect(() => {
    if (!initialFolderName) return;
    if (selectedFolder) return;
    if (!documentsFolders.length) return;
    const match = documentsFolders.find((f) => f.folderName?.toLowerCase() === initialFolderName.toLowerCase());
    if (match) setSelectedFolder(match);
  }, [initialFolderName, documentsFolders, selectedFolder]);

  const shouldShowClearFilters =
    searchDocNameFieldValue.trim().length > 0 || !!searchDocAddedDate || !!selectedFolder || !!selectedVisit;

  // When the explorer is visit-scoped the encounter comes from the host page, not the filter row.
  const activeEncounterId = encounterId ?? selectedVisit?.encounterId;

  useEffect(() => {
    const filters: PatientDocumentsFilters = {
      documentName: docNameTextDebounced,
      documentsFolder: selectedFolder,
      dateAdded: searchDocAddedDate ?? undefined,
      encounterId: activeEncounterId,
    };

    searchDocuments(filters);
  }, [docNameTextDebounced, searchDocAddedDate, selectedFolder, activeEncounterId, searchDocuments]);

  const debounceTextInput = useMemo(
    () =>
      debounce((value: string, onDebounced: (v: string) => void) => {
        onDebounced(value);
      }, 2000),
    []
  );

  const handleSearchDocAddedDateChange: CustomFormEventHandler = useCallback(
    (_event: any, value: any, field: string): void => {
      if (field === 'date') {
        setSearchDocAddedDate(DateTime.fromISO(value));
      }
    },
    []
  );

  // The filters already re-run the search on change; this just skips the text debounce.
  const handleSearchButtonClick = useCallback(() => {
    setDocNameTextDebounced(searchDocNameFieldValue);
  }, [searchDocNameFieldValue]);

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
      setSelectedFolder(folder.id !== selectedFolder?.id ? folder : undefined);
    },
    [selectedFolder?.id]
  );

  const handleClearFilters = useCallback(() => {
    setSearchDocAddedDate(null);
    setSelectedFolder(undefined);
    setSelectedVisit(null);
    setDocNameTextDebounced('');
    setSearchDocNameFieldValue('');
  }, []);

  const handleOpenScanModal = useCallback(() => setIsScanModalOpen(true), []);
  const handleCloseScanModal = useCallback(() => setIsScanModalOpen(false), []);

  // First upload to a synthetic folder creates the real per-patient List; re-select by internalName
  // so the doc search re-keys off the real id (the synthetic id short-circuits to an empty result set).
  const reselectFolderIfSynthetic = useCallback(
    (wasSynthetic: boolean) => {
      if (wasSynthetic && selectedFolder?.internalName) {
        setPendingSelectInternalName(selectedFolder.internalName);
      }
    },
    [selectedFolder?.internalName]
  );

  const handleScanComplete = useCallback(
    async (fileBlob: Blob | Blob[], fileName: string): Promise<void> => {
      const folderId = selectedFolder?.id;
      if (!folderId) {
        enqueueSnackbar('No folder selected', { variant: 'error' });
        return;
      }

      try {
        // This explorer uses PDF format (default), so fileBlob should be a single Blob.
        if (Array.isArray(fileBlob)) {
          console.error('Unexpected array of blobs for PDF output format');
          enqueueSnackbar('Failed to upload scanned document', { variant: 'error' });
          return;
        }

        const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const file = new File([fileBlob], finalFileName, { type: 'application/pdf' });

        const wasSynthetic = isSyntheticFolderId(folderId);
        await documentActions.uploadDocumentAction({
          docFile: file,
          fileName: finalFileName,
          fileFolderId: folderId,
          internalName: selectedFolder?.internalName,
        });
        reselectFolderIfSynthetic(wasSynthetic);

        enqueueSnackbar('Successfully uploaded scanned document', { variant: 'success' });
      } catch (error) {
        console.error('Error uploading scanned document:', error);
        enqueueSnackbar('Failed to upload scanned document', { variant: 'error' });
      }
    },
    [documentActions, reselectFolderIfSynthetic, selectedFolder?.id, selectedFolder?.internalName]
  );

  const handleDocumentUploadInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const { files } = event.target;

      const selectedFile = ((files && Array.from(files)) ?? []).at(0);

      if (!selectedFile) {
        console.warn('No file selected/available - earlier skip!');
        return;
      }

      const fileName = selectedFile.name;

      if (!VALID_FILE_NAME_PATTERN.test(fileName)) {
        enqueueSnackbar(
          "Invalid file name. Only letters, numbers, spaces, and these characters are allowed: + ! - _ ' ( ) . @ $",
          { variant: 'error' }
        );
        event.target.value = '';
        return;
      }

      const folderId = selectedFolder?.id;
      if (!folderId) {
        console.warn('No folder selected - earlier skip!');
        return;
      }

      const wasSynthetic = isSyntheticFolderId(folderId);
      try {
        await documentActions.uploadDocumentAction({
          docFile: selectedFile,
          fileName: fileName,
          fileFolderId: folderId,
          internalName: selectedFolder?.internalName,
        });
        reselectFolderIfSynthetic(wasSynthetic);
      } catch (error) {
        console.error('Error uploading document:', error);
        enqueueSnackbar('Failed to upload document', { variant: 'error' });
      } finally {
        // Always clear the input, or picking the same file again fires no change event and the
        // retry silently does nothing.
        event.target.value = '';
      }
    },
    [documentActions, reselectFolderIfSynthetic, selectedFolder?.id, selectedFolder?.internalName]
  );

  const documentTableActions: DocumentTableActions = useMemo(() => {
    return {
      // Reading a document is always allowed; only the mutating actions respect read-only.
      isActionAllowed: (_documentId: string, actionType: DocumentTableActionType): boolean =>
        actionType === DocumentTableActionType.ActionDownload || !readOnly,
      onDocumentDownload: downloadDocument,
      onDocumentRename: renameDocument,
      onDocumentDelete: documentActions.deleteDocumentAction,
    };
  }, [documentActions.deleteDocumentAction, downloadDocument, renameDocument, readOnly]);

  return (
    <Stack spacing={2}>
      <Grid container sx={{ height: 'auto', width: isVisitScoped ? '50%' : '75%', backgroundColor: 'transparent' }}>
        <Grid item xs={isVisitScoped ? 7 : 4}>
          <TextField
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
                    aria-label="search documents"
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

        <Grid item xs={isVisitScoped ? 4 : 3}>
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

        {!isVisitScoped && (
          <Grid item xs={3}>
            <Box sx={{ ml: 2, flexDirection: 'row' }}>
              <VisitFilterAutocomplete
                visitOptions={visitOptions}
                isLoading={isLoadingVisits}
                selectedVisit={selectedVisit}
                onVisitSelected={setSelectedVisit}
              />
            </Box>
          </Grid>
        )}

        <Grid item xs={isVisitScoped ? 1 : 2}>
          <Box sx={{ ml: 2, flexDirection: 'row' }}>
            {shouldShowClearFilters && (
              <RoundedButton variant="text" sx={{ color: theme.palette.error.main }} onClick={handleClearFilters}>
                Clear filters
              </RoundedButton>
            )}
          </Box>
        </Grid>
      </Grid>

      <Grid container sx={{ height: 'auto', width: '100%' }}>
        <Grid item xs={3}>
          <Box sx={{ backgroundColor: '#F9FAFB', borderRadius: 2 }}>
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
            <Typography color="primary.main" sx={{ flexGrow: 1, fontSize: '24px', fontWeight: 800 }}>
              {selectedFolder
                ? `${selectedFolder.folderName}${isLoadingDocuments ? '' : ` - ${documents?.length ?? 0}`}`
                : 'All Documents'}
            </Typography>

            {!readOnly && (
              <>
                <RoundedButton
                  disabled={documentActions.isUploading}
                  loading={documentActions.isUploading}
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon fontSize="small" />}
                  onClick={(event) => {
                    if (!selectedFolder) {
                      event.preventDefault();
                      enqueueSnackbar('Please select a folder where you want to upload the doc', {
                        variant: 'warning',
                      });
                    }
                  }}
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
              </>
            )}
          </Box>

          <PatientDocumentsExplorerTable
            isLoadingDocs={isLoadingDocuments}
            documents={documents}
            documentTableActions={documentTableActions}
            patientId={patientId}
          />
        </Grid>
      </Grid>

      <ScannerModal open={isScanModalOpen} onClose={handleCloseScanModal} onScanComplete={handleScanComplete} />
    </Stack>
  );
};
