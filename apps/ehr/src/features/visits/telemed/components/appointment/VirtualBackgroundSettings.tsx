import BlurOnIcon from '@mui/icons-material/BlurOn';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import { FC, useRef } from 'react';
import { useVideoCallStore, VirtualBackgroundSetting } from '../../state/video-call/video-call.store';

interface VirtualBackgroundSettingsProps {
  isBlurSupported: boolean | undefined;
  isReplacementSupported: boolean | undefined;
}

export const VirtualBackgroundSettings: FC<VirtualBackgroundSettingsProps> = ({
  isBlurSupported,
  isReplacementSupported,
}) => {
  const virtualBackground = useVideoCallStore((s) => s.virtualBackground);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setBackground = (setting: VirtualBackgroundSetting): void => {
    useVideoCallStore.setState({ virtualBackground: setting });
  };

  const handleImageButtonClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setBackground({ mode: 'image', imageBlob: file });
    }
    event.target.value = '';
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Virtual Background
      </Typography>
      <ButtonGroup variant="outlined" size="small">
        <Button
          onClick={() => setBackground({ mode: 'none' })}
          variant={virtualBackground.mode === 'none' ? 'contained' : 'outlined'}
          startIcon={<DoNotDisturbIcon />}
        >
          None
        </Button>
        <Button
          onClick={() => setBackground({ mode: 'blur' })}
          disabled={isBlurSupported === false}
          variant={virtualBackground.mode === 'blur' ? 'contained' : 'outlined'}
          startIcon={<BlurOnIcon />}
        >
          Blur
        </Button>
        <Button
          onClick={handleImageButtonClick}
          disabled={isReplacementSupported === false}
          variant={virtualBackground.mode === 'image' ? 'contained' : 'outlined'}
          startIcon={<WallpaperIcon />}
        >
          {virtualBackground.mode === 'image' ? 'Change Image' : 'Custom Image'}
        </Button>
      </ButtonGroup>
      {virtualBackground.mode === 'image' && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
          Image selected. Click &quot;Save Changes&quot; to apply.
        </Typography>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </Box>
  );
};
