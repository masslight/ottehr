import AddIcon from '@mui/icons-material/Add';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Box,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { FormTemplateDialog } from './FormTemplateDialog';
import { useFormTemplates } from './useFormTemplates';

export const FormTemplatesAdminPage = (): ReactElement => {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  // Admin sees drafts too; the patient chart omits this and gets published templates only.
  const { data, isLoading, isSuccess } = useFormTemplates({ includeUnpublished: true });

  const items: FormTemplateItem[] = (data?.items ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Box>
      <AdminHeaderActionSlot>
        <RoundedButton variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add
        </RoundedButton>
      </AdminHeaderActionSlot>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fillable PDF forms that providers can open from the Plan section of a patient chart. Only published templates
        appear there.
      </Typography>

      {isLoading && <CircularProgress />}

      {isSuccess && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Mapping</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                  Published
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No form templates yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow
                  key={item.documentReferenceId}
                  hover
                  onClick={() => navigate(`/admin/form-templates/${item.documentReferenceId}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    {item.pdfPresignedUrl ? (
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <PictureAsPdfIcon fontSize="small" color="error" />
                        <Typography variant="body2">{item.title}</Typography>
                      </Stack>
                    ) : (
                      <Tooltip title="The stored PDF for this template could not be found. Remove it and upload the form again.">
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <PictureAsPdfIcon fontSize="small" color="disabled" />
                          <Typography variant="body2" color="text.disabled">
                            {item.title}
                          </Typography>
                          <Chip size="small" color="warning" variant="outlined" label="File missing" />
                        </Stack>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.fillable ? (
                      <Chip size="small" variant="outlined" label="Fillable" />
                    ) : (
                      <Tooltip title="This PDF has no fillable fields, so it can be shared but not prefilled">
                        <Chip size="small" variant="outlined" icon={<LinkOffIcon />} label="Not fillable" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {item.published ? (
                      <Chip size="small" color="success" variant="outlined" label="Published" />
                    ) : (
                      <Chip size="small" variant="outlined" label="Draft" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {addOpen && <FormTemplateDialog open={addOpen} onClose={() => setAddOpen(false)} />}
    </Box>
  );
};
