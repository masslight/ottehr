import React, { ReactElement, useState } from 'react';
import { TableRow, TableCell, Button, Box, Typography, Chip, Tooltip } from '@mui/material';
import { DateTime } from 'luxon';
import deleteIcon from '../../../assets/delete-1x.png';
import { ExternalLabsStatusChip } from './ExternalLabsStatusChip';
import { otherColors } from '../../../CustomThemeProvider';
import { DiagnosisDTO } from 'utils';
import CancelExternalLabDialog from './CancelExternalLabOrderDialog';
import { useNavigate } from 'react-router-dom';
import { LabOrderDTO } from '../helpers/types';

const { VITE_APP_ORGANIZATION_NAME_SHORT: ORGANIZATION_NAME_SHORT } = import.meta.env;
if (ORGANIZATION_NAME_SHORT == null) {
  throw new Error('Could not load env variable');
}

interface ExternalLabsTableRowProps {
  externalLabsData: LabOrderDTO;
}

const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): React.ReactNode => {
  if (!diagnoses || diagnoses.length === 0) {
    return '';
  }

  if (diagnoses.length === 1) {
    return `${diagnoses[0].code} - ${diagnoses[0].display}`;
  }

  return (
    <>
      {diagnoses[0].code} <span style={{ color: 'gray' }}>{diagnoses.length - 1} more</span>
    </>
  );
};

export default function ExternalLabsTableRow({ externalLabsData }: ExternalLabsTableRowProps): ReactElement {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const navigateTo = useNavigate();

  if (
    !externalLabsData ||
    !externalLabsData.id ||
    !externalLabsData.type ||
    !externalLabsData.location ||
    !externalLabsData.orderAdded ||
    !externalLabsData.diagnoses ||
    !externalLabsData.status
  ) {
    console.error('Invalid lab order data:', externalLabsData);
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <Typography color="error">Invalid lab order data</Typography>
        </TableCell>
      </TableRow>
    );
  }

  const orderAdded =
    externalLabsData.orderAdded instanceof DateTime
      ? externalLabsData.orderAdded
      : DateTime.fromISO(typeof externalLabsData.orderAdded === 'string' ? externalLabsData.orderAdded : '');

  if (!orderAdded.isValid) {
    console.error('Invalid DateTime in lab order:', externalLabsData.orderAdded);
  }

  const handleRowClick = (): void => {
    if (!dialogOpen) {
      navigateTo(`order-details/${externalLabsData.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  const handleCloseDialog = (): void => setDialogOpen(false);

  // for MVP we have PSC for all orders
  const isPSC = true;

  // full diagnoses text for tooltip
  const fullDiagnosesText =
    externalLabsData.diagnoses.length > 1
      ? externalLabsData.diagnoses.map((dx) => `${dx.code} - ${dx.display}`).join('\n')
      : '';

  return (
    <TableRow
      onClick={handleRowClick}
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '&:hover': {
          backgroundColor: otherColors.apptHover,
        },
        cursor: 'pointer',
      }}
    >
      <TableCell>
        <Box>
          <Typography variant="body1">{`${externalLabsData.type} / ${externalLabsData.location}`}</Typography>
          {externalLabsData.reflexTestsCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {externalLabsData.reflexTestsCount === 1
                ? '+ Reflex result'
                : `+ ${externalLabsData.reflexTestsCount} Reflex results`}
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        {orderAdded.isValid
          ? `${orderAdded.toLocaleString(DateTime.DATE_SHORT)} ${orderAdded.toLocaleString(DateTime.TIME_SIMPLE)}`
          : 'Invalid date'}
      </TableCell>
      <TableCell>{externalLabsData.provider}</TableCell>
      <TableCell>
        {externalLabsData.diagnoses.length > 1 ? (
          <Tooltip title={fullDiagnosesText} arrow placement="top">
            <Typography variant="body2">{getFormattedDiagnoses(externalLabsData.diagnoses)}</Typography>
          </Tooltip>
        ) : (
          <Typography variant="body2">{getFormattedDiagnoses(externalLabsData.diagnoses)}</Typography>
        )}
      </TableCell>
      <TableCell align="left">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExternalLabsStatusChip status={externalLabsData.status} />
          {isPSC && (
            <Chip
              size="small"
              label="PSC"
              sx={{
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                height: '20px',
                backgroundColor: '#fff',
                color: '#3d3d3d',
              }}
            />
          )}
        </Box>
      </TableCell>
      <TableCell>
        {externalLabsData.status === 'pending' ? (
          <Button
            onClick={handleDeleteClick}
            sx={{
              textTransform: 'none',
              borderRadius: 28,
              fontWeight: 'bold',
            }}
          >
            <img src={deleteIcon} alt={`${ORGANIZATION_NAME_SHORT} deleteIcon`} />
          </Button>
        ) : null}
      </TableCell>
      <CancelExternalLabDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        externalLabOrderTestType={externalLabsData.type}
      />
    </TableRow>
  );
}
