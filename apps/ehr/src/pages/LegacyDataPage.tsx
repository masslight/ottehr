import { Box, Button, Chip, CircularProgress, Grid, Link, Paper, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import React, { ReactElement, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LegacyPatientRecord, searchLegacyRecords, SearchLegacyRecordsOutput } from 'src/api/api';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

export default function LegacyDataPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [searchParams] = useSearchParams();

  const [lastName, setLastName] = useState(searchParams.get('lastName') ?? '');
  const [firstName, setFirstName] = useState(searchParams.get('firstName') ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(searchParams.get('dob') ?? '');
  const [lastNameError, setLastNameError] = useState('');

  const searchMutation = useMutation<SearchLegacyRecordsOutput, Error, void>({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('Oystehr client not available');
      return searchLegacyRecords(oystehrZambda, {
        lastName,
        firstName: firstName || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });
    },
  });

  // Auto-fire search if lastName param is present on mount
  useEffect(() => {
    if (searchParams.get('lastName')) {
      searchMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (): void => {
    if (!lastName.trim()) {
      setLastNameError('Last name is required');
      return;
    }
    setLastNameError('');
    searchMutation.mutate();
  };

  const fileTypeLabel = (fileType: LegacyPatientRecord['files'][number]['fileType']): string => {
    if (fileType === 'medical-summary') return 'Medical Summary';
    if (fileType === 'progress-note') return 'Progress Note';
    return 'Other';
  };

  const fileTypeColor = (
    fileType: LegacyPatientRecord['files'][number]['fileType']
  ): 'primary' | 'secondary' | 'default' => {
    if (fileType === 'medical-summary') return 'primary';
    if (fileType === 'progress-note') return 'secondary';
    return 'default';
  };

  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Legacy Data
        </Typography>

        {/* Search form */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Search legacy patient records
          </Typography>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={4}>
              <TextField
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                required
                fullWidth
                error={!!lastNameError}
                helperText={lastNameError || ' '}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                fullWidth
                size="small"
                helperText=" "
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Date of Birth"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                fullWidth
                size="small"
                placeholder="MM-DD-YYYY"
                helperText="Format: MM-DD-YYYY"
              />
            </Grid>
            <Grid item xs={12} sm={1}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={searchMutation.isPending}
                sx={{ mt: 0.25 }}
                fullWidth
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Loading state */}
        {searchMutation.isPending && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state */}
        {searchMutation.isError && (
          <Typography color="error" sx={{ mb: 2 }}>
            Error searching legacy records: {searchMutation.error?.message ?? 'Unknown error'}
          </Typography>
        )}

        {/* Results */}
        {searchMutation.isSuccess && (
          <>
            {searchMutation.data.results.length === 0 ? (
              <Typography color="text.secondary">No legacy records found.</Typography>
            ) : (
              <>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Found {searchMutation.data.results.length} patient record
                  {searchMutation.data.results.length !== 1 ? 's' : ''}
                </Typography>
                {searchMutation.data.results.map((record) => (
                  <Paper key={record.patientFolder} sx={{ p: 3, mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {record.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Patient ID: {record.patientId}
                    </Typography>
                    <Grid container spacing={1}>
                      {record.files.map((file) => (
                        <Grid item key={file.key} xs={12} sm={6} md={4}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              p: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                            }}
                          >
                            <Chip
                              label={fileTypeLabel(file.fileType)}
                              color={fileTypeColor(file.fileType)}
                              size="small"
                              sx={{ flexShrink: 0 }}
                            />
                            <Link
                              href={file.presignedUrl}
                              target="_blank"
                              rel="noreferrer"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.875rem',
                              }}
                            >
                              {file.fileName}
                            </Link>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                ))}
              </>
            )}
          </>
        )}
      </Box>
    </PageContainer>
  );
}
