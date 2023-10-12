import { Box, Button, useTheme } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';

interface CardComponentProps {
  name: string;
  previewUrl: string;
  objectName: string;
  setPreviewUrl: (previewUrl: string | null) => void;
  setFileUrl: (fileUrl: string | undefined) => void;
  onClear: () => void;
}

export const CardComponent: FC<CardComponentProps> = ({
  name,
  previewUrl,
  objectName,
  setPreviewUrl,
  setFileUrl,
  onClear,
}): JSX.Element => {
  const theme = useTheme();
  const { setValue } = useFormContext();

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          height: 260,
          border: `1px dashed ${theme.palette.primary.main}`,
          borderRadius: 2,
        }}
      >
        <img src={previewUrl} alt={objectName} width="100%" height="260" style={{ objectFit: 'contain' }} />
      </Box>
      <Button
        variant="text"
        onClick={() => {
          setValue(name, '');
          setPreviewUrl(null);
          setFileUrl(undefined);
          onClear();
        }}
        sx={{
          color: otherColors.clearImage,
          justifyContent: 'start',
          px: 0,
          mt: 2,
          '&:hover': { backgroundColor: 'transparent' },
        }}
      >
        Clear
      </Button>
    </Box>
  );
};
