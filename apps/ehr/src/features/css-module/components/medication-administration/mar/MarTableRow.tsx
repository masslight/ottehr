import { Box, TableCell, TableRow } from '@mui/material';
import TouchRipple from '@mui/material/ButtonBase/TouchRipple';
import { alpha, styled, useTheme } from '@mui/material/styles';
import useTouchRipple from '@mui/material/useTouchRipple';
import { DateTime } from 'luxon';
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExtendedMedicationDataForResponse, searchRouteByCode } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getInHouseMedicationDetailsUrl } from '../../../routing/helpers';
import { MedicationStatusChip } from '../statuses/MedicationStatusChip';
import { MedicationActions } from './MedicationActions';
import { MedicationBarcodeScan } from './MedicationBarcodeScan';

interface MarTableRowProps {
  medication: ExtendedMedicationDataForResponse;
  columnStyles: Record<string, React.CSSProperties>;
}

const StyledTouchRipple = styled(TouchRipple)(({ theme }) => ({
  '& .MuiTouchRipple-child': {
    backgroundColor: alpha(theme.palette.primary.main, 0.42),
  },
}));

export const MarTableRow: React.FC<MarTableRowProps> = ({ medication, columnStyles }) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const rippleRef = React.useRef(null);
  const theme = useTheme();

  const { getRippleHandlers } = useTouchRipple({
    disabled: false,
    focusVisible: false,
    rippleRef,
  });

  const isPending = medication.status === 'pending';

  const handleRowClick = (): void => {
    if (!isPending) {
      return;
    }
    requestAnimationFrame(() => {
      navigate(`${getInHouseMedicationDetailsUrl(appointmentId!)}?scrollTo=${medication.id}`);
    });
  };

  const formatOrderDateTime = useMemo(() => {
    if (!medication.dateTimeCreated) return '-';

    const dt = DateTime.fromISO(medication.dateTimeCreated);

    if (!dt.isValid) return '-';

    return dt.toFormat('MM/dd/yyyy hh:mm a');
  }, [medication.dateTimeCreated]);

  const formatGivenDateTime = useMemo(() => {
    if (!medication.dateGiven || !medication.timeGiven) return '-';

    const dt = DateTime.fromFormat(`${medication.dateGiven} ${medication.timeGiven}`, 'yyyy-MM-dd HH:mm:ss');

    if (!dt.isValid) return '-';

    return dt.toFormat('MM/dd/yyyy hh:mm a');
  }, [medication.dateGiven, medication.timeGiven]);

  return (
    <TableRow
      data-testid={dataTestIds.inHouseMedicationsPage.marTableRow}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        paddingLeft: '12px',
        ...(isPending
          ? {
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
              willChange: 'background-color',
            }
          : { cursor: 'default' }),
      }}
      onClick={handleRowClick}
      {...getRippleHandlers()}
    >
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableMedicationCell} sx={columnStyles.medication}>
        <MedicationBarcodeScan medication={medication} />
      </TableCell>
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableDoseCell} sx={columnStyles.dose}>
        {medication.dose}
      </TableCell>
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableRouteCell} sx={columnStyles.route}>
        {searchRouteByCode(medication.route)?.display || '-'}
      </TableCell>
      <TableCell sx={columnStyles.orderDateTime}>{formatOrderDateTime}</TableCell>
      <TableCell sx={columnStyles.orderDateTime}>{medication.providerCreatedTheOrder}</TableCell>
      {!isPending && (
        <>
          <TableCell sx={columnStyles.orderDateTime}>{formatGivenDateTime}</TableCell>
          <TableCell sx={columnStyles.orderDateTime}>{medication.administeredProvider || ''}</TableCell>
        </>
      )}
      <TableCell
        data-testid={dataTestIds.inHouseMedicationsPage.marTableInstructionsCell}
        sx={columnStyles.instructions}
      >
        {medication.instructions}
      </TableCell>
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableStatusCell} sx={columnStyles.status}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <MedicationStatusChip medication={medication} />
          <MedicationActions medication={medication} />
        </Box>
      </TableCell>
      <StyledTouchRipple ref={rippleRef} center={false} />
    </TableRow>
  );
};
