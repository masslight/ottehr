import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { ApprovedPatientEducationItem } from 'utils';
import { ApprovedPatientEducationDialog } from './ApprovedPatientEducationDialog';
import { EditApprovedPatientEducationCodesDialog } from './EditApprovedPatientEducationCodesDialog';

export const APPROVED_PATIENT_EDUCATION_QUERY_KEY = ['approved-patient-education'];

export const PatientEducationAdminPage = (): ReactElement => {
  const theme = useTheme();
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovedPatientEducationItem | null>(null);

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: APPROVED_PATIENT_EDUCATION_QUERY_KEY,
    queryFn: async () => {
      if (!apiClient) throw new Error('API client not available');
      return apiClient.listApprovedPatientEducation();
    },
    enabled: !!apiClient,
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentReferenceId: string) => {
      if (!apiClient) throw new Error('API client not available');
      return apiClient.deleteApprovedPatientEducation({ documentReferenceId });
    },
    onSuccess: () => {
      enqueueSnackbar('Deleted approved patient education', { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: APPROVED_PATIENT_EDUCATION_QUERY_KEY });
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  const items: ApprovedPatientEducationItem[] = (data?.items ?? [])
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title) || a.language.localeCompare(b.language));

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Approved Patient Education PDFs</Typography>
        <RoundedButton variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add
        </RoundedButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Approved PDFs are automatically used during charting whenever a patient's diagnosis matches one of the ICD codes
        listed below.
      </Typography>

      {isLoading && <CircularProgress />}

      {isSuccess && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Language</TableCell>
                <TableCell>Diagnosis</TableCell>
                <TableCell>Alternative ICD-10 Codes</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No approved patient education PDFs yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => {
                const primary = item.icdCodes[0];
                const alternates = item.icdCodes.slice(1);
                return (
                  <TableRow key={item.documentReferenceId}>
                    <TableCell>
                      <Link
                        href={item.pdfPresignedUrl}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <PictureAsPdfIcon fontSize="small" color="error" />
                        {item.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.language === 'es' ? 'secondary' : 'default'}
                        label={item.language === 'es' ? 'Español' : 'English'}
                      />
                    </TableCell>
                    <TableCell>
                      {primary && (
                        <Chip
                          size="small"
                          color="primary"
                          label={`${primary.code}${primary.display ? ` — ${primary.display}` : ''}`}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {alternates.map((c) => (
                          <Chip key={c.code} size="small" label={`${c.code}${c.display ? ` — ${c.display}` : ''}`} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                      <IconButton size="small" onClick={() => setEditing(item)} title="Edit codes">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm(`Delete approved PDF for ${item.title}?`)) {
                            deleteMutation.mutate(item.documentReferenceId);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        title="Remove"
                        sx={{ color: theme.palette.error.main }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {addOpen && <ApprovedPatientEducationDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {editing && (
        <EditApprovedPatientEducationCodesDialog open={!!editing} onClose={() => setEditing(null)} item={editing} />
      )}
    </Box>
  );
};
