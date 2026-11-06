import DownloadIcon from '@mui/icons-material/Download';
import ScannerIcon from '@mui/icons-material/Scanner';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, debounce, Grid, IconButton, Stack, styled, TextField, Typography, useTheme } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid-pro';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useCallback, useEffect, useMemo, useState } from 'react';
import DateSearch, { CustomFormEventHandler } from 'src/components/DateSearch';
import { RoundedButton } from 'src/components/RoundedButton';
import { ScannerModal } from 'src/components/ScannerModal';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { useDownloadDocumentsZip } from 'src/hooks/useDownloadDocumentsZip';
import {
  DocumentVisitRef,
  PatientDocumentInfo,
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

/** Turns the explorer into a document picker (the referral form's "Add documents" dialog). */
export type PatientDocumentsPickerOptions = {
  /** Internal names of the folders offered; documents filed only elsewhere are not listed. */
  folderNames: readonly string[];
  /** Whether a document filed in `folderName` can be chosen, e.g. only results from Labs. */
  isDocumentAllowed: (folderName: string, document: PatientDocumentInfo) => boolean;
  /** Leaves this visit's documents and the visit itself out of the picker. */
  excludeEncounterId?: string;
  initialSelectedIds?: string[];
  /** Start filtered to the most recent visit with its offered documents ticked. */
  preselectLatestVisit?: boolean;
  /** Every change of the selection; `documentsById` holds each document listed so far. */
  onSelectionChange: (selectedIds: string[], documentsById: ReadonlyMap<string, PatientDocumentInfo>) => void;
};

const isDocumentOfVisit = (document: PatientDocumentInfo, visit: DocumentVisitRef): boolean =>
  (!!document.encounterId && document.encounterId === visit.encounterId) ||
  (!!document.appointmentId && document.appointmentId === visit.appointmentId);

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
  /**
   * Browse-only: hides upload/scan and the rename/delete row actions. Downloading stays available.
   * Set by visit surfaces when the chart is locked or the user may not edit it.
   */
  readOnly?: boolean;
  /** Picker mode: no upload, scan, download or row actions; omitted everywhere else. */
  picker?: PatientDocumentsPickerOptions;
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
  readOnly = false,
  picker,
}) => {
  const theme = useTheme();

  const {
    documents: allDocuments,
    isLoadingDocuments,
    documentsFolders: allDocumentsFolders,
    isLoadingFolders,
    searchDocuments,
    downloadDocument,
    renameDocument,
    documentActions,
  } = useGetPatientDocs(patientId, undefined, { uploadEncounterId });

  const {
    visitOptions: allVisitOptions,
    visitsByEncounterId,
    isLoading: isLoadingVisits,
  } = usePatientVisitOptions(patientId);
  const [searchDocNameFieldValue, setSearchDocNameFieldValue] = useState<string>('');
  const [docNameTextDebounced, setDocNameTextDebounced] = useState<string>('');
  const [searchDocAddedDate, setSearchDocAddedDate] = useState<DateTime | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisitOption | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>(undefined);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [pendingSelectInternalName, setPendingSelectInternalName] = useState<string | null>(null);
  const [documentIdToFax, setDocumentIdToFax] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<GridRowSelectionModel>(
    picker?.initialSelectedIds ?? []
  );
  const { downloadDocumentsZip, isDownloading: isDownloadingDocuments } = useDownloadDocumentsZip();

  // Picker mode narrows what the explorer lists; without a picker every value below is the hook's own.
  const [seenDocuments, setSeenDocuments] = useState<ReadonlyMap<string, PatientDocumentInfo>>(new Map());
  const [hasPreselected, setHasPreselected] = useState(false);
  const isPicker = !!picker;
  useEffect(() => {
    if (!isPicker || !allDocuments?.length) return;
    setSeenDocuments((seen) => new Map([...seen, ...allDocuments.map((document) => [document.id, document] as const)]));
  }, [isPicker, allDocuments]);
  // The seen list catches up a render late; the documents on screen are always known.
  const knownDocuments = useMemo(
    () => new Map([...seenDocuments, ...(allDocuments ?? []).map((document) => [document.id, document] as const)]),
    [seenDocuments, allDocuments]
  );

  const excludedVisit: DocumentVisitRef | undefined = useMemo(
    () =>
      picker?.excludeEncounterId
        ? {
            encounterId: picker.excludeEncounterId,
            appointmentId: visitsByEncounterId.get(picker.excludeEncounterId)?.appointmentId,
          }
        : undefined,
    [picker?.excludeEncounterId, visitsByEncounterId]
  );
  const visitOptions = useMemo(
    () => allVisitOptions.filter((visit) => visit.encounterId !== excludedVisit?.encounterId),
    [allVisitOptions, excludedVisit]
  );

  /** Offered folders, counting only the documents the picker can list. */
  const documentsFolders = useMemo(() => {
    if (!picker) return allDocumentsFolders;
    return allDocumentsFolders
      .filter((folder) => !!folder.internalName && picker.folderNames.includes(folder.internalName))
      .map((folder) => {
        const documentsRefs = (folder.documentsRefs ?? []).filter((ref) => {
          const document = knownDocuments.get(ref.reference?.reference?.replace('DocumentReference/', '') ?? '');
          return (
            !!document &&
            picker.isDocumentAllowed(folder.internalName!, document) &&
            !(excludedVisit && isDocumentOfVisit(document, excludedVisit))
          );
        });
        return { ...folder, documentsRefs, documentsCount: documentsRefs.length };
      });
  }, [picker, allDocumentsFolders, knownDocuments, excludedVisit]);

  const documents = useMemo(() => {
    if (!picker || !allDocuments) return allDocuments;
    const offeredIds = new Set(
      documentsFolders.flatMap((folder) =>
        (folder.documentsRefs ?? []).map((ref) => ref.reference?.reference?.replace('DocumentReference/', ''))
      )
    );
    return allDocuments.filter((document) => offeredIds.has(document.id));
  }, [picker, allDocuments, documentsFolders]);

  // Preselect once everything has loaded: the unfiltered list is still showing, so the latest visit's offered
  // documents are all in it.
  useEffect(() => {
    if (!picker?.preselectLatestVisit || hasPreselected) return;
    // Folders always include the system ones once loaded, so an empty list means they have not arrived yet.
    if (isLoadingFolders || !allDocumentsFolders.length || isLoadingVisits || !documents) return;
    setHasPreselected(true);
    const latestVisit = visitOptions[0];
    if (!latestVisit) return;
    setSelectedVisit(latestVisit);
    setSelectedDocumentIds(
      documents.filter((document) => isDocumentOfVisit(document, latestVisit)).map((document) => document.id)
    );
  }, [
    picker?.preselectLatestVisit,
    hasPreselected,
    isLoadingFolders,
    allDocumentsFolders.length,
    isLoadingVisits,
    documents,
    visitOptions,
  ]);

  const onPickerSelectionChange = picker?.onSelectionChange;
  useEffect(() => {
    onPickerSelectionChange?.(selectedDocumentIds.map(String), knownDocuments);
  }, [onPickerSelectionChange, selectedDocumentIds, knownDocuments]);

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

            {!readOnly && !picker && (
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

            {!picker && (
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
            )}
          </Box>

          <PatientDocumentsExplorerTable
            isLoadingDocs={isLoadingDocuments}
            documents={documents}
            documentTableActions={documentTableActions}
            patientId={patientId}
            selectedDocumentIds={selectedDocumentIds}
            onSelectedDocumentIdsChange={setSelectedDocumentIds}
            pickerMode={!!picker}
          />
        </Grid>
      </Grid>

      <ScannerModal open={isScanModalOpen} onClose={handleCloseScanModal} onScanComplete={handleScanComplete} />
      <SendFaxDialog controller={faxController} title="Fax Document" />
    </Stack>
  );
};
