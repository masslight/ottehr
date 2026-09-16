import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { FC, useId, useState } from 'react';
import { formatDateForLabs } from 'utils/lib/utils/dateUtils';

interface PrelimCardViewProps {
  resultPdfUrl: string | null;
  labGeneratedResultUrls?: string[];
  receivedDate: string | null;
  reviewedDate: string | null;
  onPrelimView: () => void;
  timezone: string | undefined;
}

export const PrelimCardView: FC<PrelimCardViewProps> = ({
  resultPdfUrl,
  labGeneratedResultUrls,
  receivedDate,
  reviewedDate,
  onPrelimView,
  timezone,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);
  const hasLabGeneratedResults = !!labGeneratedResultUrls?.length;
  const menuButtonId = useId();
  const menuId = useId();

  const getDateEvent = (): { event: 'received' | 'reviewed'; date: string } => {
    return receivedDate
      ? { event: 'received', date: formatDateForLabs(receivedDate, timezone) }
      : { event: 'reviewed', date: formatDateForLabs(reviewedDate, timezone) };
  };

  const openPdf = (): void => {
    if (resultPdfUrl) {
      // additional handling for prelim, prelim resources are marked as reviewed when pdf is viewed (resources are updated, but we didn't show it in the UI),
      // the final results resources are marked as reviewed by clicking on "mark as reviewed" and we show it in the UI
      onPrelimView();
      window.open(resultPdfUrl, '_blank');
    }
  };

  const openLabGeneratedResults = (): void => {
    if (labGeneratedResultUrls?.length) {
      onPrelimView();
      labGeneratedResultUrls.forEach((url) => window.open(url, '_blank'));
    }
  };

  const { event, date } = getDateEvent();

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderRadius: 1,
        border: '1px solid #e0e0e0',
        backgroundColor: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body1" color="text.primary">
          Preliminary results ({event} {date})
        </Typography>
      </Box>

      {hasLabGeneratedResults ? (
        <>
          <Button
            id={menuButtonId}
            onClick={(clickEvent) => setAnchorEl(clickEvent.currentTarget)}
            variant="text"
            color="primary"
            endIcon={<ArrowDropDownIcon />}
            aria-haspopup="true"
            aria-controls={menuOpen ? menuId : undefined}
            aria-expanded={menuOpen ? 'true' : undefined}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            View
          </Button>
          <Menu
            id={menuId}
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            MenuListProps={{ 'aria-labelledby': menuButtonId }}
          >
            <MenuItem
              disabled={!resultPdfUrl}
              onClick={() => {
                setAnchorEl(null);
                openPdf();
              }}
            >
              View Results
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                openLabGeneratedResults();
              }}
            >
              View Lab Generated Results
            </MenuItem>
          </Menu>
        </>
      ) : (
        <Button
          disabled={!resultPdfUrl}
          onClick={openPdf}
          variant="text"
          color="primary"
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          View
        </Button>
      )}
    </Paper>
  );
};
