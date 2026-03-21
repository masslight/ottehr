import CodeIcon from '@mui/icons-material/Code';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormLabel,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Tab,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Editor } from '@tiptap/core';
import { Markdown as TiptapMarkdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CHARGE_MASTERS_URL, FEE_SCHEDULES_URL } from 'src/App';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import PageContainer from 'src/layout/PageContainer';
import {
  useDesignateChargeMasterEntryMutation,
  useListChargeMastersQuery,
  useUpdateChargeMasterMutation,
} from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  useListFeeSchedulesQuery,
  useUpdateFeeScheduleMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL, ChargeMasterDesignation } from 'utils';
import PayerAssociations from './fee-schedule/PayerAssociations';
import ProcedureCodes from './fee-schedule/ProcedureCodes';
import { ChargeItemMode } from './FeeSchedule';

export interface EditFeeScheduleProps {
  mode?: ChargeItemMode;
}

export default function EditFeeSchedule({ mode = 'fee-schedule' }: EditFeeScheduleProps): ReactElement {
  const isChargeMaster = mode === 'charge-master';
  const entityLabel = isChargeMaster ? 'Charge Master' : 'Fee Schedule';
  const entityLabelLower = entityLabel.toLowerCase();
  const baseUrl = isChargeMaster ? CHARGE_MASTERS_URL : FEE_SCHEDULES_URL;
  const queryKey = isChargeMaster ? 'charge-masters' : 'fee-schedules';
  const tabSlug = isChargeMaster ? 'charge-masters' : 'fee-schedule';

  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id: feeScheduleId } = useParams();

  const { data: fsData, isFetching: fsFetching } = useListFeeSchedulesQuery();
  const { data: cmData, isFetching: cmFetching } = useListChargeMastersQuery();
  const feeSchedules = isChargeMaster ? cmData : fsData;
  const isFetching = isChargeMaster ? cmFetching : fsFetching;
  const feeSchedule = feeSchedules?.find((fs) => fs.id === feeScheduleId);

  const [formData, setFormData] = React.useState({ name: '', effectiveDate: '', description: '' });
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('settings');
  const [pendingDesignation, setPendingDesignation] = React.useState<ChargeMasterDesignation | null>(null);
  const didInit = useRef(false);

  const isActive = feeSchedule?.status === 'active';

  const currentDesignation = feeSchedule?.extension?.find((ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL)
    ?.valueCode as ChargeMasterDesignation | undefined;

  const editor = useEditor({
    extensions: [StarterKit, TiptapMarkdown],
    content: '',
    onUpdate: ({ editor: ed }) => {
      setFormData((prev) => ({ ...prev, description: ed.getMarkdown() }));
    },
  });

  useEffect(() => {
    if (feeSchedule && !didInit.current) {
      setFormData({
        name: feeSchedule.title || '',
        effectiveDate: feeSchedule.date || '',
        description: feeSchedule.description || '',
      });
      if (editor) {
        editor.commands.setContent(feeSchedule.description || '', { contentType: 'markdown', emitUpdate: false });
        didInit.current = true;
      }
    }
  }, [feeSchedule, editor]);

  const cmUpdate = useUpdateChargeMasterMutation();
  const fsUpdate = useUpdateFeeScheduleMutation();
  const { mutateAsync: mutateUpdate, isPending: updatePending } = isChargeMaster ? cmUpdate : fsUpdate;

  const onSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');

    if (!feeScheduleId) return;

    try {
      await mutateUpdate({ id: feeScheduleId, ...formData } as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`${entityLabel} updated successfully`, { variant: 'success' });
    } catch {
      const errorMsg = `Error trying to save ${entityLabelLower}. Please try again.`;
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const ToolbarButtons = ({ ed }: { ed: Editor }): ReactElement => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.25 }}>
      <ToggleButtonGroup size="small" sx={{ '& .MuiToggleButton-root': { border: 'none', borderRadius: 1, px: 0.75 } }}>
        <ToggleButton value="bold" selected={ed.isActive('bold')} onClick={() => ed.chain().focus().toggleBold().run()}>
          <Tooltip title="Bold">
            <FormatBoldIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="italic"
          selected={ed.isActive('italic')}
          onClick={() => ed.chain().focus().toggleItalic().run()}
        >
          <Tooltip title="Italic">
            <FormatItalicIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="strike"
          selected={ed.isActive('strike')}
          onClick={() => ed.chain().focus().toggleStrike().run()}
        >
          <Tooltip title="Strikethrough">
            <FormatStrikethroughIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="code" selected={ed.isActive('code')} onClick={() => ed.chain().focus().toggleCode().run()}>
          <Tooltip title="Inline code">
            <CodeIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToggleButtonGroup size="small" sx={{ '& .MuiToggleButton-root': { border: 'none', borderRadius: 1, px: 0.75 } }}>
        <ToggleButton
          value="h1"
          selected={ed.isActive('heading', { level: 1 })}
          onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}
          sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}
        >
          H1
        </ToggleButton>
        <ToggleButton
          value="h2"
          selected={ed.isActive('heading', { level: 2 })}
          onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
          sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
        >
          H2
        </ToggleButton>
        <ToggleButton
          value="h3"
          selected={ed.isActive('heading', { level: 3 })}
          onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}
          sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          H3
        </ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <ToggleButtonGroup size="small" sx={{ '& .MuiToggleButton-root': { border: 'none', borderRadius: 1, px: 0.75 } }}>
        <ToggleButton
          value="bulletList"
          selected={ed.isActive('bulletList')}
          onClick={() => ed.chain().focus().toggleBulletList().run()}
        >
          <Tooltip title="Bullet list">
            <FormatListBulletedIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="orderedList"
          selected={ed.isActive('orderedList')}
          onClick={() => ed.chain().focus().toggleOrderedList().run()}
        >
          <Tooltip title="Numbered list">
            <FormatListNumberedIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="blockquote"
          selected={ed.isActive('blockquote')}
          onClick={() => ed.chain().focus().toggleBlockquote().run()}
        >
          <Tooltip title="Blockquote">
            <FormatQuoteIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tooltip title="Code block">
        <IconButton
          size="small"
          onClick={() => ed.chain().focus().toggleCodeBlock().run()}
          color={ed.isActive('codeBlock') ? 'primary' : 'default'}
        >
          <CodeIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Horizontal rule">
        <IconButton size="small" onClick={() => ed.chain().focus().setHorizontalRule().run()}>
          <HorizontalRuleIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const cmDesignate = useDesignateChargeMasterEntryMutation();
  const { mutateAsync: mutateDesignate, isPending: designatePending } = cmDesignate;

  const handleDesignate = async (designation: ChargeMasterDesignation): Promise<void> => {
    if (!feeScheduleId) return;

    try {
      await mutateDesignate({ chargeMasterId: feeScheduleId, designation });
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      const label = designation === 'insurance-pay' ? 'Insurance Charge Master' : 'Self-Pay Charge Master';
      enqueueSnackbar(`Designated as ${label}`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Error trying to designate charge master. Please try again.', { variant: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'retired'): Promise<void> => {
    if (!feeScheduleId || !feeSchedule) return;

    try {
      await mutateUpdate({
        id: feeScheduleId,
        name: feeSchedule.title || '',
        effectiveDate: feeSchedule.date || '',
        description: feeSchedule.description || '',
        status: newStatus,
      } as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`${entityLabel} ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(`Error trying to change ${entityLabelLower} status. Please try again.`, { variant: 'error' });
    }
  };

  return (
    <PageContainer tabTitle={`Edit ${entityLabel}`}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth="1100px" width="100%">
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', children: 'Admin' },
                { link: `/admin/${tabSlug}`, children: entityLabel },
                {
                  link: '#',
                  children: isFetching ? <Skeleton width={150} /> : feeSchedule?.title || '',
                },
              ]}
            />
            <Typography
              variant="h3"
              color="primary.dark"
              marginTop={2}
              marginBottom={2}
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}
            >
              {isFetching ? <Skeleton width={250} /> : feeSchedule?.title || ''}
            </Typography>
            <TabContext value={activeTab}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <TabList onChange={(_, v) => setActiveTab(v)} aria-label={`${entityLabel} sections`}>
                  <Tab label="Settings" value="settings" sx={{ textTransform: 'none', fontWeight: 500 }} />
                  <Tab label="Payer Associations" value="payers" sx={{ textTransform: 'none', fontWeight: 500 }} />
                  <Tab label="Procedure Codes" value="procedures" sx={{ textTransform: 'none', fontWeight: 500 }} />
                </TabList>
              </Box>
              <TabPanel value="settings" sx={{ p: 0 }}>
                {isFetching ? (
                  <Skeleton height={400} sx={{ marginY: -5 }} />
                ) : (
                  <Paper sx={{ padding: 3 }}>
                    <form onSubmit={onSubmit}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography
                          sx={{
                            ...theme.typography.h4,
                            color: theme.palette.primary.dark,
                            fontWeight: '600 !important',
                          }}
                        >
                          {entityLabel} settings
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        {isChargeMaster && currentDesignation === 'insurance-pay' && (
                          <Chip
                            label="Insurance CM"
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              height: 20,
                              backgroundColor: '#6A1B9A',
                              color: '#fff',
                            }}
                          />
                        )}
                        {isChargeMaster && currentDesignation === 'self-pay' && (
                          <Chip
                            label="Self-Pay CM"
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              height: 20,
                              backgroundColor: '#E91E90',
                              color: '#fff',
                            }}
                          />
                        )}
                      </Box>
                      <TextField
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        fullWidth
                        required
                        margin="dense"
                      />
                      {isChargeMaster && (
                        <TextField
                          label="Effective Date"
                          type="date"
                          value={formData.effectiveDate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                          fullWidth
                          required
                          margin="dense"
                          InputLabelProps={{ shrink: true }}
                          sx={{ marginTop: 2 }}
                        />
                      )}
                      <FormLabel
                        sx={{
                          ...theme.typography.subtitle2,
                          color: theme.palette.text.secondary,
                          mt: 2,
                          mb: 0.5,
                          display: 'block',
                        }}
                      >
                        Notes (Markdown)
                      </FormLabel>
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          '&:focus-within': {
                            borderColor: 'primary.main',
                            borderWidth: '2px',
                            margin: '-1px',
                          },
                        }}
                      >
                        {editor && (
                          <Box
                            sx={{
                              px: 1,
                              py: 0.5,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              backgroundColor: 'grey.50',
                              borderTopLeftRadius: 'inherit',
                              borderTopRightRadius: 'inherit',
                            }}
                          >
                            <ToolbarButtons ed={editor} />
                          </Box>
                        )}
                        <Box
                          sx={{
                            p: 2,
                            '& .ProseMirror': {
                              outline: 'none',
                              minHeight: '120px',
                              '& p.is-editor-empty:first-of-type::before': {
                                color: 'text.disabled',
                                content: 'attr(data-placeholder)',
                                float: 'left',
                                height: 0,
                                pointerEvents: 'none',
                              },
                              '& ul, & ol': {
                                paddingLeft: '1.5rem',
                              },
                              '& h1, & h2, & h3, & h4, & h5, & h6': {
                                fontWeight: 600,
                                marginTop: '1rem',
                                marginBottom: '0.5rem',
                              },
                              '& code': {
                                backgroundColor: 'action.hover',
                                borderRadius: '0.25rem',
                                padding: '0.125rem 0.25rem',
                                fontFamily: 'monospace',
                              },
                              '& pre': {
                                backgroundColor: 'action.hover',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                                overflow: 'auto',
                                '& code': {
                                  backgroundColor: 'transparent',
                                  padding: 0,
                                },
                              },
                              '& blockquote': {
                                borderLeft: '3px solid',
                                borderColor: 'divider',
                                paddingLeft: '1rem',
                                marginLeft: 0,
                              },
                            },
                          }}
                        >
                          <EditorContent editor={editor} />
                        </Box>
                      </Box>
                      {error && (
                        <Box color="error.main" width="100%" marginTop={2}>
                          {error}
                        </Box>
                      )}
                      <LoadingButton
                        variant="contained"
                        color="primary"
                        loading={updatePending}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 28,
                          marginTop: 3,
                          fontWeight: 'bold',
                          marginRight: 1,
                        }}
                        type="submit"
                        disabled={!formData.name || (isChargeMaster && !formData.effectiveDate)}
                      >
                        Save changes
                      </LoadingButton>
                      <Link to={baseUrl}>
                        <Button
                          variant="text"
                          color="primary"
                          sx={{
                            textTransform: 'none',
                            borderRadius: 28,
                            marginTop: 3,
                            fontWeight: 'bold',
                          }}
                        >
                          Cancel
                        </Button>
                      </Link>
                    </form>
                  </Paper>
                )}
                {isChargeMaster && !isFetching && feeSchedule && (
                  <Paper sx={{ padding: 3, marginTop: 3 }}>
                    <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                      Charge Master Designation
                    </Typography>
                    <Typography variant="body1" marginTop={1}>
                      Designate this {entityLabelLower} as the active charge master for insurance or self-pay billing.
                      Only one {entityLabelLower} can hold each designation at a time.
                    </Typography>
                    {currentDesignation && (
                      <Typography variant="body2" color="success.main" sx={{ mt: 1, fontWeight: 600 }}>
                        Currently designated as:{' '}
                        {currentDesignation === 'insurance-pay' ? 'Insurance Charge Master' : 'Self-Pay Charge Master'}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                      <LoadingButton
                        variant={currentDesignation === 'insurance-pay' ? 'contained' : 'outlined'}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 28,
                          fontWeight: 'bold',
                          ...(currentDesignation === 'insurance-pay'
                            ? {
                                backgroundColor: 'grey.400',
                                color: 'grey.700',
                                '&.Mui-disabled': { backgroundColor: 'grey.300', color: 'grey.600' },
                              }
                            : {
                                borderColor: '#6A1B9A',
                                color: '#6A1B9A',
                                '&:hover': { backgroundColor: '#6A1B9A', color: '#fff', borderColor: '#6A1B9A' },
                              }),
                        }}
                        loading={designatePending}
                        onClick={() => setPendingDesignation('insurance-pay')}
                        disabled={currentDesignation === 'insurance-pay'}
                      >
                        {currentDesignation === 'insurance-pay'
                          ? 'Insurance Charge Master ✓'
                          : 'Set as Insurance Charge Master'}
                      </LoadingButton>
                      <LoadingButton
                        variant={currentDesignation === 'self-pay' ? 'contained' : 'outlined'}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 28,
                          fontWeight: 'bold',
                          ...(currentDesignation === 'self-pay'
                            ? {
                                backgroundColor: 'grey.400',
                                color: 'grey.700',
                                '&.Mui-disabled': { backgroundColor: 'grey.300', color: 'grey.600' },
                              }
                            : {
                                borderColor: '#E91E90',
                                color: '#E91E90',
                                '&:hover': { backgroundColor: '#E91E90', color: '#fff', borderColor: '#E91E90' },
                              }),
                        }}
                        loading={designatePending}
                        onClick={() => setPendingDesignation('self-pay')}
                        disabled={currentDesignation === 'self-pay'}
                      >
                        {currentDesignation === 'self-pay'
                          ? 'Self-Pay Charge Master ✓'
                          : 'Set as Self-Pay Charge Master'}
                      </LoadingButton>
                    </Box>
                  </Paper>
                )}
                {!isFetching && feeSchedule && (
                  <Paper sx={{ padding: 3, marginTop: 3 }}>
                    <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                      {isActive ? `Deactivate ${entityLabelLower}` : `Activate ${entityLabelLower}`}
                    </Typography>
                    <Typography variant="body1" marginTop={1}>
                      {isActive
                        ? `When you deactivate this ${entityLabelLower}, it will no longer be available for use.`
                        : `Activate this ${entityLabelLower} to make it available for use.`}
                    </Typography>
                    <LoadingButton
                      variant="contained"
                      color={isActive ? 'error' : 'primary'}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 28,
                        marginTop: 4,
                        fontWeight: 'bold',
                        marginRight: 1,
                      }}
                      loading={updatePending}
                      onClick={() => handleStatusChange(isActive ? 'retired' : 'active')}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </LoadingButton>
                  </Paper>
                )}
              </TabPanel>
              <TabPanel value="payers" sx={{ p: 0 }}>
                <PayerAssociations feeSchedule={feeSchedule} isFetching={isFetching} mode={mode} />
              </TabPanel>
              <TabPanel value="procedures" sx={{ p: 0 }}>
                <ProcedureCodes feeSchedule={feeSchedule} isFetching={isFetching} mode={mode} />
              </TabPanel>
            </TabContext>
          </Grid>
        </Grid>
        <Dialog open={!!pendingDesignation} onClose={() => setPendingDesignation(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon color="warning" />
            Confirm Charge Master Designation
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              You are about to designate this {entityLabelLower} as the{' '}
              <strong>
                {pendingDesignation === 'insurance-pay' ? 'Insurance Charge Master' : 'Self-Pay Charge Master'}
              </strong>
              . Any other {entityLabelLower} currently holding this designation will have it removed. This action
              affects billing across the system.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPendingDesignation(null)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <LoadingButton
              variant="contained"
              color="warning"
              loading={designatePending}
              onClick={async () => {
                if (pendingDesignation) {
                  await handleDesignate(pendingDesignation);
                  setPendingDesignation(null);
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 'bold' }}
            >
              Proceed
            </LoadingButton>
          </DialogActions>
        </Dialog>
      </>
    </PageContainer>
  );
}
