import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Collapse,
  Input,
  useTheme,
  Stack,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { InHouseLabDTO, MarkAsCollectedData } from 'utils';
import { DateTime } from 'luxon';
import { InHouseLabOrderHistory } from './InHouseLabOrderHistory';
import { useAppointmentStore } from '../../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { getOrCreateVisitLabel } from 'src/api/api';
import { useApiClients } from '../../../../hooks/useAppClients';
import { LoadingButton } from '@mui/lab';

interface CollectSampleViewProps {
  testDetails: InHouseLabDTO;
  onBack: () => void;
  onSubmit: (data: MarkAsCollectedData) => void;
}

export const CollectSampleView: React.FC<CollectSampleViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [showSampleCollection, setShowSampleCollection] = useState(true);
  const [sourceType, setSourceType] = useState('');
  const [collectedById, setCollectedById] = useState('');

  const initialDateTime = DateTime.now();
  const [date, setDate] = useState(initialDateTime);
  const dateValue = date.toFormat('yyyy-MM-dd');
  const timeValue = date.toFormat('HH:mm');

  const [notes, setNotes] = useState(testDetails.notes || '');
  const [showDetails, setShowDetails] = useState(false);
  const [labelButtonLoading, setLabelButtonLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const providers =
    testDetails.currentUserId !== testDetails.providerId
      ? [
          { name: testDetails.currentUserName, id: testDetails.currentUserId },
          { name: testDetails.providerName, id: testDetails.providerId },
        ]
      : [{ name: testDetails.currentUserName, id: testDetails.currentUserId }];

  const handleToggleSampleCollection = (): void => {
    setShowSampleCollection(!showSampleCollection);
  };

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleMarkAsCollected = (): void => {
    onSubmit({
      specimen: {
        source: sourceType,
        collectedBy: { id: collectedById, name: providers.find((p) => p.id === collectedById)?.name || '' },
        collectionDate: date.toISO(),
      },
      notes,
    });
  };

  const handleReprintLabel = async (): Promise<void> => {
    if (encounter.id && oystehrZambda) {
      setLabelButtonLoading(true);
      console.log('Fetching visit label for encounter ', encounter.id);
      const labelPdfs = await getOrCreateVisitLabel(oystehrZambda, { encounterId: encounter.id });

      if (labelPdfs.length !== 1) {
        setError('Expected 1 label pdf, received unexpected number');
        return;
      }

      const labelPdf = labelPdfs[0];
      window.open(labelPdf.presignedURL, '_blank');
      setLabelButtonLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;

    if (newValue && newValue.length === 10) {
      const newDate = DateTime.fromFormat(newValue, 'yyyy-MM-dd').set({
        hour: date.hour,
        minute: date.minute,
      });

      if (newDate.isValid) {
        setDate(newDate);
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    const newValue = e.target.value;

    if (newValue && newValue.length === 5) {
      const [hour, minute] = newValue.split(':').map(Number);
      const newDate = date.set({ hour, minute });

      if (newDate.isValid) {
        setDate(newDate);
      }
    }
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {testDetails.diagnosis}
      </Typography>

      <Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Collect Sample
      </Typography>

      <Paper sx={{ mb: 2, borderRadius: '8px', boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" color="primary.dark" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
              {testDetails.name}
            </Typography>
            <Box
              sx={{
                bgcolor: '#F1F3F4',
                color: '#5F6368',
                fontWeight: 'bold',
                px: 2,
                py: 0.5,
                borderRadius: '4px',
                fontSize: '0.87rem',
              }}
            >
              {testDetails.status.toUpperCase()}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#F8F9FA',
                p: 2,
                cursor: 'pointer',
                borderRadius: '8px',
              }}
              onClick={handleToggleSampleCollection}
            >
              <Typography variant="h6" fontWeight="bold">
                Sample collection
              </Typography>
              <IconButton size="small">
                {showSampleCollection ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              </IconButton>
            </Box>

            <Collapse in={showSampleCollection}>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Source
                    </Typography>
                    <FormControl fullWidth>
                      <Input
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        placeholder="Enter source"
                      />
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collected by
                    </Typography>
                    <FormControl fullWidth>
                      <Select
                        value={collectedById}
                        onChange={(e) => setCollectedById(e.target.value)}
                        displayEmpty
                        sx={{
                          '& .MuiSelect-select': { py: 1.5 },
                          borderRadius: '4px',
                        }}
                        renderValue={(value) => (value ? providers.find((p) => p.id === value)?.name : 'Select')}
                      >
                        <MenuItem value="">Select</MenuItem>
                        {providers.map((provider) => (
                          <MenuItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collection date
                    </Typography>
                    <FormControl fullWidth>
                      <TextField
                        type="date"
                        value={dateValue}
                        onChange={handleDateChange}
                        sx={{
                          '& .MuiInputBase-input': { py: 1.5 },
                          '& .MuiOutlinedInput-root': { borderRadius: '4px' },
                        }}
                      />
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collection time
                    </Typography>
                    <FormControl fullWidth>
                      <TextField
                        type="time"
                        value={timeValue}
                        onChange={(e) => handleTimeChange(e)}
                        sx={{
                          '& .MuiInputBase-input': { py: 1.5 },
                          '& .MuiOutlinedInput-root': { borderRadius: '4px' },
                        }}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>

          <Box sx={{ mt: 3, px: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Notes
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '4px' },
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'end',
              alignItems: 'center',
              mt: 3,
              cursor: 'pointer',
              color: '#4285f4',
            }}
            onClick={handleToggleDetails}
          >
            <Typography sx={{ fontWeight: 'medium' }}>Details</Typography>
            <IconButton size="small" color="primary">
              {showDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Box>

          <InHouseLabOrderHistory showDetails={showDetails} testDetails={testDetails} />
          <Stack display="flex">
            <Box display="flex" justifyContent="space-between" mt={3}>
              <LoadingButton
                loading={labelButtonLoading}
                variant="outlined"
                onClick={handleReprintLabel}
                sx={{ borderRadius: '50px', px: 4 }}
              >
                Re-Print Label
              </LoadingButton>

              <Button
                variant="contained"
                color="primary"
                onClick={handleMarkAsCollected}
                disabled={!sourceType || !collectedById || !date.isValid}
                sx={{
                  borderRadius: '50px',
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  fontSize: '1rem',
                  backgroundColor: '#4285f4',
                  '&:hover': {
                    backgroundColor: '#3367d6',
                  },
                }}
              >
                Mark as Collected
              </Button>
            </Box>
            <Box display="flex" justifyContent="space-between" mt={3}>
              {!!error && <Typography sx={{ color: theme.palette.error.main }}>{error}</Typography>}
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Button
        variant="outlined"
        onClick={onBack}
        sx={{
          borderRadius: '50px',
          px: 4,
          py: 1.5,
          textTransform: 'none',
          fontSize: '1rem',
        }}
      >
        Back
      </Button>
    </Box>
  );
};
