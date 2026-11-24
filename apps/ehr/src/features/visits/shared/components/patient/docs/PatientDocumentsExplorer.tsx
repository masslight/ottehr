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
import { useSendDocuments } from 'src/features/send-documents/hooks/useSendDocuments';
import { SendDocumentsDialog } from 'src/features/send-documents/ui/SendDocumentsDialog';
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

export type PatientDocumentsPickerOptions = {
  /** Internal names of the folders offered; documents filed only elsewhere are not listed. */
  folderNames: readonly string[];
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
  /** Preselect this folder once folders have loaded, matched on its List id. Wins over `initialFolderName`. */
  initialFolderId?: string;
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
  initialFolderId,
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
  const [uploadMode, setUploadMode] = useState<UploadDocumentMode | null>(null);
  const [pendingSelectInternalName, setPendingSelectInternalName] = useState<string | null>(null);
  const [documentIdToSend, setDocumentIdToSend] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<GridRowSelectionModel>(
    picker?.initialSelectedIds ?? []
  );
  const { downloadDocumentsZip, isDownloading: isDownloadingDocuments } = useDownloadDocumentsZip();

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

  const packetSource = useMemo(
    () =>
      documentIdToSend ? ({ type: 'document', patientId, documentReferenceId: documentIdToSend } as const) : undefined,
    [documentIdToSend, patientId]
  );
  const sendDocumentsController = useSendDocuments(packetSource);
  const { open: openSendDialog, isOpen: isSendDialogOpen } = sendDocumentsController;

  useEffect(() => {
    if (!isSendDialogOpen) setDocumentIdToSend(null);
  }, [isSendDialogOpen]);

  // A dialog left open across navigation must not file into another patient or visit.
  const uploadTarget = useRef({ patientId, uploadEncounterId });
  const uploadTargetChanged =
    uploadTarget.current.patientId !== patientId || uploadTarget.current.uploadEncounterId !== uploadEncounterId;
  useEffect(() => {
    const previous = uploadTarget.current;
    uploadTarget.current = { patientId, uploadEncounterId };
    if (previous.patientId !== patientId || previous.uploadEncounterId !== uploadEncounterId) setUploadMode(null);
  }, [patientId, uploadEncounterId]);

  const handleDocumentSend = useCallback(
    (documentId: string): void => {
      setDocumentIdToSend(documentId);
      openSendDialog();
    },
    [openSendDialog]
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
      // Downloading and sending leave the record unchanged, so a signed (read-only) visit still offers them.
      isActionAllowed: (_documentId: string, actionType: DocumentTableActionType): boolean =>
        actionType === DocumentTableActionType.ActionDownload ||
        actionType === DocumentTableActionType.ActionSend ||
        !readOnly,
      onDocumentDownload: downloadDocument,
      onDocumentSend: handleDocumentSend,
      onDocumentRename: renameDocument,
      onDocumentDelete: documentActions.deleteDocumentAction,
    };
  }, [documentActions.deleteDocumentAction, downloadDocument, handleDocumentSend, renameDocument, readOnly]);

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
      <SendDocumentsDialog controller={sendDocumentsController} title="Send Document" />
    </Stack>
  );
};
