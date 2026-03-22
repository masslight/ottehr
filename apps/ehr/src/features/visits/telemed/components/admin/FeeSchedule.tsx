import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Paper,
  Skeleton,
  Switch,
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
import { ChargeItemDefinition } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHARGE_MASTERS_URL, FEE_SCHEDULES_URL } from 'src/App';
import {
  useCreateChargeMasterMutation,
  useListChargeMastersQuery,
} from 'src/rcm/state/charge-masters/charge-master.queries';
import {
  useCreateFeeScheduleMutation,
  useListFeeSchedulesQuery,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CASE_RATE_CODE, RCM_TAG_SYSTEM } from 'utils';

export type ChargeItemMode = 'fee-schedule' | 'charge-master';

export interface FeeScheduleProps {
  mode?: ChargeItemMode;
}

export default function FeeSchedule({ mode = 'fee-schedule' }: FeeScheduleProps): ReactElement {
  const isChargeMaster = mode === 'charge-master';
  const label = isChargeMaster ? 'Charge Master' : 'Fee Schedule';
  const queryKey = isChargeMaster ? 'charge-masters' : 'fee-schedules';
  const baseUrl = isChargeMaster ? CHARGE_MASTERS_URL : FEE_SCHEDULES_URL;
  const [searchText, setSearchText] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newFeeSchedule, setNewFeeSchedule] = React.useState({ name: '', effectiveDate: '' });
  const createFeeScheduleMutation = useCreateFeeScheduleMutation();
  const createChargeMasterMutation = useCreateChargeMasterMutation();
  const createMutation = isChargeMaster ? createChargeMasterMutation : createFeeScheduleMutation;
  const { data: feeScheduleData, isPending: fsPending } = useListFeeSchedulesQuery();
  const { data: chargeMasterData, isPending: cmPending } = useListChargeMastersQuery();
  const feeSchedules = isChargeMaster ? chargeMasterData : feeScheduleData;
  const isPending = isChargeMaster ? cmPending : fsPending;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const filteredFeeSchedules = React.useMemo(() => {
    if (!feeSchedules) return [];
    let filtered = feeSchedules;
    if (!showInactive) {
      filtered = filtered.filter((fs: ChargeItemDefinition) => fs.status === 'active');
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((fs: ChargeItemDefinition) => fs.title?.toLowerCase().includes(lower));
    }
    return filtered;
  }, [feeSchedules, searchText, showInactive]);

  const handleChangeSearchText = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void =>
    setSearchText(event.target.value);

  const handleOpenDialog = (): void => {
    setNewFeeSchedule({ name: '', effectiveDate: '' });
    setDialogOpen(true);
  };

  const handleCloseDialog = (): void => {
    setDialogOpen(false);
  };

  const handleCreate = async (): Promise<void> => {
    try {
      await createMutation.mutateAsync({ ...newFeeSchedule, description: '' });
      enqueueSnackbar(`${label} created successfully`, { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      handleCloseDialog();
    } catch {
      enqueueSnackbar(`Failed to create ${label.toLowerCase()}`, { variant: 'error' });
    }
  };

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      {!isChargeMaster && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            backgroundColor: 'info.light',
            color: 'info.dark',
            borderRadius: 1,
            px: 2,
            py: 1.5,
            mb: 2,
            fontSize: '0.875rem',
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: '1.25rem', mt: '2px', flexShrink: 0 }} />
          <Typography variant="body2" color="inherit">
            Fee schedules define the expected reimbursement rates negotiated with each insurance payer. When calculating
            patient responsibility, the system applies the fee schedule associated with the patient&apos;s insurance. If
            no fee schedule is assigned to a given payer, the default insurance charge master rates will be used
            instead.
          </Typography>
        </Box>
      )}
      {isChargeMaster && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            backgroundColor: 'info.light',
            color: 'info.dark',
            borderRadius: 1,
            px: 2,
            py: 1.5,
            mb: 2,
            fontSize: '0.875rem',
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: '1.25rem', mt: '2px', flexShrink: 0 }} />
          <Typography variant="body2" color="inherit">
            Charge masters define the rates billed to a specific insurance payer. When no payer-specific charge master
            is assigned, the active default insurance charge master will be applied. For patients without insurance
            coverage, the active self-pay charge master will be used.
          </Typography>
        </Box>
      )}
      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={10}>
            <TextField
              fullWidth
              id={`${mode}-search`}
              label={label}
              value={searchText}
              onChange={handleChangeSearchText}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={12} sm={2} display={'flex'}>
            <Button
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                width: '100%',
                fontWeight: 600,
              }}
              color="primary"
              variant="contained"
              onClick={handleOpenDialog}
            >
              <AddIcon />
              <Typography fontWeight="bold">Add new</Typography>
            </Button>
          </Grid>
        </Grid>

        <FormControlLabel
          control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} size="small" />}
          label="Show inactive"
          sx={{ mt: 1, ml: 0.5 }}
        />

        <Table sx={{ minWidth: 650, mt: 1 }} aria-label={`${mode}-table`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              {!isChargeMaster && <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>}
              <TableCell sx={{ fontWeight: 'bold' }}>Effective Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending &&
              [1, 2, 3].map((id) => (
                <TableRow key={`skeleton-${id}`}>
                  <TableCell sx={{ width: 32, p: 0 }} />
                  <TableCell>
                    <Skeleton width={150} />
                  </TableCell>
                  {!isChargeMaster && (
                    <TableCell>
                      <Skeleton width={80} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton width={100} />
                  </TableCell>
                </TableRow>
              ))}
            {!isPending && filteredFeeSchedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={isChargeMaster ? 3 : 4} align="center">
                  <Typography color="text.secondary">No {label.toLowerCase()}s found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredFeeSchedules.map((fs: ChargeItemDefinition) => (
              <TableRow key={fs.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`${baseUrl}/${fs.id}`)}>
                <TableCell sx={{ width: 32, p: 0, textAlign: 'center' }}>
                  <Tooltip title={fs.status === 'active' ? 'Active' : 'Inactive'}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: fs.status === 'active' ? 'success.main' : 'grey.400',
                        display: 'inline-block',
                      }}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {fs.title}
                    {isChargeMaster &&
                      fs.meta?.tag?.find((t) => t.system === RCM_TAG_SYSTEM && t.code === 'default-insurance') && (
                        <Chip
                          label="Default Insurance"
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            backgroundColor: '#6A1B9A',
                            color: '#fff',
                          }}
                        />
                      )}
                    {isChargeMaster &&
                      fs.meta?.tag?.find((t) => t.system === RCM_TAG_SYSTEM && t.code === 'self-pay') && (
                        <Chip
                          label="Self-Pay"
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
                </TableCell>
                {!isChargeMaster && (
                  <TableCell>
                    {fs.meta?.tag?.find((t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE) ? (
                      <Chip
                        label="Case Rate"
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          backgroundColor: '#E65100',
                          color: '#fff',
                        }}
                      />
                    ) : (
                      <Chip
                        label="Fee-for-Service"
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          borderColor: '#2E7D32',
                          color: '#2E7D32',
                        }}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell>{fs.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        disableScrollLock
        maxWidth="sm"
        fullWidth
        sx={{ '.MuiPaper-root': { padding: 2 } }}
      >
        <DialogTitle variant="h4" color="primary.dark">
          Create {label}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={newFeeSchedule.name}
            onChange={(e) => setNewFeeSchedule((prev) => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
            margin="dense"
          />
          <TextField
            label="Effective Date"
            type="date"
            value={newFeeSchedule.effectiveDate}
            onChange={(e) => setNewFeeSchedule((prev) => ({ ...prev, effectiveDate: e.target.value }))}
            fullWidth
            required
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCloseDialog} sx={buttonSx}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            sx={buttonSx}
            disabled={!newFeeSchedule.name || !newFeeSchedule.effectiveDate || createMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
