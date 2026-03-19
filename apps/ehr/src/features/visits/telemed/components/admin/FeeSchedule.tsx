import AddIcon from '@mui/icons-material/Add';
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
import { FEE_SCHEDULES_URL } from 'src/App';
import {
  useCreateFeeScheduleMutation,
  useListFeeSchedulesQuery,
} from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL } from 'utils';

export default function FeeSchedule(): ReactElement {
  const [searchText, setSearchText] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newFeeSchedule, setNewFeeSchedule] = React.useState({ name: '', effectiveDate: '' });
  const createFeeScheduleMutation = useCreateFeeScheduleMutation();
  const { data: feeSchedules, isPending } = useListFeeSchedulesQuery();
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
      await createFeeScheduleMutation.mutateAsync({ ...newFeeSchedule, description: '' });
      enqueueSnackbar('Fee schedule created successfully', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['fee-schedules'] });
      handleCloseDialog();
    } catch {
      enqueueSnackbar('Failed to create fee schedule', { variant: 'error' });
    }
  };

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={10}>
            <TextField
              fullWidth
              id="fee-schedule-search"
              label="Fee Schedule"
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

        <Table sx={{ minWidth: 650, mt: 1 }} aria-label="fee-schedules-table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
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
                  <TableCell>
                    <Skeleton width={100} />
                  </TableCell>
                </TableRow>
              ))}
            {!isPending && filteredFeeSchedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography color="text.secondary">No fee schedules found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredFeeSchedules.map((fs: ChargeItemDefinition) => (
              <TableRow
                key={fs.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`${FEE_SCHEDULES_URL}/${fs.id}`)}
              >
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
                    {fs.extension?.find((ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL)?.valueCode ===
                      'insurance-pay' && (
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
                    {fs.extension?.find((ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL)?.valueCode ===
                      'self-pay' && (
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
                </TableCell>
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
          Create Fee Schedule
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
            disabled={!newFeeSchedule.name || !newFeeSchedule.effectiveDate || createFeeScheduleMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
