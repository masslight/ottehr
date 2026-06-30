import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import UploadIcon from '@mui/icons-material/Upload';
import {
  Box,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useManagedQuestionnaireList, useManagedQuestionnaireUpdate } from '../admin.queries';
import { ImportJsonDialog } from './components/ImportJsonDialog';

function countItems(items: QuestionnaireItem[]): number {
  let count = 0;
  for (const item of items || []) {
    count++;
    if (item.item) count += countItems(item.item);
  }
  return count;
}

// Deleted forms are soft-deleted so existing patient responses stay viewable
const isDeleted = (q: Questionnaire): boolean => q.status === 'retired';

export const QuestionnaireAdminPage: FC = () => {
  const navigate = useNavigate();
  const [showDeleted, setShowDeleted] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { mutateAsync: updateQuestionnaire, isPending: isUpdating } = useManagedQuestionnaireUpdate();

  const { data, isLoading, error: loadError } = useManagedQuestionnaireList();

  const managedQuestionnaires = (data?.managedQuestionnaires || [])
    .slice()
    .sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));

  const deletedCount = managedQuestionnaires.filter(isDeleted).length;

  const visibleQuestionnaires = showDeleted
    ? managedQuestionnaires
    : managedQuestionnaires.filter((q) => !isDeleted(q));

  const toggleStatus = useCallback(
    async (questionnaireId: string | undefined, newStatus: Questionnaire['status']) => {
      if (newStatus === 'retired') {
        if (!window.confirm('Are you sure you want to delete this questionnaire?')) return;
      }

      if (!questionnaireId) {
        enqueueSnackbar('Questionnaire is malformed, id cannot be parsed. Unable to update.');
        return;
      }

      await updateQuestionnaire({
        updateType: 'update-status',
        data: { questionnaireId, newStatus },
      });
      enqueueSnackbar('Questionnaire status updated', { variant: 'success' });
    },
    [updateQuestionnaire]
  );

  const PageHeader = (): JSX.Element => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ color: '#0F347C' }}>
          Questionnaires
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {deletedCount > 0 && (
            <FormControlLabel
              control={<Switch size="small" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />}
              label={`Show deleted (${deletedCount})`}
              sx={{ mr: 1, '& .MuiFormControlLabel-label': { fontSize: 14, color: 'text.secondary' } }}
            />
          )}
          <ButtonRounded
            variant="outlined"
            size="medium"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Import JSON
          </ButtonRounded>
          <ButtonRounded
            variant="contained"
            size="medium"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/questionnaires/new')}
          >
            Create Questionnaire
          </ButtonRounded>
        </Box>
      </Box>
    );
  };

  if (loadError) {
    return (
      <Paper sx={{ padding: 2, marginTop: 2 }}>
        {PageHeader()}
        <Typography variant="body1" color="error" sx={{ p: 4, textAlign: 'center' }}>
          There was an error loading questionnaires: {loadError.message}
        </Typography>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Paper sx={{ padding: 2, marginTop: 2 }}>
        {PageHeader()}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      {PageHeader()}

      {visibleQuestionnaires.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
          {managedQuestionnaires.length === 0
            ? 'No questionnaires yet. Click "Create Questionnaire" to build one.'
            : 'No active questionnaires. Turn on "Show deleted" to see deleted ones.'}
        </Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Items
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleQuestionnaires.map((q) => {
                const deleted = isDeleted(q);
                return (
                  <TableRow
                    key={q.id}
                    hover={!deleted}
                    sx={{ cursor: deleted ? 'default' : 'pointer', opacity: deleted ? 0.55 : 1 }}
                    onClick={() => !deleted && navigate(`/admin/questionnaires/${q.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {q.title || '(untitled)'}
                        {deleted && (
                          <Chip
                            label="Deleted"
                            size="small"
                            sx={{
                              borderRadius: '4px',
                              height: '17px',
                              '& .MuiChip-label': { padding: '2px 8px 0px 8px' },
                              fontSize: 12,
                              fontWeight: 500,
                              backgroundColor: 'rgba(211, 47, 47, 0.3)',
                              color: '#D32F2F',
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{countItems(q.item ?? [])}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      {deleted ? (
                        <Tooltip title="Restore">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={isUpdating}
                            onClick={() => toggleStatus(q.id, 'active')}
                          >
                            <RestoreFromTrashIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => navigate(`/admin/questionnaires/${q.id}`)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={isUpdating}
                              onClick={() => toggleStatus(q.id, 'retired')}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ImportJsonDialog open={importDialogOpen} setOpen={setImportDialogOpen} />
    </Paper>
  );
};

export default QuestionnaireAdminPage;
