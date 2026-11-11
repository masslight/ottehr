import DownloadIcon from '@mui/icons-material/Download';
import ScannerIcon from '@mui/icons-material/Scanner';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, debounce, Grid, IconButton, Stack, TextField, Typography, useTheme } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid-pro';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DateSearch, { CustomFormEventHandler } from 'src/components/DateSearch';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { useDownloadDocumentsZip } from 'src/hooks/useDownloadDocumentsZip';
import {
  DocumentVisitRef,
  PatientDocumentsFilters,
  PatientDocumentsFolder,
  useGetPatientDocs,
} from 'src/hooks/useGetPatientDocs';
import { PatientVisitOption, usePatientVisitOptions } from 'src/hooks/usePatientVisitOptions';
import { isSyntheticFolderId } from 'utils/lib/types/data/custom-folder.types';
import { describeIncompleteArchive, isSingleFileDownload, makeDocumentsZipFileName } from './documentsZip';
import { PatientDocumentFoldersColumn, PatientDocumentFoldersColumnSkeleton } from './PatientDocumentFoldersColumn';
import {
  DocumentTableActions,
  DocumentTableActionType,
  PatientDocumentsExplorerTable,
} from './PatientDocumentsExplorerTable';
import { UploadDocumentDialog, UploadDocumentMode } from './UploadDocumentDialog';
import { VisitFilterAutocomplete } from './VisitFilterAutocomplete';

const DOWNLOAD_ERROR_MESSAGES = {
  file: {
    tooLarge: 'The file is too large to download.',
    noneDownloaded: 'The file could not be downloaded. Please try again.',
    failed: 'The file could not be downloaded. Please try again.',
  },
  archive: {
    tooLarge: 'The archive is too large. Please select fewer documents and try again.',
    noneDownloaded: 'None of the selected documents could be downloaded. Please try again.',
    failed: 'Failed to download the selected documents. Please try again.',
  },
};

export type PatientDocumentsExplorerProps = {
  patientId: string;
  patient?: Patient;
  /**
   * Visit that uploads and scans are filed against. Set by visit surfaces; the documents shown stay
   * patient-wide. Omit for the patient-level Docs view.
   */
  uploadEncounterId?: string;
  /** Preselect this folder once folders have loaded, matched case-insensitively on display name. */
  initialFolderName?: string;
  /** Preselect this folder once folders have loaded, matched on its List id. Wins over `initialFolderName`. */
  initialFolderId?: string;
  /**
   * Browse-only: hides upload/scan and the rename/delete row actions. Downloading stays available.
   * Set by visit surfaces when the chart is locked or the user may not edit it.
   */
  readOnly?: boolean;
};

/**
 * The documents explorer shared by the patient Docs page, the Progress Note Documents tab and the
 * Visit Details "All Documents" section: search + date + visit filters, folder sidebar, and the
 * documents table with upload/scan.
 */
