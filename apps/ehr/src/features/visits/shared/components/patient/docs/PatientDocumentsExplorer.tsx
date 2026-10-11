import ScannerIcon from '@mui/icons-material/Scanner';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, debounce, Grid, IconButton, Stack, TextField, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { ChangeEvent, FC, useCallback, useEffect, useMemo, useState } from 'react';
import DateSearch, { CustomFormEventHandler } from 'src/components/DateSearch';
import { RoundedButton } from 'src/components/RoundedButton';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import {
  DocumentVisitRef,
  hasVisitRef,
  PatientDocumentsFilters,
  PatientDocumentsFolder,
  useGetPatientDocs,
} from 'src/hooks/useGetPatientDocs';
import { PatientVisitOption, usePatientVisitOptions } from 'src/hooks/usePatientVisitOptions';
import { PatientDocumentFoldersColumn, PatientDocumentFoldersColumnSkeleton } from './PatientDocumentFoldersColumn';
import {
  DocumentTableActions,
  DocumentTableActionType,
  PatientDocumentsExplorerTable,
} from './PatientDocumentsExplorerTable';
import { UploadDocumentDialog, UploadDocumentMode } from './UploadDocumentDialog';
import { VisitFilterAutocomplete } from './VisitFilterAutocomplete';

export type PatientDocumentsExplorerProps = {
  patientId: string;
  /**
   * Scopes the explorer to a single visit: documents and folder counters are filtered to it, uploads
   * and scans are filed against it, and the visit filter is hidden (the visit is already fixed).
   *
   * Both ids are needed: EHR uploads link a document by encounter, while several intake documents
   * link by appointment, so a visit's documents are only complete when both are matched.
   * Omit for the patient-level Docs view.
   */
  visit?: DocumentVisitRef;
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
  visit,
  initialFolderName,
  readOnly = false,
}) => {
  const theme = useTheme();
  const isVisitScoped = hasVisitRef(visit);

  const {
    documents,
    isLoadingDocuments,
    documentsFolders,
    isLoadingFolders,
    searchDocuments,
    downloadDocument,
    renameDocument,
    documentActions,
  } = useGetPatientDocs(patientId, undefined, { uploadEncounterId: visit?.encounterId });

  const { visitOptions, isLoading: isLoadingVisits } = usePatientVisitOptions(isVisitScoped ? undefined : patientId);

  const [searchDocNameFieldValue, setSearchDocNameFieldValue] = useState<string>('');
  const [docNameTextDebounced, setDocNameTextDebounced] = useState<string>('');
  const [searchDocAddedDate, setSearchDocAddedDate] = useState<DateTime | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisitOption | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>(undefined);
  const [uploadMode, setUploadMode] = useState<UploadDocumentMode | null>(null);
  const [pendingSelectInternalName, setPendingSelectInternalName] = useState<string | null>(null);
  const [documentIdToFax, setDocumentIdToFax] = useState<string | null>(null);

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

  // When the explorer is visit-scoped the visit comes from the host page, not the filter row.
  const activeVisit: DocumentVisitRef | undefined = useMemo(
    () =>
      visit ??
      (selectedVisit
        ? { encounterId: selectedVisit.encounterId, appointmentId: selectedVisit.appointmentId }
        : undefined),
    [visit, selectedVisit]
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

  // After an upload, show the folder it went into; selecting by internalName (every listed folder has one)
  // also picks up the real List that the first upload into a synthetic catalog-only folder creates.
  const handleUploaded = useCallback((folder: PatientDocumentsFolder) => {
    setPendingSelectInternalName(folder.internalName ?? null);
  }, []);

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
          </Box>

          <PatientDocumentsExplorerTable
            isLoadingDocs={isLoadingDocuments}
            documents={documents}
            documentTableActions={documentTableActions}
            patientId={patientId}
          />
        </Grid>
      </Grid>

      {uploadMode && (
        <UploadDocumentDialog
          open
          mode={uploadMode}
          onClose={() => setUploadMode(null)}
          patientId={patientId}
          encounterId={visit?.encounterId}
          defaultFolderId={selectedFolder?.id}
          onUploaded={handleUploaded}
        />
      )}
      <SendFaxDialog controller={faxController} title="Fax Document" />
    </Stack>
  );
};
