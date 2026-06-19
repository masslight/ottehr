import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import InsightsIcon from '@mui/icons-material/Insights';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PeopleIcon from '@mui/icons-material/People';
import PsychologyIcon from '@mui/icons-material/Psychology';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleType, SavedAdHocReport } from 'utils';
import { deleteAdHocReport, listAdHocReports, saveAdHocReport } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';

interface ReportTileProps {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  onClick: () => void;
}

function ReportTile({ title, description, icon, onClick }: ReportTileProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: 200,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
        cursor: 'pointer',
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 2,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              color: 'white',
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 32 } })}
          </Box>
          <Typography variant="h6" component="h2" fontWeight={600} color="primary.dark">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function SavedReportTile({
  report,
  onOpen,
  onRename,
  onDelete,
}: {
  report: SavedAdHocReport;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Card
      sx={{
        height: 200,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
        cursor: 'pointer',
      }}
    >
      <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2, display: 'flex' }}>
        <Tooltip title="Edit">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <CardActionArea
        onClick={onOpen}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            gap: 1,
            width: '100%',
            overflow: 'hidden',
            p: 3,
          }}
        >
          {/* `pr` clears the edit/delete icon buttons pinned to the top-right corner. */}
          <Typography variant="h6" component="h2" fontWeight={600} color="primary.dark" sx={{ pr: 6, lineHeight: 1.3 }}>
            {report.name}
          </Typography>
          {report.description ? (
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              {report.description}
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.5, fontStyle: 'italic' }}>
              {(report.title ?? report.datasetId) + ' · ' + report.criteria.dateRange}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

interface ReportTileConfig {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  adminOnly?: boolean;
}

const REPORT_TILES: ReportTileConfig[] = [
  {
    title: 'Incomplete Encounters',
    description: 'View and manage encounters that are missing required information or documentation',
    icon: <AssignmentLateIcon />,
    path: '/reports/incomplete-encounters',
  },
  {
    title: 'Complete Encounters',
    description: 'View encounters that have been completed',
    icon: <AssignmentTurnedInIcon />,
    path: '/reports/complete-encounters',
  },
  {
    title: 'AI-Assisted Encounters',
    description: 'View encounters with AI-generated documentation and assistant interactions',
    icon: <PsychologyIcon />,
    path: '/reports/ai-assisted-encounters',
    adminOnly: true,
  },
  {
    title: 'Ad-Hoc Report',
    description: 'Describe a report in plain language and the AI generates it over the encounters dataset',
    icon: <AutoAwesomeIcon />,
    path: '/reports/ad-hoc',
    adminOnly: true,
  },
  {
    title: 'Daily Payments',
    description: 'Review daily payment reports and transaction summaries',
    icon: <AttachMoneyIcon />,
    path: '/reports/daily-payments',
  },
  {
    title: 'Practice KPIs',
    description: 'View location-level performance metrics for in-person visits',
    icon: <InsightsIcon />,
    path: '/reports/practice-kpis',
    adminOnly: true,
  },
  {
    title: 'Visits Overview',
    description: 'View appointment statistics and charts showing visit types (in-person vs telemed)',
    icon: <AssessmentIcon />,
    path: '/reports/visits-overview',
  },
  {
    title: 'Recent Patients',
    description: 'View list of recent patients with contact information and visit details',
    icon: <PeopleIcon />,
    path: '/reports/recent-patients',
  },
  {
    title: 'Mailed Statements',
    description: 'View patient statements sent by mail',
    icon: <MailOutlineIcon />,
    path: '/reports/mailed-statements',
    adminOnly: true,
  },
];

