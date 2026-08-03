import BlurOffIcon from '@mui/icons-material/BlurOff';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import HideImageIcon from '@mui/icons-material/HideImage';
import { Box, Button } from '@mui/material';
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
    if (virtualBackground.mode === 'image') {
      setBackground({ mode: 'none' });
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBlurButtonClick = (): void => {
    setBackground(virtualBackground.mode === 'blur' ? { mode: 'none' } : { mode: 'blur' });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setBackground({ mode: 'image', imageBlob: file });
    }
    event.target.value = '';
  };

  const imageActive = virtualBackground.mode === 'image';
  const blurActive = virtualBackground.mode === 'blur';

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          disabled={isReplacementSupported === false}
          onClick={handleImageButtonClick}
          startIcon={imageActive ? <HideImageIcon /> : <CoPresentIcon />}
          sx={{ borderRadius: '20px', paddingY: 1, paddingX: 2 }}
        >
          {imageActive ? 'Clear background image' : 'Add background'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={isBlurSupported === false}
          onClick={handleBlurButtonClick}
          startIcon={blurActive ? <BlurOffIcon /> : <BlurOnIcon />}
          sx={{ borderRadius: '20px', paddingY: 1, paddingX: 2 }}
        >
          {blurActive ? 'Turn OFF blur' : 'Turn ON blur'}
        </Button>
      </Box>
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
