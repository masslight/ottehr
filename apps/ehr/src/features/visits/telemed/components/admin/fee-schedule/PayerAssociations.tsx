import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
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
import { useQueryClient } from '@tanstack/react-query';
import { ChargeItemDefinition, Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useMemo } from 'react';
import {
  useCmAssociatePayerMutation,
  useCmDisassociatePayerMutation,
} from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  useAssociatePayerMutation,
  useDisassociatePayerMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { useInsurancesQuery } from '../admin.queries';
import { ChargeItemMode } from '../FeeSchedule';

const PAYER_ID_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const PAYER_ID_CODE = 'XX';

function getPayerId(org: Organization | undefined): string {
  if (!org) return '';
  const identifier = org.identifier?.find(
    (id) => id.type?.coding?.some((c) => c.system === PAYER_ID_SYSTEM && c.code === PAYER_ID_CODE)
  );
  return identifier?.value || '';
}

interface PayerAssociationsProps {
  feeSchedule: ChargeItemDefinition | undefined;
  isFetching: boolean;
  mode?: ChargeItemMode;
}

export default function PayerAssociations({
  feeSchedule,
  isFetching,
  mode = 'fee-schedule',
}: PayerAssociationsProps): ReactElement {
  const isChargeMaster = mode === 'charge-master';
  const queryKey = isChargeMaster ? 'charge-masters' : 'fee-schedules';
  const [searchText, setSearchText] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedOrgs, setSelectedOrgs] = React.useState<Organization[]>([]);
  const [dialogSearch, setDialogSearch] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: allInsuranceOrgs, isPending: orgsLoading } = useInsurancesQuery(undefined, true);
  const fsAssociate = useAssociatePayerMutation();
  const fsDisassociate = useDisassociatePayerMutation();
  const cmAssociate = useCmAssociatePayerMutation();
  const cmDisassociate = useCmDisassociatePayerMutation();
  const { mutateAsync: associatePayer, isPending: associating } = isChargeMaster ? cmAssociate : fsAssociate;
  const { mutateAsync: disassociatePayer, isPending: disassociating } = isChargeMaster
    ? cmDisassociate
    : fsDisassociate;

  // Extract currently associated org IDs from useContext
  const associatedOrgIds = useMemo(() => {
    if (!feeSchedule?.useContext) return [];
    return feeSchedule.useContext
      .filter((uc) => uc.valueReference?.reference?.startsWith('Organization/'))
      .map((uc) => uc.valueReference!.reference!.replace('Organization/', ''));
  }, [feeSchedule?.useContext]);

  // Build list of associated orgs with names from the insurance orgs query
  const associatedOrgs = useMemo(() => {
    return associatedOrgIds.map((orgId) => {
      const org = allInsuranceOrgs?.find((o) => o.id === orgId);
      return {
        id: orgId,
        name: org?.name || orgId,
        payerId: getPayerId(org),
      };
    });
  }, [associatedOrgIds, allInsuranceOrgs]);

  // Filter associated orgs by search text
  const filteredOrgs = useMemo(() => {
    if (!searchText) return associatedOrgs;
    const lower = searchText.toLowerCase();
    return associatedOrgs.filter(
      (o) =>
        o.name.toLowerCase().includes(lower) ||
        o.id.toLowerCase().includes(lower) ||
        o.payerId.toLowerCase().includes(lower)
    );
  }, [associatedOrgs, searchText]);

  // Available orgs for the dialog (active, not already associated)
  const availableOrgs = useMemo(() => {
    if (!allInsuranceOrgs) return [];
    return allInsuranceOrgs.filter((org) => org.active !== false && org.id && !associatedOrgIds.includes(org.id));
  }, [allInsuranceOrgs, associatedOrgIds]);

  // Filter available orgs by dialog search text
  const filteredAvailableOrgs = useMemo(() => {
    if (!dialogSearch) return availableOrgs;
    const lower = dialogSearch.toLowerCase();
    return availableOrgs.filter((o) => {
      const name = (o.name || '').toLowerCase();
      const pid = getPayerId(o).toLowerCase();
      return name.includes(lower) || pid.includes(lower);
    });
  }, [availableOrgs, dialogSearch]);

  const toggleOrg = (org: Organization): void => {
    setSelectedOrgs((prev) => {
      const isSelected = prev.some((o) => o.id === org.id);
      return isSelected ? prev.filter((o) => o.id !== org.id) : [...prev, org];
    });
  };

  const handleAssociate = async (): Promise<void> => {
    if (!feeSchedule?.id || selectedOrgs.length === 0) return;
    try {
      for (const org of selectedOrgs) {
        if (!org.id) continue;
        const idParam = isChargeMaster
          ? { chargeMasterId: feeSchedule.id, organizationId: org.id }
          : { feeScheduleId: feeSchedule.id, organizationId: org.id };
        await associatePayer(idParam as any);
      }
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      const names = selectedOrgs.map((o) => o.name || o.id).join(', ');
      enqueueSnackbar(`Associated ${names}`, { variant: 'success' });
      setDialogOpen(false);
      setSelectedOrgs([]);
    } catch {
      enqueueSnackbar('Error associating payer(s). Please try again.', { variant: 'error' });
    }
  };

  const handleDisassociate = async (orgId: string, orgName: string): Promise<void> => {
    if (!feeSchedule?.id) return;
    try {
      const idParam = isChargeMaster
        ? { chargeMasterId: feeSchedule.id, organizationId: orgId }
        : { feeScheduleId: feeSchedule.id, organizationId: orgId };
      await disassociatePayer(idParam as any);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      enqueueSnackbar(`Removed ${orgName}`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Error removing payer association. Please try again.', { variant: 'error' });
    }
  };

  if (isFetching) {
    return <Skeleton height={300} sx={{ marginY: -5 }} />;
  }

  if (!feeSchedule) {
    return <></>;
  }

  return (
    <>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important', mb: 1 }}>
          Payer Associations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Associate insurance payers with this fee schedule. When a payer is associated, this fee schedule will be used
          for billing that payer.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search associated payers..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            onClick={() => setDialogOpen(true)}
          >
            Add payer
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Payer Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Payer ID</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {associatedOrgs.length === 0
                      ? 'No payer associations yet. Click "Add payer" to associate a payer with this fee schedule.'
                      : 'No matching payers found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => (
                  <TableRow key={org.id} hover>
                    <TableCell
                      onClick={() => {
                        void navigator.clipboard.writeText(org.id);
                        setCopiedId(org.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      sx={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {org.name}
                        {copiedId === org.id ? (
                          <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{org.payerId}</TableCell>
                    <TableCell>
                      <Tooltip title="Remove association">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDisassociate(org.id, org.name)}
                          disabled={disassociating}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { height: '70vh' } }}
      >
        <DialogTitle>Associate Payers</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Select active insurance organizations to associate with this fee schedule.
            {selectedOrgs.length > 0 && <strong> ({selectedOrgs.length} selected)</strong>}
          </Typography>
          <TextField
            size="small"
            placeholder="Filter by name or payer ID..."
            value={dialogSearch}
            onChange={(e) => setDialogSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
            }}
            sx={{ mb: 1 }}
          />
          {orgsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredAvailableOrgs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {dialogSearch ? 'No matching active insurance organizations.' : 'No available insurance organizations.'}
            </Typography>
          ) : (
            <List
              dense
              sx={{ flex: 1, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              {filteredAvailableOrgs.map((org) => {
                const isSelected = selectedOrgs.some((o) => o.id === org.id);
                return (
                  <ListItemButton key={org.id} onClick={() => toggleOrg(org)} dense>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={isSelected} disableRipple size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={org.name}
                      secondary={`Payer ID: ${getPayerId(org) || 'N/A'}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setSelectedOrgs([]);
              setDialogSearch('');
            }}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={selectedOrgs.length === 0 || associating}
            sx={{ textTransform: 'none' }}
          >
            {associating ? 'Associating...' : `Associate${selectedOrgs.length > 0 ? ` (${selectedOrgs.length})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
