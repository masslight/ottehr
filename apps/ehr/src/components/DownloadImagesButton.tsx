import { Button, Link as MUILink } from '@mui/material';
import { ReactElement } from 'react';
import { DocumentInfo } from 'utils';

interface DownloadImagesButtonProps {
  appointmentId: string;
  cards: DocumentInfo[];
  fullCardPdf?: DocumentInfo | undefined;
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

const DownloadImagesButton = ({
  appointmentId,
  cards,
  fullCardPdf,
  title,
}: DownloadImagesButtonProps): ReactElement => {
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

  return fullCardPdf?.presignedUrl ? (
    <MUILink href={fullCardPdf.presignedUrl} target="_blank">
      <Button
        variant="outlined"
        sx={{
          borderRadius: '100px',
          fontWeight: 500,
          textTransform: 'none',
        }}
        size="medium"
      >
        {title}
      </Button>
    </MUILink>
  ) : (
    <Button
      variant="outlined"
      sx={{
        borderRadius: '100px',
        fontWeight: 500,
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
