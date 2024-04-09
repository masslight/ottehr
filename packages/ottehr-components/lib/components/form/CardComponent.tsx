import { FC, useContext } from 'react';
import { Box, Button, useTheme } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { IntakeThemeContext } from '../../contexts';

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
  const { otherColors } = useContext(IntakeThemeContext);

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

export default CardComponent;
