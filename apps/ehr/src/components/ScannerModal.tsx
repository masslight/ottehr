import CloseIcon from '@mui/icons-material/Close';
import CropIcon from '@mui/icons-material/Crop';
import DeleteIcon from '@mui/icons-material/Delete';
import FlipIcon from '@mui/icons-material/Flip';
import RefreshIcon from '@mui/icons-material/Refresh';
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import ScannerIcon from '@mui/icons-material/Scanner';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { LoadingButton } from '@mui/lab';
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useEffect, useState } from 'react';
import { useDynamsoftScanner } from '../hooks/useDynamsoftScanner';

export type ScannerOutputFormat = 'pdf' | 'png';

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
  outputFormat?: ScannerOutputFormat; // 'pdf' for single PDF, 'png' for multiple PNGs
  onScanComplete?: (fileBlob: Blob | Blob[], fileName: string) => void;
}

const SCANNER_CONTAINER_ID = 'dynamsoft-scanner-container';

export const ScannerModal: FC<ScannerModalProps> = ({ open, onClose, outputFormat = 'pdf', onScanComplete }) => {
  const {
    isInitialized,
    isScanning,
    isRefreshingScanners,
    scanners,
    currentScanner,
    imageCount,
    selectedZone,
    error,
    initializeScanner,
    setCurrentScanner,
    refreshScanners,
    acquireImage,
    getAllImagesAsPdf,
    getAllImagesAsPng,
    removeCurrentImage,
    removeAllImages,
    rotateLeft,
    rotateRight,
    rotate180,
    flipVertical,
    mirror,
    crop,
    cleanup,
  } = useDynamsoftScanner(SCANNER_CONTAINER_ID);

  // Scanner settings state
  const [resolution, setResolution] = useState(200);
  const [pixelType, setPixelType] = useState(2); // 0: B&W, 1: Gray, 2: Color
  const [showUI, setShowUI] = useState(false);
  const [useADF, setUseADF] = useState(false);
  const [useDuplex, setUseDuplex] = useState(false);

  // File name state - initialize with timestamp-based default name
  const [fileName, setFileName] = useState(() => {
    const timestamp = new Date().getTime();
    return `scanned-document-${timestamp}`;
  });

  // Loading state for save operation
  const [isSaving, setIsSaving] = useState(false);

  // Initialize scanner when modal opens
  useEffect(() => {
    if (open && !isInitialized) {
      // Delay initialization to ensure DOM is ready and dialog animation completes
      const timer = setTimeout(() => {
        void initializeScanner();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, isInitialized, initializeScanner]);

  // Reset fileName and cleanup when modal opens/closes
  useEffect(() => {
    if (open) {
      // Reset fileName with new timestamp when modal opens
      const timestamp = DateTime.now().toFormat('yyyyLLdd-HHmmss');
      setFileName(`scan-${timestamp}`);
      // Reset saving state to ensure button doesn't show spinner from previous save
      setIsSaving(false);
    } else {
      // Cleanup and destroy Dynamsoft object when modal closes
      cleanup();
    }
  }, [open, cleanup]);

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

    // Validate fileName
    if (!fileName.trim()) {
      console.error('File name is required');
      return;
    }

    try {
      setIsSaving(true);

      if (outputFormat === 'pdf') {
        // Get all images as a single PDF
        const pdfBlob = await getAllImagesAsPdf();

        if (!pdfBlob) {
          console.error('Failed to create PDF from scanned images');
          setIsSaving(false);
          return;
        }

        if (onScanComplete) {
          // Pass the single combined PDF blob and fileName
          onScanComplete(pdfBlob, fileName.trim());
        }
      } else {
        // Get all images as PNG files
        const pngBlobs = await getAllImagesAsPng();

        if (pngBlobs.length === 0) {
          console.error('Failed to create PNG files from scanned images');
          setIsSaving(false);
          return;
        }

        if (onScanComplete) {
          // Pass all PNG blobs and fileName
          onScanComplete(pngBlobs, fileName.trim());
        }
      }

      cleanup();
      onClose();
    } catch (err) {
      console.error('Error saving scanned images:', err);
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    // If there are scanned images, confirm before closing
    if (imageCount > 0) {
      const confirmed = window.confirm(
        `You have ${imageCount} scanned ${
          imageCount === 1 ? 'image' : 'images'
        }. Are you sure you want to close without saving?`
      );
      if (!confirmed) {
        return;
      }
    }
    removeAllImages();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="lg" fullWidth>
      <DialogTitle variant="h5" color="primary.dark">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScannerIcon />
            Scan Document
          </Box>
          <IconButton onClick={handleCancel} size="small" edge="end">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {error && (
            <Alert severity="error" onClose={() => {}}>
              {error}
            </Alert>
          )}

          {/* Main Content: Settings and Viewer Side by Side - Always render viewer container for Dynamsoft */}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              flexDirection: { xs: 'column', md: 'row' },
            }}
          >
            {/* Left Column: Scanner Settings and Controls */}
            <Box sx={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Scanner Selection */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Scanner Settings
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <FormControl fullWidth>
                      <InputLabel>Scanner</InputLabel>
                      <Select
                        value={currentScanner || ''}
                        onChange={(e) => setCurrentScanner(e.target.value)}
                        label="Scanner"
                        disabled={isScanning}
                        endAdornment={
                          isRefreshingScanners ? (
                            <CircularProgress
                              size={20}
                              sx={{ position: 'absolute', right: 32, pointerEvents: 'none' }}
                            />
                          ) : null
                        }
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
                    <Tooltip title="Refresh scanner list">
                      <IconButton
                        onClick={() => void refreshScanners()}
                        disabled={isScanning || isRefreshingScanners}
                        size="large"
                        sx={{ mb: 0.5 }}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <FormControl fullWidth>
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

                  <FormControl fullWidth>
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
                </Stack>
              </Box>

              {/* Scanner Options */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Options
                </Typography>
                <Stack spacing={1}>
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
                </Stack>
              </Box>

              {/* File Name */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  File Name
                </Typography>
                <TextField
                  fullWidth
                  value={fileName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileName(e.target.value)}
                  placeholder="Enter file name"
                  required
                  error={!fileName.trim()}
                  helperText={!fileName.trim() ? 'File name is required' : 'Do not include .pdf extension'}
                  disabled={isScanning}
                />
              </Box>

              {/* Scan Button */}
              <Button
                variant="contained"
                onClick={handleScan}
                disabled={!currentScanner || isScanning || scanners.length === 0}
                startIcon={isScanning ? <CircularProgress size={20} /> : <ScannerIcon />}
                fullWidth
                size="large"
              >
                {isScanning ? 'Scanning...' : 'Scan Document'}
              </Button>
            </Box>

            {/* Right Column: Viewer and Image Controls */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Viewer */}
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  minHeight: 500,
                  position: 'relative',
                  backgroundColor: '#f5f5f5',
                  overflow: 'hidden',
                }}
              >
                <div id={SCANNER_CONTAINER_ID} style={{ width: '100%', height: '500px' }} />
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

              {/* Image Editing Tools */}
              <Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Tooltip title="Rotate Left 90°">
                    <span>
                      <IconButton
                        onClick={rotateLeft}
                        size="small"
                        disabled={imageCount === 0}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <Rotate90DegreesCcwIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Rotate Right 90°">
                    <span>
                      <IconButton
                        onClick={rotateRight}
                        size="small"
                        disabled={imageCount === 0}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <Rotate90DegreesCwIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Rotate 180°">
                    <span>
                      <IconButton
                        onClick={rotate180}
                        size="small"
                        disabled={imageCount === 0}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <Rotate90DegreesCwIcon sx={{ transform: 'rotate(180deg)' }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Flip Vertical">
                    <span>
                      <IconButton
                        onClick={flipVertical}
                        size="small"
                        disabled={imageCount === 0}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <FlipIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Mirror (Flip Horizontal)">
                    <span>
                      <IconButton
                        onClick={mirror}
                        size="small"
                        disabled={imageCount === 0}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <SwapHorizIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      selectedZone
                        ? 'Crop to Selected Area'
                        : 'Select area on image first (click and drag on the image to create a selection rectangle)'
                    }
                  >
                    <span>
                      <IconButton
                        onClick={crop}
                        size="small"
                        disabled={!selectedZone}
                        sx={{ border: '1px solid', borderColor: selectedZone ? 'primary.main' : 'divider' }}
                        color={selectedZone ? 'primary' : 'default'}
                      >
                        <CropIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete Current Image">
                    <span>
                      <IconButton
                        onClick={removeCurrentImage}
                        size="small"
                        disabled={imageCount === 0}
                        color={imageCount > 0 ? 'error' : 'default'}
                        sx={{ border: '1px solid', borderColor: imageCount > 0 ? 'error.main' : 'divider' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={handleCancel} variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none' }}>
              Cancel
            </Button>
            <LoadingButton
              onClick={handleSaveAndClose}
              variant="contained"
              loading={isSaving}
              disabled={imageCount === 0 || isScanning || !fileName.trim()}
              sx={{ borderRadius: '50px', textTransform: 'none' }}
            >
              Save {imageCount > 0 && `(${imageCount})`}
            </LoadingButton>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
