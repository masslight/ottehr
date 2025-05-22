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
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { LabTest, inHouseLabsTestStatuses } from 'utils';

interface CollectSampleViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void; // todo: type this (TestStatus)
}

export const CollectSampleView: React.FC<CollectSampleViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [showSampleCollection, setShowSampleCollection] = useState(true);
  const [sourceType, setSourceType] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [collectionTime, setCollectionTime] = useState('');
  const [notes, setNotes] = useState(testDetails.notes || '');

  const handleToggleSampleCollection = (): void => {
    setShowSampleCollection(!showSampleCollection);
  };

  const handleMarkAsCollected = (): void => {
    onSubmit({
      status: inHouseLabsTestStatuses.COLLECTED,
      specimen: {
        source: sourceType,
        collectedBy,
        collectionDate,
        collectionTime,
      },
      notes,
    });
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.id);
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {testDetails.diagnosis}
      </Typography>

      <Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Collect Sample
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" color="primary.dark" fontWeight="bold">
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
                fontSize: '0.75rem',
              }}
            >
              ORDERED
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
                      <Select
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        displayEmpty
                        sx={{ '& .MuiSelect-select': { py: 1.5 } }}
                      >
                        <MenuItem value="">Select</MenuItem>
                        <MenuItem value="Blood">Blood</MenuItem>
                        <MenuItem value="Urine">Urine</MenuItem>
                        <MenuItem value="Throat">Throat</MenuItem>
                        <MenuItem value="Nasal">Nasal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collected by
                    </Typography>
                    <FormControl fullWidth>
                      <Select
                        value={collectedBy}
                        onChange={(e) => setCollectedBy(e.target.value)}
                        displayEmpty
                        sx={{ '& .MuiSelect-select': { py: 1.5 } }}
                      >
                        <MenuItem value="">Select</MenuItem>
                        <MenuItem value="Samanta Brooks">Samanta Brooks</MenuItem>
                        <MenuItem value="John Smith">John Smith</MenuItem>
                        <MenuItem value="Jane Doe">Jane Doe</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collection date
                    </Typography>
                    <FormControl fullWidth>
                      <TextField
                        value={collectionDate}
                        onChange={(e) => setCollectionDate(e.target.value)}
                        placeholder="MM/DD/YYYY"
                        InputProps={{
                          endAdornment: <CalendarTodayIcon color="action" />,
                        }}
                      />
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Collection time
                    </Typography>
                    <FormControl fullWidth>
                      {/* todo: add date picker here */}
                      <Select
                        value={collectionTime}
                        onChange={(e) => setCollectionTime(e.target.value)}
                        displayEmpty
                        sx={{ '& .MuiSelect-select': { py: 1.5 } }}
                      >
                        <MenuItem value="">Select</MenuItem>
                        <MenuItem value="9:00 AM">9:00 AM</MenuItem>
                        <MenuItem value="9:20 AM">9:20 AM</MenuItem>
                        <MenuItem value="9:30 AM">9:30 AM</MenuItem>
                        <MenuItem value="10:00 AM">10:00 AM</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Notes
            </Typography>
            <TextField fullWidth multiline rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Box>

          <Box display="flex" justifyContent="space-between" mt={3}>
            <Button variant="outlined" onClick={handleReprintLabel} sx={{ borderRadius: '50px', px: 4 }}>
              Re-Print Label
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={handleMarkAsCollected}
              disabled={!sourceType || !collectedBy || !collectionDate || !collectionTime}
              sx={{ borderRadius: '50px', px: 4 }}
            >
              Mark as Collected
            </Button>
          </Box>
        </Box>
      </Paper>

      <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
        Back
      </Button>
    </Box>
  );
};
