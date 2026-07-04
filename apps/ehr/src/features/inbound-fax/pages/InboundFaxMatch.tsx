import { useAuth0 } from '@auth0/auth0-react';
import ClearIcon from '@mui/icons-material/Clear';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { List as FhirList, Task } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteInboundFax, fileInboundFax } from 'src/api/api';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { formatDate, GET_TASKS_KEY } from 'src/features/visits/in-person/hooks/useTasks';
import { SearchResultParsedPatient } from 'src/features/visits/shared/components/patients-search/types';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  parsePatientDocsFolders,
  PatientDocumentsFolder,
  QUERY_KEYS,
  useGetPatientDocsFolders,
} from 'src/hooks/useGetPatientDocs';
import PageContainer from 'src/layout/PageContainer';
import {
  createCustomPatientDocumentList,
  createPatientDocumentList,
  FAX_TASK,
  FOLDERS_CONFIG,
  getPresignedURL,
  isCustomFolderList,
  isSyntheticFolderId,
  parseSyntheticFolderId,
} from 'utils';
import { UnsolicitedPatientMatchSearchCard } from '../../external-labs/components/unsolicited-results/UnsolicitedPatientMatchSearchCard';

export const InboundFaxMatch: React.FC = () => {
  const { communicationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { oystehr, oystehrZambda } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();

  const [isLoading, setIsLoading] = useState(true);
  const [isFiling, setIsFiling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();

  const [taskId, setTaskId] = useState<string>();
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [presignedPdfUrl, setPresignedPdfUrl] = useState<string>();
  const [isPresigning, setIsPresigning] = useState(false);
  const [senderFaxNumber, setSenderFaxNumber] = useState<string>();
  const [pageCount, setPageCount] = useState<string>();
  const [receivedDate, setReceivedDate] = useState<string>();

  const [confirmedSelectedPatient, setConfirmedSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>();
  const [documentName, setDocumentName] = useState('');

  if (!communicationId) {
    throw new Error('communicationId is required');
  }

  // Get a presigned URL for the fax PDF. Extracted so the user can retry after a failure —
  // Save is disabled until the preview loads so staff never file a document they haven't seen.
  const loadPresignedUrl = useCallback(
    async (faxPdfUrl: string): Promise<void> => {
      setIsPresigning(true);
      try {
        const token = await getAccessTokenSilently();
        const presigned = await getPresignedURL(faxPdfUrl, token);
        setPresignedPdfUrl(presigned);
      } catch (e) {
        console.error('Failed to get presigned PDF URL:', e);
      } finally {
        setIsPresigning(false);
      }
    },
    [getAccessTokenSilently]
  );

  // Load Communication and Task data
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      if (!oystehr) return;

      try {
        // Find the task for this communication. Search without a status filter so an
        // already-actioned fax can be told apart from a bogus/unknown communication id.
        const tasks = (
          await oystehr.fhir.search<Task>({
            resourceType: 'Task',
            params: [{ name: 'based-on', value: `Communication/${communicationId}` }],
          })
        ).unbundle();

        const task = tasks.find((t) => t.status === 'ready');
        if (!task?.id) {
          // Filing completes the task; deleting cancels it. Either way a task still exists.
          setError(
            tasks.length > 0 ? 'This fax has already been filed or deleted.' : 'No matching task found for this fax'
          );
          setIsLoading(false);
          return;
        }
        setTaskId(task.id);

        // Extract task input values
        const getInputValue = (code: string): string | undefined => {
          const input = task.input?.find((i) => i.type?.coding?.some((c) => c.code === code));
          return input?.valueString;
        };

        const faxPdfUrl = getInputValue(FAX_TASK.input.pdfUrl);
        const faxSender = getInputValue(FAX_TASK.input.senderFaxNumber);
        const faxPageCount = getInputValue(FAX_TASK.input.pageCount);
        const faxReceivedDate = getInputValue(FAX_TASK.input.receivedDate);

        setPdfUrl(faxPdfUrl);
        setSenderFaxNumber(faxSender);
        setPageCount(faxPageCount);
        setReceivedDate(faxReceivedDate);

        // Get presigned URL for the PDF
        if (faxPdfUrl) {
          await loadPresignedUrl(faxPdfUrl);
        }

        setDocumentName(`Fax from ${faxSender || 'unknown'}`);
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to load fax data:', e);
        setError('Failed to load fax data');
        setIsLoading(false);
      }
    };

    void loadData();
  }, [oystehr, communicationId, loadPresignedUrl]);

  // Load patient folders when patient is confirmed. Reuses the shared docs-folders hook so
  // custom folders and synthesized system folders (patients with no per-patient List yet)
  // show up here exactly like they do on the patient docs page.
  const confirmedPatientId = confirmedSelectedPatient?.id ?? '';
  const { data: foldersData, isLoading: foldersLoading } = useGetPatientDocsFolders({
    patientId: confirmedPatientId,
  });
  const folders: PatientDocumentsFolder[] = useMemo(
    () => (confirmedPatientId && foldersData ? parsePatientDocsFolders(foldersData, confirmedPatientId) : []),
    [foldersData, confirmedPatientId]
  );

  // Auto-confirm on radio select — no intermediate "Select" button step needed
  const handlePatientSelect = useCallback((patient: SearchResultParsedPatient | undefined): void => {
    setConfirmedSelectedPatient(patient);
    setSelectedFolder(undefined);
  }, []);

  // The file-inbound-fax zambda resolves the folder by List id, so a synthetic folder
  // (system/custom folder the patient has no per-patient List for yet — see
  // useGetPatientDocsFolders) must be materialized first. Mirrors the lazy-create path in the
  // create-upload-document-url zambda, reusing the shared List builders from utils.
  const resolveRealFolderId = useCallback(
    async (folder: PatientDocumentsFolder, patientId: string): Promise<string> => {
      if (!isSyntheticFolderId(folder.id)) return folder.id;
      if (!oystehr) throw new Error('oystehr client not defined');

      const internalName = folder.internalName ?? parseSyntheticFolderId(folder.id);
      if (!internalName) throw new Error(`Cannot resolve internal name for folder ${folder.id}`);

      // FHIR string search on `title` is prefix-match, so confirm an exact match (and matching
      // folder kind) before reusing an existing List.
      const existing = (
        await oystehr.fhir.search<FhirList>({
          resourceType: 'List',
          params: [
            { name: 'subject', value: `Patient/${patientId}` },
            { name: 'title', value: internalName },
          ],
        })
      )
        .unbundle()
        .find((list) => list.title === internalName && isCustomFolderList(list) === folder.isCustom);
      if (existing?.id) return existing.id;

      const patientReference = `Patient/${patientId}`;
      let newList: FhirList;
      if (folder.isCustom) {
        newList = createCustomPatientDocumentList(patientReference, internalName);
      } else {
        const config = FOLDERS_CONFIG.find((c) => c.title === internalName);
        if (!config) throw new Error(`Unknown system folder "${internalName}"`);
        newList = createPatientDocumentList(patientReference, config);
      }
      const created = await oystehr.fhir.create<FhirList>(newList);
      if (!created.id) throw new Error('Failed to create folder List');
      return created.id;
    },
    [oystehr]
  );

  const handleFile = async (): Promise<void> => {
    if (!oystehrZambda || !taskId || !confirmedSelectedPatient || !selectedFolder || !pdfUrl || !documentName) return;

    setIsFiling(true);
    try {
      const folderId = await resolveRealFolderId(selectedFolder, confirmedSelectedPatient.id);
      await fileInboundFax(oystehrZambda, {
        taskId,
        communicationId,
        patientId: confirmedSelectedPatient.id,
        folderId,
        documentName,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId: confirmedSelectedPatient.id }],
        }),
      ]);
      enqueueSnackbar('Fax filed successfully', { variant: 'success' });
      navigate('/tasks');
    } catch (e) {
      console.error('Failed to file fax:', e);
      enqueueSnackbar('Failed to file fax. Please try again.', { variant: 'error' });
    } finally {
      setIsFiling(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !taskId) return;

    setIsDeleting(true);
    try {
      // The zambda derives the PDF url to clean up from the Task itself, so a fax with a
      // missing/broken PDF can still be deleted.
      await deleteInboundFax(oystehrZambda, {
        taskId,
        communicationId,
      });
      await queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false });
      enqueueSnackbar('Fax deleted', { variant: 'success' });
      navigate('/tasks');
    } catch (e) {
      console.error('Failed to delete fax:', e);
      enqueueSnackbar('Failed to delete fax. Please try again.', { variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const previewUnavailable = !!pdfUrl && !presignedPdfUrl;
  const readyToSubmit =
    !!confirmedSelectedPatient &&
    !!selectedFolder &&
    !!documentName.trim() &&
    !!pdfUrl &&
    !!taskId &&
    // Staff must be able to see the document before filing it against a patient chart.
    !!presignedPdfUrl;

  if (error) {
    return (
      <PageContainer>
        <Paper sx={{ p: 3, maxWidth: 680, mx: 'auto' }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.dark', mb: 2 }}>
            Match Inbound Fax
          </Typography>
          <Typography color="error">{error}</Typography>
        </Paper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ px: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
        <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.dark', mb: 2 }}>
          Match Inbound Fax
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Left side: PDF viewer */}
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2, height: '80vh' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.dark' }}>
                    Fax from {senderFaxNumber || 'unknown'} &middot; {pageCount || '?'} pages &middot; Received{' '}
                    {receivedDate || 'unknown'}
                  </Typography>
                  {presignedPdfUrl && (
                    <Link
                      href={presignedPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
                    >
                      Open PDF in new tab
                      <OpenInNewIcon fontSize="inherit" />
                    </Link>
                  )}
                </Stack>
                {presignedPdfUrl ? (
                  <Box
                    component="iframe"
                    src={presignedPdfUrl}
                    title="Inbound fax PDF preview"
                    sx={{ width: '100%', height: 'calc(100% - 30px)', border: 'none' }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 'calc(100% - 30px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.100',
                    }}
                  >
                    {isPresigning ? (
                      <CircularProgress />
                    ) : (
                      <>
                        <Typography color="text.secondary">
                          {pdfUrl ? 'PDF preview unavailable' : 'No PDF found for this fax'}
                        </Typography>
                        {pdfUrl && (
                          <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => void loadPresignedUrl(pdfUrl)}
                            sx={{ borderRadius: '50px', textTransform: 'none' }}
                          >
                            Retry preview
                          </Button>
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Right side: matching form */}
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 3 }}>
                <Stack spacing={3}>
                  {/* Patient search */}
                  <Stack spacing={1}>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                      Match to patient:
                    </Typography>
                    {confirmedSelectedPatient ? (
                      <TextField
                        label="Selected"
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <IconButton
                              onClick={() => {
                                setConfirmedSelectedPatient(undefined);
                                setSelectedFolder(undefined);
                              }}
                              edge="end"
                              size="small"
                            >
                              <ClearIcon />
                            </IconButton>
                          ),
                        }}
                        value={`${confirmedSelectedPatient.name} (${confirmedSelectedPatient.birthDate})`}
                      />
                    ) : (
                      <UnsolicitedPatientMatchSearchCard
                        selectedPatient={confirmedSelectedPatient}
                        setSelectedPatient={handlePatientSelect}
                        handleConfirmPatientMatch={handlePatientSelect}
                      />
                    )}
                  </Stack>

                  {/* Folder selection */}
                  {confirmedSelectedPatient && (
                    <Stack spacing={1}>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                        Select folder:
                      </Typography>
                      {foldersLoading ? (
                        <CircularProgress size={24} />
                      ) : folders.length === 0 ? (
                        <Typography color="text.secondary">No folders found for this patient</Typography>
                      ) : (
                        <List dense disablePadding>
                          {[...folders]
                            .sort((a, b) => a.folderName.localeCompare(b.folderName))
                            .map((folder) => (
                              <ListItemButton
                                key={folder.id}
                                selected={selectedFolder?.id === folder.id}
                                onClick={() => setSelectedFolder(selectedFolder?.id === folder.id ? undefined : folder)}
                                sx={{ borderRadius: 1 }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <FolderOutlinedIcon />
                                </ListItemIcon>
                                <ListItemText
                                  primary={`${folder.folderName} (${folder.documentsCount})`}
                                  primaryTypographyProps={{
                                    fontWeight: selectedFolder?.id === folder.id ? 600 : 400,
                                  }}
                                />
                              </ListItemButton>
                            ))}
                        </List>
                      )}
                    </Stack>
                  )}

                  {/* Document name */}
                  {confirmedSelectedPatient && selectedFolder && (
                    <Stack spacing={1}>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                        Document name:
                      </Typography>
                      <TextField
                        fullWidth
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                        placeholder="Enter document name"
                      />
                    </Stack>
                  )}

                  {/* Actions */}
                  {previewUnavailable && !isPresigning && (
                    <Typography variant="body2" color="error" textAlign="right">
                      The fax preview must load before it can be filed. Use “Retry preview”.
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <ConfirmationDialog
                      title="Delete inbound fax?"
                      description={`This will permanently delete the ${pageCount || '?'}-page fax received from ${
                        senderFaxNumber || 'unknown'
                      } on ${receivedDate ? formatDate(receivedDate) : 'an unknown date'}. This cannot be undone.`}
                      response={handleDelete}
                      actionButtons={{
                        proceed: { text: 'Delete', color: 'error', loading: isDeleting },
                        back: { text: 'Cancel' },
                      }}
                    >
                      {(showDialog) => (
                        <LoadingButton
                          loading={isDeleting}
                          variant="outlined"
                          color="error"
                          onClick={showDialog}
                          sx={{ borderRadius: '50px', textTransform: 'none', px: 4 }}
                        >
                          Delete
                        </LoadingButton>
                      )}
                    </ConfirmationDialog>
                    <LoadingButton
                      loading={isFiling}
                      variant="contained"
                      color="primary"
                      onClick={handleFile}
                      disabled={!readyToSubmit}
                      sx={{ borderRadius: '50px', textTransform: 'none', px: 4 }}
                    >
                      Save
                    </LoadingButton>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>
    </PageContainer>
  );
};