export default function Reports(): React.ReactElement {
  const navigate = useNavigate();
  const user = useEvolveUser();
  const isAdmin = user?.hasRole([RoleType.Administrator]) ?? false;
  const { oystehrZambda } = useApiClients();
  const { enqueueSnackbar } = useSnackbar();

  // Saved ad-hoc reports — same access gate as the Ad-Hoc Report tile (admin only).
  const [savedReports, setSavedReports] = useState<SavedAdHocReport[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedAdHocReport | null>(null);
  const [renameTarget, setRenameTarget] = useState<SavedAdHocReport | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshSaved = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !isAdmin) return;
    setLoadingSaved(true);
    try {
      const { reports } = await listAdHocReports(oystehrZambda);
      setSavedReports(reports);
    } catch (e) {
      console.error('Failed to load saved reports', e);
    } finally {
      setLoadingSaved(false);
    }
  }, [oystehrZambda, isAdmin]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const handleTileClick = (path: string): void => {
    navigate(path);
  };

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !deleteTarget) return;
    setBusy(true);
    try {
      await deleteAdHocReport(oystehrZambda, { reportId: deleteTarget.id });
      setSavedReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      enqueueSnackbar(`Deleted “${deleteTarget.name}”.`, { variant: 'success' });
      setDeleteTarget(null);
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Could not delete the report.', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }, [oystehrZambda, deleteTarget, enqueueSnackbar]);

  const handleSaveEdit = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !renameTarget || !renameValue.trim()) return;
    setBusy(true);
    try {
      // Re-save the same definition with the new name + description (id present → update in place).
      const { id, updatedAt: _updatedAt, ...definition } = renameTarget;
      await saveAdHocReport(oystehrZambda, {
        reportId: id,
        definition: { ...definition, name: renameValue.trim(), description: descriptionValue.trim() || undefined },
      });
      enqueueSnackbar('Report updated.', { variant: 'success' });
      setRenameTarget(null);
      void refreshSaved();
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Could not update the report.', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }, [oystehrZambda, renameTarget, renameValue, descriptionValue, enqueueSnackbar, refreshSaved]);

  return (
    <PageContainer>
      <>
        <Box>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom color="primary.dark" fontWeight={600}>
              Reports
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Select a report to view detailed information and analytics
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {REPORT_TILES.filter((tile) => isAdmin || !tile.adminOnly).map((tile) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={tile.path}>
                <ReportTile
                  title={tile.title}
                  description={tile.description}
                  icon={tile.icon}
                  path={tile.path}
                  onClick={() => handleTileClick(tile.path)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Saved ad-hoc reports — practice-wide, admin-gated like the Ad-Hoc Report tile. */}
          {isAdmin && (loadingSaved || savedReports.length > 0) && (
            <Box sx={{ mt: 5 }}>
              <Typography variant="h5" component="h2" gutterBottom color="primary.dark" fontWeight={600}>
                Saved reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Saved ad-hoc reports re-fetch fresh data for their criteria each time you open them.
              </Typography>
              {loadingSaved && savedReports.length === 0 ? (
                <CircularProgress size={24} />
              ) : (
                <Grid container spacing={3}>
                  {savedReports.map((report) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={report.id}>
                      <SavedReportTile
                        report={report}
                        onOpen={() => navigate(`/reports/ad-hoc?saved=${encodeURIComponent(report.id)}`)}
                        onRename={() => {
                          setRenameValue(report.name);
                          setDescriptionValue(report.description ?? '');
                          setRenameTarget(report);
                        }}
                        onDelete={() => setDeleteTarget(report)}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Box>

        <Dialog
          open={!!deleteTarget}
          onClose={() => (busy ? undefined : setDeleteTarget(null))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete saved report</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Delete “{deleteTarget?.name}”? This removes the tile for everyone. The underlying data is unaffected.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={busy}>
              {busy ? <CircularProgress size={18} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!renameTarget}
          onClose={() => (busy ? undefined : setRenameTarget(null))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Edit report</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Report name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim() && !busy) {
                  e.preventDefault();
                  void handleSaveEdit();
                }
              }}
              sx={{ mt: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Description (optional)"
              placeholder="A sentence or two describing what this report shows."
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void handleSaveEdit()} disabled={busy || !renameValue.trim()}>
              {busy ? <CircularProgress size={18} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    </PageContainer>
  );
}
