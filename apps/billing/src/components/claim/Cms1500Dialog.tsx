import {
  Close as CloseIcon,
  FileDownloadOutlined as FileDownloadIcon,
  PrintOutlined as PrintIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { Cms1500FormData } from 'utils/lib/types/data/billing/cms1500.types';
import { getBillingClaimCms1500 } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';

type PrintMode = 'form' | 'data-only';

// How far to shift the data on pre-printed forms, in inches. It depends on the printer, so it's
// remembered per browser.
interface PrintOffset {
  right: number;
  down: number;
}

const OFFSET_STORAGE_KEY = 'billing.cms1500.dataOnlyOffset';
const MAX_OFFSET_INCHES = 1;

function loadOffset(): PrintOffset {
  try {
    const saved = JSON.parse(localStorage.getItem(OFFSET_STORAGE_KEY) ?? 'null');
    if (typeof saved?.right === 'number' && typeof saved?.down === 'number') return saved;
  } catch {
    // unavailable or unreadable storage: start from no offset
  }
  return { right: 0, down: 0 };
}

function saveOffset(offset: PrintOffset): void {
  try {
    localStorage.setItem(OFFSET_STORAGE_KEY, JSON.stringify(offset));
  } catch {
    // the offset just won't be remembered
  }
}

const clampOffset = (value: number): number =>
  Number.isFinite(value) ? Math.max(-MAX_OFFSET_INCHES, Math.min(MAX_OFFSET_INCHES, value)) : 0;

interface OffsetFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

// Keeps the text as typed, so a shift can be typed starting with "-", and tidies it up on blur.
function OffsetField({ label, value, onChange }: OffsetFieldProps): ReactElement {
  const [text, setText] = useState(String(value));
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(clampOffset(Number(event.target.value)));
      }}
      onBlur={() => setText(String(value))}
      inputProps={{ step: 0.05, min: -MAX_OFFSET_INCHES, max: MAX_OFFSET_INCHES }}
    />
  );
}

// Loaded on first use so pdf-lib stays out of the main bundle.
let renderer: Promise<typeof import('utils/lib/helpers/rcm/cms1500/render')> | undefined;
const loadRenderer = (): NonNullable<typeof renderer> => (renderer ??= import('utils/lib/helpers/rcm/cms1500/render'));

interface Cms1500DialogProps {
  open: boolean;
  onClose: () => void;
  claimId: string;
}

export function Cms1500Dialog({ open, onClose, claimId }: Cms1500DialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [form, setForm] = useState<Cms1500FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PrintMode>('form');
  const [offset, setOffset] = useState<PrintOffset>(loadOffset);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setForm(null);
    setError(null);
    if (!open || !oystehrZambda) return undefined;

    let cancelled = false;
    getBillingClaimCms1500(oystehrZambda, { claimId })
      .then((data) => {
        if (!cancelled) setForm(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(getApiError({ error: err, defaultError: 'Failed to load the claim for the CMS-1500' }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, oystehrZambda, claimId]);

  // The previous preview stays up while the next one renders, so nudging the offset doesn't flicker.
  useEffect(() => {
    if (!form) {
      setPdfUrl(null);
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { renderCms1500Pdf } = await loadRenderer();
        if (cancelled) return;
        const bytes = await renderCms1500Pdf(
          [form],
          mode === 'form' ? {} : { includeForm: false, offset: { x: offset.right * 72, y: offset.down * 72 } }
        );
        if (cancelled) return;
        setPdfUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })));
      } catch (err) {
        if (!cancelled) setError(getApiError({ error: err, defaultError: 'Failed to create the CMS-1500' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form, mode, offset]);

  // Each preview is released once it's replaced or the dialog closes.
  useEffect(() => {
    if (!pdfUrl) return undefined;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const updateOffset = (key: keyof PrintOffset, value: number): void => {
    const next = { ...offset, [key]: value };
    setOffset(next);
    saveOffset(next);
  };

  const handlePrint = (): void => {
    const preview = previewRef.current?.contentWindow;
    preview?.focus();
    preview?.print();
  };

  const fileName = `claim-${claimId}-cms1500${mode === 'data-only' ? '-data-only' : ''}.pdf`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 900, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        CMS-1500
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, value: PrintMode | null) => value && setMode(value)}
            aria-label="What to print"
          >
            <ToggleButton value="form">Form with claim data</ToggleButton>
            <ToggleButton value="data-only">Data only, for pre-printed forms</ToggleButton>
          </ToggleButtonGroup>
          {mode === 'data-only' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Load red CMS-1500 (02/12) forms in the printer and print at actual size (100%, no scaling or fit to
                page). If the text doesn&apos;t line up with the boxes, shift it below; the shift is saved in this
                browser.
              </Typography>
              <Stack direction="row" spacing={2}>
                <OffsetField
                  label="Shift right (inches)"
                  value={offset.right}
                  onChange={(value) => updateOffset('right', value)}
                />
                <OffsetField
                  label="Shift down (inches)"
                  value={offset.down}
                  onChange={(value) => updateOffset('down', value)}
                />
              </Stack>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {!error && !pdfUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}
          {pdfUrl && (
            <iframe
              ref={previewRef}
              src={pdfUrl}
              title="CMS-1500 preview"
              style={{ width: '100%', height: '65vh', border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: 4 }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Close
        </Button>
        <Button
          startIcon={<FileDownloadIcon />}
          disabled={!pdfUrl}
          component="a"
          href={pdfUrl ?? undefined}
          download={fileName}
        >
          Download
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!pdfUrl}>
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
