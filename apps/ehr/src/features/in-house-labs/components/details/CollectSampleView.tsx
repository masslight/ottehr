import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Collapse,
  FormControl,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { getOrCreateVisitLabel } from 'src/api/api';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  getFormattedDiagnoses,
  InHouseOrderDetailPageItemDTO,
  LoadingState,
  MarkAsCollectedData,
  PageName,
} from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed/state/appointment/appointment.store';
import { InHouseLabsDetailsCard } from './InHouseLabsDetailsCard';

interface CollectSampleViewProps {
  testDetails: InHouseOrderDetailPageItemDTO;
  onBack: () => void;
  onSubmit: (data: MarkAsCollectedData) => Promise<void>;
  setLoadingState: (loadingState: LoadingState) => void;
}

export const CollectSampleView: React.FC<CollectSampleViewProps> = ({
  testDetails,
  onBack,
  onSubmit,
  setLoadingState,
}) => {
  console.log('Props', testDetails);
  const [showSampleCollection, setShowSampleCollection] = useState(true);
  const [sourceType, setSourceType] = useState('');
  const [collectedById, setCollectedById] = useState('');

  const initialDateTime = DateTime.now().setZone(testDetails.timezone);
  const [date, setDate] = useState<DateTime>(initialDateTime);
  const timeValue = date.toFormat('HH:mm');

  const [showDetails, setShowDetails] = useState(false);
  const [labelButtonLoading, setLabelButtonLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const currentUser = useEvolveUser();

  const [loading, setLoading] = useState(false);

  // set default collected by to current user if no choice made
  useEffect(() => {
    const id = currentUser?.profileResource?.id;
    if (!collectedById && id) {
      setCollectedById(id);
    }
  }, [collectedById, currentUser]);

  const providers =
    testDetails.currentUserId !== testDetails.orderingPhysicianId
      ? [
          { name: testDetails.currentUserFullName, id: testDetails.currentUserId },
          { name: testDetails.orderingPhysicianFullName, id: testDetails.orderingPhysicianId },
        ]
      : [{ name: testDetails.currentUserFullName, id: testDetails.currentUserId }];

  const handleToggleSampleCollection = (): void => {
    setShowSampleCollection(!showSampleCollection);
  };

  const handleMarkAsCollected = async (): Promise<void> => {
    setLoading(true);
    setError('');
    const isoDate = date.toISO();
    if (!isoDate) {
      setError('Issue parsing date');
      return;
    }
    try {
      await onSubmit({
        specimen: {
          source: sourceType,
          collectedBy: { id: collectedById, name: providers.find((p) => p.id === collectedById)?.name || '' },
          collectionDate: isoDate,
        },
      });
      setLoadingState(LoadingState.initial);
    } catch (error) {
      const sdkError = error as Oystehr.OystehrSdkError;
      setError(sdkError.message);
    } finally {
      setLoading(false);
    }
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
    <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '100vh' }}>
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, fontSize: '2rem', color: 'primary.dark' }}>
          Collect Sample
        </Typography>

        <Typography variant="body1" sx={{ mb: 4, fontSize: '1rem', color: '#5F6368' }}>
          {getFormattedDiagnoses(testDetails.diagnosesDTO)}
        </Typography>

        <Paper
          sx={{
            mb: 3,
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgb(225, 225, 225)',
            boxShadow: 'none',
          }}
        >
          <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography
                variant="h5"
                sx={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'primary.dark',
                }}
              >
                {testDetails.testItemName}
              </Typography>
              <Box
                sx={{
                  bgcolor: '#E8EAED',
                  color: '#5F6368',
                  fontWeight: 600,
                  px: 2,
                  py: 0.5,
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  letterSpacing: '0.5px',
                }}
              >
                {testDetails.status.toUpperCase()}
              </Box>
            </Box>

            <Box sx={{ backgroundColor: '#F8F9FA', mx: -3, p: 3, margin: 0, padding: '4px 24px' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  margin: 0,
                }}
                onClick={handleToggleSampleCollection}
              >
                <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>Sample collection</Typography>
                <IconButton size="small">
                  {showSampleCollection ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </IconButton>
              </Box>

              <Collapse in={showSampleCollection}>
                <Box>
                  <Grid container spacing={2} sx={{ padding: '4px 0 20px 0' }}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Source"
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        placeholder="Enter source"
                        variant="outlined"
                        sx={{
                          '& .MuiInputLabel-root': {
                            color: '#5F6368',
                            fontSize: '0.875rem',
                            lineHeight: '0.8rem',
                            '&.Mui-focused': {
                              color: '#5F6368',
                            },
                          },
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#FFFFFF',
                            '& fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&:hover fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#DADCE0',
                              borderWidth: '1px',
                            },
                            '& .MuiInputBase-input': {
                              py: 1.5,
                              fontSize: '0.875rem',
                            },
                          },
                          '& .MuiInputLabel-shrink': {
                            backgroundColor: '#F8F9FA',
                            px: 1,
                            fontSize: '0.75rem',
                          },
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        select
                        label="Collected by"
                        value={collectedById}
                        onChange={(e) => setCollectedById(e.target.value)}
                        variant="outlined"
                        SelectProps={{
                          IconComponent: KeyboardArrowDownIcon,
                        }}
                        sx={{
                          '& .MuiInputLabel-root': {
                            color: '#5F6368',
                            fontSize: '0.875rem',
                            lineHeight: '1rem',
                            '&.Mui-focused': {
                              color: '#5F6368',
                            },
                          },
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#FFFFFF',
                            '& fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&:hover fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#DADCE0',
                              borderWidth: '1px',
                            },
                            '& .MuiInputBase-input': {
                              py: 1.5,
                              fontSize: '0.875rem',
                            },
                          },
                          '& .MuiInputLabel-shrink': {
                            backgroundColor: '#F8F9FA',
                            px: 1,
                            fontSize: '0.75rem',
                          },
                        }}
                      >
                        {!collectedById && <MenuItem value="">Select</MenuItem>}
                        {providers.map((provider) => (
                          <MenuItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Collection date"
                        type="date"
                        value={date.toFormat('yyyy-MM-dd')}
                        onChange={handleDateChange}
                        variant="outlined"
                        InputLabelProps={{
                          shrink: true,
                        }}
                        sx={{
                          '& .MuiInputLabel-root': {
                            color: '#5F6368',
                            fontSize: '0.875rem',
                            '&.Mui-focused': {
                              color: '#5F6368',
                            },
                          },
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#FFFFFF',
                            '& fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&:hover fieldset': {
                              borderColor: '#DADCE0',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#DADCE0',
                              borderWidth: '1px',
                            },
                            '& .MuiInputBase-input': {
                              py: 1.5,
                              fontSize: '0.85rem',
                            },
                          },
                          '& .MuiInputLabel-shrink': {
                            backgroundColor: '#F8F9FA',
                            px: 1,
                            fontSize: '0.85rem',
                          },
                        }}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <TextField
                          label="Collection time"
                          type="time"
                          value={timeValue}
                          onChange={(e) => handleTimeChange(e)}
                          sx={{
                            '& .MuiInputLabel-root': {
                              color: '#5F6368',
                              fontSize: '0.875rem',
                              '&.Mui-focused': {
                                color: '#5F6368',
                              },
                            },
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: '#FFFFFF',
                              '& fieldset': {
                                borderColor: '#DADCE0',
                              },
                              '&:hover fieldset': {
                                borderColor: '#DADCE0',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#DADCE0',
                                borderWidth: '1px',
                              },
                              '& .MuiInputBase-input': {
                                py: 1.5,
                                fontSize: '0.85rem',
                              },
                            },
                            '& .MuiInputLabel-shrink': {
                              backgroundColor: '#F8F9FA',
                              px: 1,
                              fontSize: '0.85rem',
                            },
                          }}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              </Collapse>
            </Box>

            <InHouseLabsDetailsCard
              testDetails={testDetails}
              page={PageName.collectSample}
              showDetails={showDetails}
              setShowDetails={setShowDetails}
            />

            <Stack direction="row" spacing={2} justifyContent="space-between" mt={4}>
              <Button
                variant="outlined"
                onClick={handleReprintLabel}
                disabled={labelButtonLoading}
                sx={{
                  borderRadius: '20px',
                  px: 3,
                  py: 0.75,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderColor: '#1A73E8',
                  color: '#1A73E8',
                  '&:hover': {
                    borderColor: '#1A73E8',
                    backgroundColor: 'rgba(26, 115, 232, 0.04)',
                  },
                }}
              >
                Re-Print Label
              </Button>

              <LoadingButton
                loading={loading}
                variant="contained"
                onClick={handleMarkAsCollected}
                disabled={!sourceType || !collectedById || !date.isValid}
                sx={{
                  borderRadius: '20px',
                  px: 3,
                  py: 0.75,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  backgroundColor: '#1A73E8',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#1557B0',
                    boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
                  },
                  '&:disabled': {
                    backgroundColor: '#E8EAED',
                    color: '#9AA0A6',
                  },
                }}
              >
                Mark as Collected
              </LoadingButton>
            </Stack>

            {!!error && (
              <Box mt={2}>
                <Typography sx={{ color: theme.palette.error.main, fontSize: '0.875rem' }}>{error}</Typography>
              </Box>
            )}
          </Box>
        </Paper>

        <Button
          variant="outlined"
          onClick={onBack}
          sx={{
            borderRadius: '20px',
            px: 3,
            py: 0.75,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderColor: '#DADCE0',
          }}
        >
          Back
        </Button>
      </Box>
    </Box>
  );
};
