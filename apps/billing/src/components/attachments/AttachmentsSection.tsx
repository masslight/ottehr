import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon,
  Download as DownloadIcon,
  EditOutlined as EditOutlinedIcon,
  MoreVert as MoreVertIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
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
import { ReactElement, useEffect, useState } from 'react';
import { DropzoneProps } from 'react-dropzone';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { formatDateTime } from '../../utils/format';
import { ReadOnlySection, thSx } from '../ReadOnlySection';
import { DropzoneField } from './DropzoneField';

export interface AttachmentRow {
  id: string;
  fileName: string;
  dateAdded: string;
  // claim attachments carry the PWK report type they are sent under
  reportTypeCode?: string;
}

export interface AttachmentUpload {
  name: string;
  file: File;
  reportTypeCode?: string;
}

interface ReportTypeCode {
  code: string;
  label: string;
}

interface AttachmentsSectionProps {
  attachments: AttachmentRow[];
  // offered when adding and shown per row (claims); omit for attachments that have no report type
  reportTypeCodes?: readonly ReportTypeCode[];
  defaultReportTypeCode?: string;
  // drop-zone restrictions for the add dialog
  accept?: DropzoneProps['accept'];
  maxSize?: number;
  // shown under the heading
  description?: string;
  // download only
  readOnly?: boolean;
  // when set, adding is unavailable and this says why
  disabledReason?: string;
  onUpload?: (upload: AttachmentUpload) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onDownload: (id: string) => Promise<void>;
}

interface AddForm {
  name: string;
  reportTypeCode: string;
  file: File | null;
}

