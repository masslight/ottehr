import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { ChangeEvent, DragEvent, FC, useRef, useState } from 'react';

interface ReturnFormDropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * A target for putting a completed form back on the chart.
 *
 * Deliberately a drop zone rather than another button, and given its own block rather than a slot in a row
 * of controls. The other actions on a form *do* something to it; this one *receives* something, and a
 * region you can drop onto reads that way at a glance where a fourth button would not.
 *
 * Clicking works too — dragging is a convenience, not a requirement, and a file dialog is what most people
 * will reach for.
 */
export const ReturnFormDropZone: FC<ReturnFormDropZoneProps> = ({ onFile, disabled, busy }) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const accept = (file: File | undefined): void => {
    if (file && !disabled && !busy) onFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsOver(false);
    // Only the first file: a completed form is one document, and silently taking the rest would file
    // documents nobody asked to file.
    accept(event.dataTransfer.files?.[0]);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Cleared straight away so choosing the same file twice still raises a change event.
    event.target.value = '';
    accept(file);
  };

  const interactive = !disabled && !busy;

  return (
    <Box
      onClick={() => interactive && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (interactive) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        px: 2,
        py: 2.5,
        width: '100%',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? theme.palette.primary.main : theme.palette.divider,
        backgroundColor: isOver ? theme.palette.action.hover : 'transparent',
        color: interactive ? theme.palette.primary.main : theme.palette.text.disabled,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 120ms, background-color 120ms',
      }}
    >
      {busy ? <CircularProgress size={20} /> : <FileUploadOutlinedIcon />}
      <Typography variant="body2" fontWeight={500}>
        {busy ? 'Uploading…' : 'Drop the completed form here, or click to browse'}
      </Typography>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={handleChange} />
    </Box>
  );
};
