import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
// import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, IconButton, Skeleton, Typography, useTheme } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import { formatDateTimeToLocalTimezone, VitalsObservationDTO, VitalsOxygenSatObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalOxygenSatHistoryElementProps = {
  historyEntry: VitalsOxygenSatObservationDTO;
  isAlert?: boolean;
  isDeletable?: boolean;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalOxygenSatHistoryElement: React.FC<VitalOxygenSatHistoryElementProps> = ({
  historyEntry,
  isAlert = false,
  isDeletable = false,
  onDelete,
}): JSX.Element => {
  const theme = useTheme();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const handleDeleteClick = (): void => {
    setIsDeleteModalOpen(true);
  };
  const handleCloseDeleteModal = (): void => {
    setIsDeleteModalOpen(false);
  };

  const hasAuthor = !!historyEntry.authorName && historyEntry.authorName?.length > 0;
  const lineColor = useMemo(() => {
    if (isAlert) return theme.palette.warning.main;
    return theme.palette.text.primary;
  }, [isAlert, theme.palette.warning.main, theme.palette.text.primary]);

  const observationMethod = historyEntry.observationMethod;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            {historyEntry.value}%
          </Typography>
          {/*historyEntry.oxygenSatSeverity === 'critical' && (
            <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />
          )*/}
          {isAlert && (
            <WarningAmberOutlinedIcon
              fontSize="small"
              sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}
            />
          )}
          {observationMethod && ` (${observationMethod})`}
        </Typography>

        {isDeletable && (
          <IconButton
            size="small"
            aria-label="delete"
            sx={{ ml: 'auto', color: theme.palette.warning.dark }}
            onClick={handleDeleteClick}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <DeleteVitalModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        entity={historyEntry}
        onDelete={onDelete}
      />
    </>
  );
};

export const VitalOxygenSatHistoryElementSkeleton: React.FC = (): JSX.Element => (
  <Skeleton>
    <Typography sx={{ fontSize: '16px' }}>10/11/2024, 6:41 AM (EDT) by Jonson Clair - 91%</Typography>
  </Skeleton>
);

export default VitalOxygenSatHistoryElement;
