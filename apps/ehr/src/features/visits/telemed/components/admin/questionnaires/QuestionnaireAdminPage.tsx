import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import UploadIcon from '@mui/icons-material/Upload';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createPracticeManagedQuestionnaire,
  deletePracticeManagedQuestionnaire,
  listPracticeManagedQuestionnaires,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { FhirQuestionnaire, fromFhirResource, IntakeQuestionnaireOption } from './questionnaire.types';

const QUERY_KEY = ['practice-managed-questionnaires'];

function countItems(items: FhirQuestionnaire['item']): number {
  let count = 0;
  for (const item of items || []) {
    count++;
    if (item.item) count += countItems(item.item);
  }
  return count;
}

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  active: 'success',
  draft: 'warning',
  retired: 'error',
  unknown: 'default',
};

const FileUploadArea: FC<{ onFileLoaded: (content: string) => void; disabled?: boolean }> = ({
  onFileLoaded,
  disabled,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.json')) {
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) onFileLoaded(content);
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }}
      onClick={() => !disabled && fileInputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: dragOver ? 'primary.main' : '#E0E0E0',
        borderRadius: '8px',
        p: 3,
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        bgcolor: dragOver ? 'action.hover' : 'transparent',
        transition: 'all 0.2s',
        '&:hover': disabled ? {} : { borderColor: 'primary.light', bgcolor: 'action.hover' },
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
      <CloudUploadIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 0.5 }} />
      <Typography variant="body2" color="text.secondary">
        {fileName ? `Loaded: ${fileName}` : 'Drop a .json file here or click to browse'}
      </Typography>
    </Box>
  );
};

export const QuestionnaireAdminPage: FC = () => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda)
        return { questionnaires: [] as FhirQuestionnaire[], systemQuestionnaires: [] as IntakeQuestionnaireOption[] };
      const result = await listPracticeManagedQuestionnaires(oystehrZambda);
      return {
        questionnaires: (result.questionnaires || []).map((r: any) => fromFhirResource(r)),
        systemQuestionnaires: result.systemQuestionnaires || [],
      };
    },
    enabled: !!oystehrZambda,
  });
  const questionnaires = data?.questionnaires || [];
  const systemQuestionnaires = data?.systemQuestionnaires || [];

  const handleCreate = useCallback(() => {
    navigate('/admin/questionnaires/new');
  }, [navigate]);

  const handleEdit = useCallback(
    (q: FhirQuestionnaire) => {
      navigate(`/admin/questionnaires/${q.id}`);
    },
    [navigate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!oystehrZambda || !window.confirm('Are you sure you want to delete this questionnaire?')) return;
      try {
        await deletePracticeManagedQuestionnaire(oystehrZambda, id);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        enqueueSnackbar('Questionnaire deleted', { variant: 'success' });
      } catch (err) {
        console.error('Failed to delete questionnaire:', err);
        enqueueSnackbar('Failed to delete questionnaire', { variant: 'error' });
      }
    },
    [oystehrZambda, queryClient]
  );

  const handleImport = useCallback(async () => {
    if (!oystehrZambda) return;
    setImportError(null);
    try {
      const parsed = JSON.parse(importJson);
      if (parsed.resourceType !== 'Questionnaire') {
        setImportError('JSON must be a FHIR Questionnaire resource (resourceType: "Questionnaire")');
        return;
      }
      if (!parsed.title && !parsed.name) {
        setImportError('Questionnaire must have a title or name');
        return;
      }
      setIsImporting(true);
      await createPracticeManagedQuestionnaire(oystehrZambda, parsed);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      enqueueSnackbar(`Imported "${parsed.title || parsed.name}"`, { variant: 'success' });
      setImportDialogOpen(false);
      setImportJson('');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setImportError('Invalid JSON: ' + err.message);
      } else {
        console.error('Import failed:', err);
        setImportError('Failed to save questionnaire to server');
      }
    } finally {
      setIsImporting(false);
    }
  }, [oystehrZambda, importJson, queryClient]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Questionnaires</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportDialogOpen(true)}>
            Import JSON
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            Create Questionnaire
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : questionnaires.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No questionnaires yet. Click "Create Questionnaire" to build one.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Present With</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Items
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {questionnaires.map((q) => (
                <TableRow key={q.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleEdit(q)}>
                  <TableCell>{q.title || '(untitled)'}</TableCell>
                  <TableCell>
                    {(q.associatedQuestionnaires || []).map((url) => {
                      const match = systemQuestionnaires.find((sq) => sq.url === url);
                      return <Chip key={url} label={match?.title || url} size="small" sx={{ mr: 0.5 }} />;
                    })}
                    {(!q.associatedQuestionnaires || q.associatedQuestionnaires.length === 0) && (
                      <Typography variant="caption" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={q.status} size="small" color={STATUS_COLORS[q.status] || 'default'} />
                  </TableCell>
                  <TableCell align="center">{countItems(q.item)}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(q)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => q.id && handleDelete(q.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Import JSON Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => !isImporting && setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import FHIR Questionnaire</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a JSON file or paste a FHIR R4 Questionnaire resource. The questionnaire will be saved as-is,
            preserving all extensions, coded answer options, and scoring. You can import standardized instruments like
            GAD-7, PHQ-9, or any valid FHIR Questionnaire.
          </Typography>
          <FileUploadArea
            onFileLoaded={(content) => {
              setImportJson(content);
              setImportError(null);
            }}
            disabled={isImporting}
          />
          <TextField
            value={importJson}
            onChange={(e) => {
              setImportJson(e.target.value);
              setImportError(null);
            }}
            multiline
            minRows={10}
            maxRows={18}
            fullWidth
            placeholder='{"resourceType": "Questionnaire", ...}'
            error={!!importError}
            helperText={importError}
            sx={{ mt: 2, '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 12 } }}
            disabled={isImporting}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setImportDialogOpen(false);
              setImportJson('');
              setImportError(null);
            }}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!importJson.trim() || isImporting}
            startIcon={isImporting ? <CircularProgress size={16} /> : <UploadIcon />}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuestionnaireAdminPage;
