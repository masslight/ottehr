import { Box, Button, useTheme } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';

interface CardComponentProps {
  name: string;
  objectName: string;
  onClear: () => void;
  previewUrl: string;
  setFileUrl: (fileUrl: string | undefined) => void;
  setPreviewUrl: (previewUrl: string | null) => void;
}

export const CardComponent: FC<CardComponentProps> = ({
  name,
  objectName,
  onClear,
  previewUrl,
  setFileUrl,
  setPreviewUrl,
}): JSX.Element => {
  const theme = useTheme();
  const { setValue } = useFormContext();

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          border: `1px dashed ${theme.palette.primary.main}`,
          borderRadius: 2,
          height: 260,
        }}
      >
        <img alt={objectName} height="260" src={previewUrl} style={{ objectFit: 'contain' }} width="100%" />
      </Box>
      <Button
        onClick={() => {
          setFileUrl(undefined);
          setPreviewUrl(null);
          setValue(name, '');
          onClear();
        }}
        sx={{
          '&:hover': { backgroundColor: otherColors.transparent },
          color: otherColors.clearImage,
          justifyContent: 'start',
          mt: 2,
          px: 0,
        }}
        variant="text"
      >
        Clear
      </Button>
    </Box>
  );
};
