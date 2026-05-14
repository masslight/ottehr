import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LegacyPatientRecord, searchLegacyRecords, SearchLegacyRecordsOutput } from 'src/api/api';
import * as UTIF from 'utif';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

interface TiffPage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function TiffPageCanvas({ width, height, rgba }: TiffPage): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size the canvas to match the image so pixels map 1-to-1.
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Wrap the raw RGBA bytes in an ImageData object and paint it onto the canvas.
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
  }, [width, height, rgba]);

  // Canvas is required because utif decodes TIFFs into raw RGBA pixel data (a Uint8Array),
  // and <canvas> is the only DOM element that accepts raw pixel data via ctx.putImageData().
  // Chrome has no native TIFF support
  return <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }} />;
}

function TiffViewer({ url }: { url: string }): ReactElement {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [pages, setPages] = useState<TiffPage[]>([]);

  useEffect(() => {
    setState('loading');
    setErrorMsg('');
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        // Parse the TIFF binary into an array of Image File Directories (IFDs).
        // Each IFD is one page/image in the file plus its metadata tags (dimensions, color depth, etc.).
        const IFDs = UTIF.decode(buffer);
        if (IFDs.length === 0) throw new Error('No images found in TIFF');

        // Decompress each page's pixel data and convert to RGBA8.
        // UTIF.decodeImage populates ifd.width, .height, and .data in-place.
        // UTIF.toRGBA8 normalizes whatever color format the TIFF uses (grayscale, CMYK, etc.)
        // into a flat [r, g, b, a, r, g, b, a, ...] Uint8Array ready for canvas.
        const decoded = IFDs.map((ifd) => {
          UTIF.decodeImage(buffer, ifd);
          return { width: ifd.width, height: ifd.height, rgba: UTIF.toRGBA8(ifd) };
        });

        setPages(decoded);
        setState('ready');
      })
      .catch((err: Error) => {
        setErrorMsg(err.message ?? 'Failed to load TIFF');
        setState('error');
      });
  }, [url]);

  return (
    <>
      {state === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {state === 'error' && <Typography color="error">{errorMsg}</Typography>}
      {state === 'ready' &&
        pages.map((page, i) => (
          <Box key={i} sx={i > 0 ? { mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 } : undefined}>
            {pages.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Page {i + 1} of {pages.length}
              </Typography>
            )}
            <TiffPageCanvas {...page} />
          </Box>
        ))}
    </>
  );
}

export default function LegacyDataPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [searchParams] = useSearchParams();

  const [lastName, setLastName] = useState(searchParams.get('lastName') ?? '');
  const [firstName, setFirstName] = useState(searchParams.get('firstName') ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(searchParams.get('dob') ?? '');
  const [lastNameError, setLastNameError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');

  const [page, setPage] = useState(1);
  const [activeTiff, setActiveTiff] = useState<{ url: string; fileName: string } | null>(null);

  const isTiff = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.tif') || lower.endsWith('.tiff');
  };

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
                            {isTiff(file.fileName) ? (
                              <Link
                                component="button"
                                onClick={() => setActiveTiff({ url: file.presignedUrl, fileName: file.fileName })}
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: '0.875rem',
                                }}
                              >
                                {file.fileName}
                              </Link>
                            ) : (
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
                            )}
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

        {/* TIFF viewer modal */}
        <Dialog open={!!activeTiff} onClose={() => setActiveTiff(null)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ pr: 6 }}>
            {activeTiff?.fileName}
            <IconButton
              onClick={() => setActiveTiff(null)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>{activeTiff && <TiffViewer url={activeTiff.url} />}</DialogContent>
        </Dialog>
      </Box>
    </PageContainer>
  );
}
