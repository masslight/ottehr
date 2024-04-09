import { Box, Dialog, DialogContent, DialogTitle, IconButton, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CircleIcon from '@mui/icons-material/Circle';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import React from 'react';

interface ImageCarouselProps {
  images: string[]; // list of pre-signed URLs
  imageAlts: string[]; // list of alt tags for images
  imageIndex: number; // index of the starting image
  setImageIndex: React.Dispatch<React.SetStateAction<number>>; // used to switch between images using the arrows
  open: boolean; // if true the dialog is open
  setOpen: React.Dispatch<React.SetStateAction<boolean>>; // used to control the dialog
}

export default function ImageCarousel({
  images,
  imageAlts,
  imageIndex,
  setImageIndex,
  open,
  setOpen,
}: ImageCarouselProps): React.ReactElement {
  // handle functions
  const theme = useTheme();
  const handleLeftArrowClick = (): void => {
    if (imageIndex === 0) {
      return;
    }
    setImageIndex(imageIndex - 1);
  };

  const handleRightArrowClick = (): void => {
    if (imageIndex === images.length - 1) {
      return;
    }
    setImageIndex(imageIndex + 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const key: string = event.key;
    if (key === 'ArrowLeft') {
      handleLeftArrowClick();
    } else if (key === 'ArrowRight') {
      handleRightArrowClick();
    }
  };

  // html
  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      PaperProps={{
        style: {
          backgroundColor: 'transparent',
          boxShadow: 'none',
          maxWidth: '900px',
        },
      }}
      onKeyDown={handleKeyDown}
    >
      <DialogTitle marginBottom={4}>
        <IconButton
          onClick={() => {
            setOpen(false);
          }}
          sx={{
            position: 'absolute',
            right: 0,
          }}
        >
          <CloseIcon style={{ color: theme.palette.background.paper }} />
        </IconButton>
      </DialogTitle>

      <Box
        sx={{
          width: 900,
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
        <img src={images[imageIndex]} alt={imageAlts[imageIndex]} />
      </Box>

      <DialogContent style={{ overflow: 'hidden' }}>
        <Box alignItems="center" display="flex" justifyContent="center">
          <IconButton onClick={handleLeftArrowClick}>
            <ArrowBackIosIcon sx={{ color: imageIndex === 0 ? 'transparent' : 'white' }} />
          </IconButton>

          {images.map((image, index) => (
            <CircleIcon key={image} sx={{ fontSize: index === imageIndex ? 10 : 6, color: 'white', marginRight: 1 }} />
          ))}

          <IconButton onClick={handleRightArrowClick}>
            <ArrowForwardIosIcon style={{ color: imageIndex === images.length - 1 ? 'transparent' : 'white' }} />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
