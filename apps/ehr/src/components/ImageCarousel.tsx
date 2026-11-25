import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CircleIcon from '@mui/icons-material/Circle';
import { Box, IconButton } from '@mui/material';
import React, { useEffect } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

export interface ImageCarouselObject {
  alt: string;
  url: string;
}
interface ImageCarouselProps {
  imagesObj: ImageCarouselObject[]; // list of image objects
  imageIndex: number; // index of the starting image
  setImageIndex: React.Dispatch<React.SetStateAction<number>>; // used to switch between imagesObj using the arrows
  open: boolean; // if true the dialog is open
  setOpen: React.Dispatch<React.SetStateAction<boolean>>; // used to control the dialog
}

export default function ImageCarousel({
  imagesObj,
  imageIndex,
  setImageIndex,
  open,
  setOpen,
}: ImageCarouselProps): React.ReactElement {
  const lastIndex = imagesObj.length - 1;

  const handleLeftArrowClick = (): void => {
    if (imageIndex === 0) {
      return;
    }
    setImageIndex(imageIndex - 1);
  };

  const handleRightArrowClick = (): void => {
    if (imageIndex === lastIndex) {
      return;
    }
    setImageIndex(imageIndex + 1);
  };

  // The arrow keys page through the images wherever the focus is while the preview is open.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        setImageIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'ArrowRight') {
        setImageIndex((index) => Math.min(index + 1, lastIndex));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, lastIndex, setImageIndex]);

  return (
    <AppDialog
      variant="form"
      size="m"
      open={open}
      onClose={() => setOpen(false)}
      title="Image Preview"
      disableContentPadding
    >
      <Box
        sx={{
          width: '100%',
          height: 600,
          overflow: 'hidden',
          position: 'relative',
          '& img': {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          },
        }}
      >
        <img src={imagesObj[imageIndex]?.url} alt={imagesObj[imageIndex]?.alt} />
      </Box>

      <Box alignItems="center" display="flex" justifyContent="center" sx={{ p: '20px 24px' }}>
        <IconButton onClick={handleLeftArrowClick}>
          <ArrowBackIosIcon sx={{ color: imageIndex === 0 ? 'transparent' : 'text.secondary' }} />
        </IconButton>

        {imagesObj.map((image, index) => (
          <CircleIcon
            key={image.alt}
            sx={{ fontSize: index === imageIndex ? 10 : 6, color: 'text.secondary', marginRight: 1 }}
          />
        ))}

        <IconButton onClick={handleRightArrowClick}>
          <ArrowForwardIosIcon sx={{ color: imageIndex === lastIndex ? 'transparent' : 'text.secondary' }} />
        </IconButton>
      </Box>
    </AppDialog>
  );
}
