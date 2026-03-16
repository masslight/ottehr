import { useAuth0 } from '@auth0/auth0-react';
import ClearIcon from '@mui/icons-material/Clear';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  CircularProgress,
  Grid,
  IconButton,
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
import { Task } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteInboundFax, fileInboundFax } from 'src/api/api';
import { GET_TASKS_KEY } from 'src/features/visits/in-person/hooks/useTasks';
import { SearchResultParsedPatient } from 'src/features/visits/shared/components/patients-search/types';
import { useApiClients } from 'src/hooks/useAppClients';
import { PatientDocumentsFolder } from 'src/hooks/useGetPatientDocs';
import PageContainer from 'src/layout/PageContainer';
import { FAX_TASK, getPresignedURL } from 'utils';
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
  const [senderFaxNumber, setSenderFaxNumber] = useState<string>();
  const [pageCount, setPageCount] = useState<string>();
  const [receivedDate, setReceivedDate] = useState<string>();

  const [confirmedSelectedPatient, setConfirmedSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [folders, setFolders] = useState<PatientDocumentsFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<PatientDocumentsFolder | undefined>();
  const [documentName, setDocumentName] = useState('');

  if (!communicationId) {
    throw new Error('communicationId is required');
  }

  // Load Communication and Task data
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      if (!oystehr) return;

      try {
        // Find the task for this communication
        const tasks = (
          await oystehr.fhir.search<Task>({
            resourceType: 'Task',
            params: [
              { name: 'based-on', value: `Communication/${communicationId}` },
              { name: 'status', value: 'ready' },
            ],
          })
        ).unbundle();

        const task = tasks[0];
        if (!task?.id) {
          setError('No matching task found for this fax');
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
          try {
            const token = await getAccessTokenSilently();
            const presigned = await getPresignedURL(faxPdfUrl, token);
            setPresignedPdfUrl(presigned);
          } catch (e) {
            console.warn('Failed to get presigned PDF URL:', e);
          }
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
  }, [oystehr, communicationId, getAccessTokenSilently]);

  // Load patient folders when patient is confirmed
  useEffect(() => {
    const loadFolders = async (): Promise<void> => {
      if (!oystehr || !confirmedSelectedPatient?.id) return;

      setFoldersLoading(true);
      setSelectedFolder(undefined);
      try {
        const resources = (
          await oystehr.fhir.search({
            resourceType: 'List',
            params: [
              { name: 'subject', value: `Patient/${confirmedSelectedPatient.id}` },
              { name: 'code', value: 'patient-docs-folder' },
            ],
          })
        ).unbundle();

        const listResources = resources.filter(
          (r): r is import('fhir/r4b').List => r.resourceType === 'List' && (r as any).status === 'current'
        );

        const patientFolders: PatientDocumentsFolder[] = listResources
          .filter((list) => list.code?.coding?.some((c) => c.code === 'patient-docs-folder'))
          .map((list) => ({
            id: list.id!,
            folderName: list.code?.coding?.find((c) => c.code === 'patient-docs-folder')?.display ?? 'Unknown folder',
            documentsCount: list.entry?.length ?? 0,
          }));

        setFolders(patientFolders);
      } catch (e) {
        console.error('Failed to load folders:', e);
        enqueueSnackbar('Failed to load patient folders', { variant: 'error' });
      } finally {
        setFoldersLoading(false);
      }
    };

    void loadFolders();
  }, [oystehr, confirmedSelectedPatient?.id]);

  // Auto-confirm on radio select — no intermediate "Select" button step needed
  const handlePatientSelect = useCallback((patient: SearchResultParsedPatient | undefined): void => {
    setConfirmedSelectedPatient(patient);
  }, []);

  const handleFile = async (): Promise<void> => {
    if (!oystehrZambda || !taskId || !confirmedSelectedPatient || !selectedFolder || !pdfUrl || !documentName) return;

    setIsFiling(true);
    try {
      await fileInboundFax(oystehrZambda, {
        taskId,
        communicationId,
        patientId: confirmedSelectedPatient.id,
        folderId: selectedFolder.id,
        documentName,
        pdfUrl,
      });
      await queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false });
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
    if (!oystehrZambda || !taskId || !pdfUrl) return;

    setIsDeleting(true);
    try {
      await deleteInboundFax(oystehrZambda, {
        taskId,
        communicationId,
        pdfUrl,
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

  const readyToSubmit = !!confirmedSelectedPatient && !!selectedFolder && !!documentName.trim() && !!pdfUrl && !!taskId;

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
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.dark' }}>
                  Fax from {senderFaxNumber || 'unknown'} &middot; {pageCount || '?'} pages &middot; Received{' '}
                  {receivedDate || 'unknown'}
                </Typography>
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
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.100',
                    }}
                  >
                    <Typography color="text.secondary">PDF preview unavailable</Typography>
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
                                setFolders([]);
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
                          {folders
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
                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <LoadingButton
                      loading={isDeleting}
                      variant="outlined"
                      color="error"
                      onClick={handleDelete}
                      sx={{ borderRadius: '50px', textTransform: 'none', px: 4 }}
                    >
                      Delete
                    </LoadingButton>
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
