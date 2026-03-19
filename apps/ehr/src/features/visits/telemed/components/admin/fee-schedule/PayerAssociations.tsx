import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  useAssociatePayerMutation,
  useDisassociatePayerMutation,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { useInsurancesQuery } from '../admin.queries';

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
}

export default function PayerAssociations({ feeSchedule, isFetching }: PayerAssociationsProps): ReactElement {
  const [searchText, setSearchText] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedOrg, setSelectedOrg] = React.useState<Organization | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: allInsuranceOrgs, isPending: orgsLoading } = useInsurancesQuery(undefined, true);
  const { mutateAsync: associatePayer, isPending: associating } = useAssociatePayerMutation();
  const { mutateAsync: disassociatePayer, isPending: disassociating } = useDisassociatePayerMutation();

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

  const handleAssociate = async (): Promise<void> => {
    if (!feeSchedule?.id || !selectedOrg?.id) return;
    try {
      await associatePayer({ feeScheduleId: feeSchedule.id, organizationId: selectedOrg.id });
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
      enqueueSnackbar(`Associated ${selectedOrg.name || selectedOrg.id}`, { variant: 'success' });
      setDialogOpen(false);
      setSelectedOrg(null);
    } catch {
      enqueueSnackbar('Error associating payer. Please try again.', { variant: 'error' });
    }
  };

  const handleDisassociate = async (orgId: string, orgName: string): Promise<void> => {
    if (!feeSchedule?.id) return;
    try {
      await disassociatePayer({ feeScheduleId: feeSchedule.id, organizationId: orgId });
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Associate Payer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search for an active insurance organization to associate with this fee schedule.
          </Typography>
          <Autocomplete
            options={availableOrgs}
            getOptionLabel={(option) => {
              const pid = getPayerId(option);
              return pid ? `${option.name} (${pid})` : option.name || option.id || '';
            }}
            filterOptions={(options, { inputValue }) => {
              const lower = inputValue.toLowerCase();
              return options.filter((o) => {
                const name = (o.name || '').toLowerCase();
                const pid = getPayerId(o).toLowerCase();
                return name.includes(lower) || pid.includes(lower);
              });
            }}
            value={selectedOrg}
            onChange={(_, value) => setSelectedOrg(value)}
            loading={orgsLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Insurance Organization"
                placeholder="Start typing to search..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {orgsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body1">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Payer ID: {getPayerId(option) || 'N/A'}
                  </Typography>
                </Box>
              </li>
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="No matching active insurance organizations"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setSelectedOrg(null);
            }}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={!selectedOrg || associating}
            sx={{ textTransform: 'none' }}
          >
            {associating ? 'Associating...' : 'Associate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