// The attachments card shared by the claim detail and manual remit screens: a table of files with
// download, rename and delete, and an add dialog with a drop zone. The screen supplies the storage
// calls; this component owns the dialogs and their error handling.
export function AttachmentsSection({
  attachments,
  reportTypeCodes,
  defaultReportTypeCode,
  accept,
  maxSize,
  description,
  readOnly,
  disabledReason,
  onUpload,
  onRename,
  onDelete,
  onDownload,
}: AttachmentsSectionProps): ReactElement {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [renaming, setRenaming] = useState<AttachmentRow | null>(null);
  const [deleting, setDeleting] = useState<AttachmentRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: AttachmentRow } | null>(null);

  const addFormMethods = useForm<AddForm>({ defaultValues: { name: '', reportTypeCode: '', file: null } });
  const {
    control: addControl,
    reset: addReset,
    handleSubmit: addHandleSubmit,
    watch: addWatch,
    getValues: addGetValues,
    setValue: addSetValue,
    formState: { isSubmitting: addSubmitting },
  } = addFormMethods;
  const renameFormMethods = useForm<{ name: string }>({ defaultValues: { name: '' } });
  const {
    control: renameControl,
    reset: renameReset,
    handleSubmit: renameHandleSubmit,
    formState: { isSubmitting: renameSubmitting },
  } = renameFormMethods;

  // a dropped file names the attachment unless the user already typed a name
  const droppedFile = addWatch('file');
  useEffect(() => {
    if (droppedFile && !addGetValues('name')) addSetValue('name', droppedFile.name, { shouldValidate: true });
  }, [droppedFile, addGetValues, addSetValue]);

  const canEdit = !readOnly && !disabledReason;
  const reportTypeLabel = (code: string | undefined): string => {
    const resolved = code ?? defaultReportTypeCode ?? '';
    const label = reportTypeCodes?.find((option) => option.code === resolved)?.label;
    return label ? `${resolved} — ${label}` : resolved;
  };

  const openAddDialog = (): void => {
    addReset({ name: '', reportTypeCode: defaultReportTypeCode ?? '', file: null });
    setSubmitError('');
    setShowAddDialog(true);
  };
  const closeAddDialog = (): void => {
    setShowAddDialog(false);
    setSubmitError('');
  };
  const closeRenameDialog = (): void => {
    setRenaming(null);
    setSubmitError('');
  };
  const closeDeleteDialog = (): void => {
    setDeleting(null);
    setSubmitError('');
  };

  const handleAdd = async (form: AddForm): Promise<void> => {
    if (!onUpload || !form.file) return;
    try {
      setSubmitError('');
      await onUpload({ name: form.name, file: form.file, reportTypeCode: form.reportTypeCode || undefined });
      closeAddDialog();
    } catch (err) {
      setSubmitError(getApiError({ error: err, defaultError: 'Failed to add attachment' }));
    }
  };

  const handleRename = async ({ name }: { name: string }): Promise<void> => {
    if (!onRename || !renaming) return;
    try {
      setSubmitError('');
      await onRename(renaming.id, name);
      closeRenameDialog();
    } catch (err) {
      setSubmitError(getApiError({ error: err, defaultError: 'Failed to rename attachment' }));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!onDelete || !deleting) return;
    setDeleteSubmitting(true);
    try {
      setSubmitError('');
      await onDelete(deleting.id);
      closeDeleteDialog();
    } catch (err) {
      setSubmitError(getApiError({ error: err, defaultError: 'Failed to delete attachment' }));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const addAction = readOnly ? undefined : (
    <Tooltip title={disabledReason ?? ''}>
      <span>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={openAddDialog}
          disabled={!!disabledReason}
        >
          Add
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <>
      <ReadOnlySection title="Attachments" action={addAction}>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: attachments.length ? 1.5 : 0 }}>
            {description}
          </Typography>
        )}
        {attachments.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>#</TableCell>
                  <TableCell sx={thSx}>File Name</TableCell>
                  {reportTypeCodes && <TableCell sx={thSx}>Report Type Code</TableCell>}
                  <TableCell sx={thSx}>Date Added</TableCell>
                  <TableCell sx={thSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attachments.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.fileName}</TableCell>
                    {reportTypeCodes && <TableCell>{reportTypeLabel(row.reportTypeCode)}</TableCell>}
                    <TableCell>{formatDateTime(row.dateAdded)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => void onDownload(row.id)} aria-label="Download">
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip title="More Actions">
                            <IconButton
                              aria-label="More actions"
                              onClick={(event) => setMenu({ anchor: event.currentTarget, row })}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          !description && (
            <Typography variant="body2" color="text.secondary">
              No attachments
            </Typography>
          )
        )}
      </ReadOnlySection>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          key="rename"
          onClick={() => {
            if (!menu) return;
            renameReset({ name: menu.row.fileName });
            setSubmitError('');
            setRenaming(menu.row);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Rename document</ListItemText>
        </MenuItem>
        <MenuItem
          key="delete"
          onClick={() => {
            if (!menu) return;
            setSubmitError('');
            setDeleting(menu.row);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete document</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={showAddDialog} onClose={closeAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="span" variant="h5">
            Add Attachment
          </Typography>
          <IconButton size="small" onClick={closeAddDialog} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FormProvider {...addFormMethods}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              {submitError && <Alert severity="error">{submitError}</Alert>}
              <Controller
                name="name"
                control={addControl}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    label="Name *"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
              {reportTypeCodes && (
                <Controller
                  name="reportTypeCode"
                  control={addControl}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <FormControl size="small" fullWidth>
                      <InputLabel id="report-type-code-select-label" error={!!fieldError}>
                        Report Type Code
                      </InputLabel>
                      <Select
                        label="Report Type Code"
                        labelId="report-type-code-select-label"
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldError}
                      >
                        {reportTypeCodes.map(({ code, label }) => (
                          <MenuItem key={code} value={code}>
                            {code} &mdash; {label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              )}
              <DropzoneField name="file" multiple={false} required accept={accept} maxSize={maxSize} />
            </Box>
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={addSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={addHandleSubmit(handleAdd)}
            disabled={addSubmitting}
          >
            {addSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!renaming} onClose={closeRenameDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="span" variant="h5">
            Rename Attachment
          </Typography>
          <IconButton size="small" onClick={closeRenameDialog} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Controller
              name="name"
              control={renameControl}
              rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              render={({ field, fieldState: { error: fieldError } }) => (
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  label="Name *"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={!!fieldError}
                  helperText={fieldError?.message}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRenameDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={renameSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={renameHandleSubmit(handleRename)}
            disabled={renameSubmitting}
          >
            {renameSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="span" variant="h5">
            Delete Attachment
          </Typography>
          <IconButton size="small" onClick={closeDeleteDialog} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {submitError}
            </Alert>
          )}
          Are you sure you want to delete "{deleting?.fileName}"? This cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={deleteSubmitting ? <CircularProgress size={14} /> : <DeleteForeverIcon fontSize="small" />}
            onClick={handleDelete}
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
