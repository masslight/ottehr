import { Box, Button, useTheme } from '@mui/material';
import { palette } from '@theme/colors';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';

interface CardComponentProps {
  name: string;
  previewUrl: string;
  alt: string;
  setPreviewUrl: (previewUrl: string | null) => void;
  setFileUrl: (fileUrl: string | undefined) => void;
  onClear: () => void;
}

const CardComponent: FC<CardComponentProps> = ({
  name,
  previewUrl,
  alt,
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
        <img src={previewUrl} alt={alt} width="100%" height="260" style={{ objectFit: 'contain' }} />
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
          color: palette.destructive.main,
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

export default CardComponent;