export const PatientDocumentsExplorer: FC<PatientDocumentsExplorerProps> = ({
  patientId,
  patient,
  uploadEncounterId,
  initialFolderName,
  initialFolderId,
  readOnly = false,
}) => {
  const theme = useTheme();

  const {
    documents,
    isLoadingDocuments,
    documentsFolders,
    isLoadingFolders,
    searchDocuments,
    downloadDocument,
    renameDocument,
    documentActions,
  } = useGetPatientDocs(patientId, undefined, { uploadEncounterId });

  const { visitOptions, isLoading: isLoadingVisits } = usePatientVisitOptions(patientId);
  const [searchDocNameFieldValue, setSearchDocNameFieldValue] = useState<string>('');
  const [docNameTextDebounced, setDocNameTextDebounced] = useState<string>('');
  const [searchDocAddedDate, setSearchDocAddedDate] = useState<DateTime | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisitOption | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>(undefined);
  const [uploadMode, setUploadMode] = useState<UploadDocumentMode | null>(null);
  const [pendingSelectInternalName, setPendingSelectInternalName] = useState<string | null>(null);
  const [documentIdToFax, setDocumentIdToFax] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<GridRowSelectionModel>([]);
  const { downloadDocumentsZip, isDownloading: isDownloadingDocuments } = useDownloadDocumentsZip();

  const faxSource = useMemo(
    () =>
      documentIdToFax ? ({ type: 'document', patientId, documentReferenceId: documentIdToFax } as const) : undefined,
    [documentIdToFax, patientId]
  );
  const faxController = useSendFax(faxSource);
  const { open: openFaxDialog, isOpen: isFaxDialogOpen } = faxController;

  useEffect(() => {
    if (!isFaxDialogOpen) setDocumentIdToFax(null);
  }, [isFaxDialogOpen]);

  // A dialog left open across navigation must not file into another patient or visit.
  const uploadTarget = useRef({ patientId, uploadEncounterId });
  const uploadTargetChanged =
    uploadTarget.current.patientId !== patientId || uploadTarget.current.uploadEncounterId !== uploadEncounterId;
  useEffect(() => {
    const previous = uploadTarget.current;
    uploadTarget.current = { patientId, uploadEncounterId };
    if (previous.patientId !== patientId || previous.uploadEncounterId !== uploadEncounterId) setUploadMode(null);
  }, [patientId, uploadEncounterId]);

  const handleDocumentFax = useCallback(
    (documentId: string): void => {
      setDocumentIdToFax(documentId);
      openFaxDialog();
    },
    [openFaxDialog]
  );

  useEffect(() => {
    if (!pendingSelectInternalName) return;
    const found = documentsFolders.find((f) => f.internalName === pendingSelectInternalName);
    if (found) {
      setSelectedFolder(found);
      setPendingSelectInternalName(null);
    }
  }, [documentsFolders, pendingSelectInternalName]);

  // The first upload into a catalog-only folder creates its real List.
  useEffect(() => {
    if (!selectedFolder?.internalName || !isSyntheticFolderId(selectedFolder.id)) return;
    const real = documentsFolders.find(
      (f) => f.internalName === selectedFolder.internalName && !isSyntheticFolderId(f.id)
    );
    if (real) setSelectedFolder(real);
  }, [documentsFolders, selectedFolder]);

  // Task deep links: Patient Follow-up "Go To Task" (by name) and the inbound fax review "View" (by id).
  // Applied once, so clearing the folder afterwards doesn't re-select it.
  const initialFolderApplied = useRef(false);
  useEffect(() => {
    if (initialFolderApplied.current || selectedFolder) return;
    const match = documentsFolders.find((f) =>
      initialFolderId
        ? f.id === initialFolderId
        : !!initialFolderName && f.folderName?.toLowerCase() === initialFolderName.toLowerCase()
    );
    if (!match) return;
    initialFolderApplied.current = true;
    setSelectedFolder(match);
  }, [initialFolderId, initialFolderName, documentsFolders, selectedFolder]);

  const shouldShowClearFilters =
    searchDocNameFieldValue.trim().length > 0 || !!searchDocAddedDate || !!selectedFolder || !!selectedVisit;

  const activeVisit: DocumentVisitRef | undefined = useMemo(
    () =>
      selectedVisit
        ? { encounterId: selectedVisit.encounterId, appointmentId: selectedVisit.appointmentId }
        : undefined,
    [selectedVisit]
  );

  useEffect(() => {
    const filters: PatientDocumentsFilters = {
      documentName: docNameTextDebounced,
      documentsFolder: selectedFolder,
      dateAdded: searchDocAddedDate ?? undefined,
      visit: activeVisit,
    };

    searchDocuments(filters);
  }, [docNameTextDebounced, searchDocAddedDate, selectedFolder, activeVisit, searchDocuments]);

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

  // Selecting by internalName also picks up the real List created for a synthetic folder.
  const handleUploaded = useCallback((folder: PatientDocumentsFolder) => {
    setPendingSelectInternalName(folder.internalName ?? null);
  }, []);

  const handleDownloadSelectedDocuments = useCallback(async (): Promise<void> => {
    const selectedDocuments = (documents ?? []).filter((document) => selectedDocumentIds.includes(document.id));
    if (selectedDocuments.length === 0) {
      enqueueSnackbar('Please select the documents you want to download.');
      return;
    }

    const messages = DOWNLOAD_ERROR_MESSAGES[isSingleFileDownload(selectedDocuments) ? 'file' : 'archive'];
    try {
      const result = await downloadDocumentsZip(selectedDocuments, makeDocumentsZipFileName(patient));
      switch (result.status) {
        case 'saved':
          if (result.affectedDocumentNames.length > 0) {
            enqueueSnackbar(describeIncompleteArchive(result.affectedDocumentNames), { variant: 'warning' });
          }
          break;
        case 'too-large':
          enqueueSnackbar(messages.tooLarge, { variant: 'error' });
          break;
        case 'none-downloaded':
          enqueueSnackbar(messages.noneDownloaded, { variant: 'error' });
          break;
        case 'cancelled':
          break;
      }
    } catch (error) {
      console.error('Failed to download the selected documents', error);
      enqueueSnackbar(messages.failed, { variant: 'error' });
    }
  }, [documents, downloadDocumentsZip, patient, selectedDocumentIds]);

  const documentTableActions: DocumentTableActions = useMemo(() => {
    return {
      // Reading a document is always allowed; only the mutating actions respect read-only.
      isActionAllowed: (_documentId: string, actionType: DocumentTableActionType): boolean =>
        actionType === DocumentTableActionType.ActionDownload || !readOnly,
      onDocumentDownload: downloadDocument,
      onDocumentFax: handleDocumentFax,
      onDocumentRename: renameDocument,
      onDocumentDelete: documentActions.deleteDocumentAction,
    };
  }, [documentActions.deleteDocumentAction, downloadDocument, handleDocumentFax, renameDocument, readOnly]);

  return (
    <Stack spacing={2}>
      <Grid container sx={{ height: 'auto', width: '75%', backgroundColor: 'transparent' }}>
        <Grid item xs={4}>
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

        <Grid item xs={3}>
          <Box sx={{ ml: 2, flexDirection: 'row' }}>
            <DateSearch
              label="Added date"
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

        <Grid item xs={2}>
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
                  variant="outlined"
                  startIcon={<UploadFileIcon fontSize="small" />}
                  onClick={() => setUploadMode('upload')}
                >
                  Upload
                </RoundedButton>

                <RoundedButton
                  variant="outlined"
                  startIcon={<ScannerIcon fontSize="small" />}
                  onClick={() => setUploadMode('scan')}
                >
                  Scan
                </RoundedButton>
              </>
            )}

            <RoundedButton
              disabled={isDownloadingDocuments}
              loading={isDownloadingDocuments}
              variant="outlined"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={() => void handleDownloadSelectedDocuments()}
              data-testid={dataTestIds.patientDocsPage.downloadSelectedDocumentsButton}
            >
              Download
            </RoundedButton>
          </Box>

          <PatientDocumentsExplorerTable
            isLoadingDocs={isLoadingDocuments}
            documents={documents}
            documentTableActions={documentTableActions}
            patientId={patientId}
            selectedDocumentIds={selectedDocumentIds}
            onSelectedDocumentIdsChange={setSelectedDocumentIds}
          />
        </Grid>
      </Grid>

      {uploadMode && !uploadTargetChanged && (
        <UploadDocumentDialog
          open
          mode={uploadMode}
          onClose={() => setUploadMode(null)}
          patientId={patientId}
          encounterId={uploadEncounterId}
          defaultFolderId={selectedFolder?.id}
          onUploaded={handleUploaded}
        />
      )}
      <SendFaxDialog controller={faxController} title="Fax Document" />
    </Stack>
  );
};
