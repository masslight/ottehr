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
  const [firstNameError, setFirstNameError] = useState('');

  const [page, setPage] = useState(1);

  const searchMutation = useMutation<SearchLegacyRecordsOutput, Error, number>({
    mutationFn: async (requestedPage: number) => {
      if (!oystehrZambda) throw new Error('Oystehr client not available');
      return searchLegacyRecords(oystehrZambda, {
        lastName,
        firstName: firstName || undefined,
        dateOfBirth: dateOfBirth || undefined,
        page: requestedPage,
      });
    },
  });

  // Auto-fire search if lastName param is present on mount
  useEffect(() => {
    if (searchParams.get('lastName')) {
      searchMutation.mutate(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (): void => {
    let hasError = false;
    if (!lastName.trim()) {
      setLastNameError('Last name is required');
      hasError = true;
    } else {
      setLastNameError('');
    }
    if (dateOfBirth.trim() && !firstName.trim()) {
      setFirstNameError('First name is required when date of birth is provided');
      hasError = true;
    } else {
      setFirstNameError('');
    }
    if (hasError) return;
    setPage(1);
    searchMutation.mutate(1);
  };

  const fileTypeLabel = (fileType: LegacyPatientRecord['files'][number]['fileType']): string => {
    if (fileType === 'medical-summary') return 'Medical Summary';
    if (fileType === 'progress-note') return 'Progress Note';
    return 'Other';
  };

  const fileTypeColor = (fileType: LegacyPatientRecord['files'][number]['fileType']): { bg: string; text: string } => {
    if (fileType === 'medical-summary') return { bg: '#B2EBF2', text: '#006064' };
    if (fileType === 'progress-note') return { bg: '#C8E6C9', text: '#1B5E20' };
    return { bg: '#E6E8EE', text: '#616161' };
  };

  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
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
                error={!!firstNameError}
                helperText={firstNameError || ' '}
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
                sx={{ mt: 0.25, borderRadius: '20px', textTransform: 'none' }}
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1">
                    {searchMutation.data.total} patient record{searchMutation.data.total !== 1 ? 's' : ''} found
                    {searchMutation.data.total > searchMutation.data.pageSize &&
                      ` — page ${searchMutation.data.page} of ${Math.ceil(
                        searchMutation.data.total / searchMutation.data.pageSize
                      )}`}
                  </Typography>
                  {searchMutation.data.total > searchMutation.data.pageSize && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={page <= 1 || searchMutation.isPending}
                        onClick={() => {
                          const prev = page - 1;
                          setPage(prev);
                          searchMutation.mutate(prev);
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={
                          page >= Math.ceil(searchMutation.data.total / searchMutation.data.pageSize) ||
                          searchMutation.isPending
                        }
                        onClick={() => {
                          const next = page + 1;
                          setPage(next);
                          searchMutation.mutate(next);
                        }}
                      >
                        Next
                      </Button>
                    </Box>
                  )}
                </Box>
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
                              size="small"
                              sx={{
                                flexShrink: 0,
                                backgroundColor: fileTypeColor(file.fileType).bg,
                                color: fileTypeColor(file.fileType).text,
                                fontWeight: 500,
                                borderRadius: '4px',
                                border: 'none',
                              }}
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
