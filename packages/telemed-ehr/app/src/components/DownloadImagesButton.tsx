import { Button } from '@mui/material';
import { ReactElement } from 'react';
import { CardInfo } from '../types/types';

interface DownloadImagesButtonProps {
  appointmentId: string;
  cards: CardInfo[];
  title: string;
}

function parseFiletype(fileUrl: string): string {
  const filetype = fileUrl.match(/\w+$/)?.[0];
  if (filetype) {
    return filetype;
  } else {
    throw new Error('Failed to parse filetype from url');
  }
}

const DownloadImagesButton = ({ appointmentId, cards, title }: DownloadImagesButtonProps): ReactElement => {
  const handleDownload = async (): Promise<void> => {
    try {
      for (const card of cards) {
        if (card.presignedUrl) {
          const fileType = parseFiletype(card.z3Url);

          fetch(card.presignedUrl, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } })
            .then((response) => {
              if (!response.ok) {
                throw new Error('failed to fetch image from presigned url');
              }
              return response.blob();
            })
            .then((blob) => {
              const url = window.URL.createObjectURL(new Blob([blob]));
              const link = document.createElement('a');
              link.href = url;
              link.download = `${appointmentId}-${card.type}.${fileType}`;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            })
            .catch((error) => {
              throw new Error(error);
            });
        }
      }
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <Button
      variant="outlined"
      sx={{
        borderRadius: '100px',
        fontWeight: 700,
        textTransform: 'none',
      }}
      size="medium"
      onClick={handleDownload}
    >
      {title}
    </Button>
  );
};

export default DownloadImagesButton;
