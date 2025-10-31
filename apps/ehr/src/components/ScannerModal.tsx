import CloseIcon from '@mui/icons-material/Close';
import ScannerIcon from '@mui/icons-material/Scanner';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useDynamsoftScanner } from '../hooks/useDynamsoftScanner';

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanComplete?: (images: Blob[]) => void;
}

const SCANNER_CONTAINER_ID = 'dynamsoft-scanner-container';

export const ScannerModal: FC<ScannerModalProps> = ({ open, onClose, onScanComplete }) => {
  const {
    isInitialized,
    isScanning,
    scanners,
    currentScanner,
    imageCount,
    error,
    initializeScanner,
    setCurrentScanner,
    acquireImage,
    getImageAsBlob,
    removeAllImages,
    cleanup,
  } = useDynamsoftScanner(SCANNER_CONTAINER_ID);

  // Scanner settings state
  const [resolution, setResolution] = useState(200);
  const [pixelType, setPixelType] = useState(2); // 0: B&W, 1: Gray, 2: Color
  const [showUI, setShowUI] = useState(false);
  const [useADF, setUseADF] = useState(false);
  const [useDuplex, setUseDuplex] = useState(false);

  // Initialize scanner when modal opens
  useEffect(() => {
    if (open && !isInitialized) {
      void initializeScanner();
    }
  }, [open, isInitialized, initializeScanner]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!open) {
      removeAllImages();
    }
  }, [open, removeAllImages]);

  const handleScan = async (): Promise<void> => {
    await acquireImage({
      resolution,
      pixelType,
      showUI,
      useADF,
      useDuplex,
    });
  };

  const handleSaveAndClose = async (): Promise<void> => {
    if (imageCount === 0) {
      onClose();
      return;
    }

    try {
      const images: Blob[] = [];
      for (let i = 0; i < imageCount; i++) {
        const blob = await getImageAsBlob(i);
        if (blob) {
          images.push(blob);
        }
      }

      if (onScanComplete) {
        onScanComplete(images);
      }

      cleanup();
      onClose();
    } catch (err) {
      console.error('Error saving scanned images:', err);
    }
  };

  const handleCancel = (): void => {
    removeAllImages();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScannerIcon />
            <Typography variant="h6">Scan Document</Typography>
          </Box>
          <IconButton onClick={handleCancel} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {error && (
            <Alert severity="error" onClose={() => {}}>
              {error}
            </Alert>
          )}

          {!isInitialized ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Scanner Settings */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Scanner</InputLabel>
                  <Select
                    value={currentScanner || ''}
                    onChange={(e) => setCurrentScanner(e.target.value)}
                    label="Scanner"
                    disabled={isScanning}
                  >
                    {scanners.length === 0 ? (
                      <MenuItem value="">No scanners found</MenuItem>
                    ) : (
                      scanners.map((scanner) => (
                        <MenuItem key={scanner.displayName} value={scanner.displayName}>
                          {scanner.displayName}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>

                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Color Mode</InputLabel>
                  <Select
                    value={pixelType}
                    onChange={(e) => setPixelType(Number(e.target.value))}
                    label="Color Mode"
                    disabled={isScanning}
                  >
                    <MenuItem value={0}>Black & White</MenuItem>
                    <MenuItem value={1}>Grayscale</MenuItem>
                    <MenuItem value={2}>Color</MenuItem>
                  </Select>
                </FormControl>

                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Resolution</InputLabel>
                  <Select
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                    label="Resolution"
                    disabled={isScanning}
                  >
                    <MenuItem value={100}>100 DPI</MenuItem>
                    <MenuItem value={200}>200 DPI</MenuItem>
                    <MenuItem value={300}>300 DPI</MenuItem>
                    <MenuItem value={600}>600 DPI</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Scanner Options */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Checkbox checked={showUI} onChange={(e) => setShowUI(e.target.checked)} disabled={isScanning} />
                  }
                  label="Show Scanner UI"
                />
                <FormControlLabel
                  control={
                    <Checkbox checked={useADF} onChange={(e) => setUseADF(e.target.checked)} disabled={isScanning} />
                  }
                  label="Use Document Feeder"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useDuplex}
                      onChange={(e) => setUseDuplex(e.target.checked)}
                      disabled={isScanning}
                    />
                  }
                  label="Duplex (Both Sides)"
                />
              </Box>

              {/* Scan Button */}
              <Box>
                <Button
                  variant="contained"
                  onClick={handleScan}
                  disabled={!currentScanner || isScanning || scanners.length === 0}
                  startIcon={isScanning ? <CircularProgress size={20} /> : <ScannerIcon />}
                  fullWidth
                  sx={{ maxWidth: 200 }}
                >
                  {isScanning ? 'Scanning...' : 'Scan'}
                </Button>
              </Box>

              {/* Image Viewer Container */}
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  minHeight: 400,
                  position: 'relative',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <div id={SCANNER_CONTAINER_ID} style={{ width: '100%', height: '400px' }} />
                {imageCount > 0 && (
                  <Typography
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: 1,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {imageCount} {imageCount === 1 ? 'image' : 'images'}
                  </Typography>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button onClick={handleCancel} variant="outlined">
                  Cancel
                </Button>
                <Button onClick={handleSaveAndClose} variant="contained" disabled={imageCount === 0 || isScanning}>
                  Save {imageCount > 0 && `(${imageCount})`}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
