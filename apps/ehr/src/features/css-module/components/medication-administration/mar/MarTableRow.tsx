import React, { useMemo } from 'react';
import { TableCell, TableRow, Box } from '@mui/material';
import TouchRipple from '@mui/material/ButtonBase/TouchRipple';
import useTouchRipple from '@mui/material/useTouchRipple';
import { MedicationStatusChip } from '../statuses/MedicationStatusChip';
import { MedicationBarcodeScan } from './MedicationBarcodeScan';
import { MedicationActions } from './MedicationActions';
import { useNavigate, useParams } from 'react-router-dom';
import { getInHouseMedicationDetailsUrl } from '../../../routing/helpers';
import { alpha, styled, useTheme } from '@mui/material/styles';
import { ExtendedMedicationDataForResponse, searchRouteByCode } from 'utils';
import { DateTime } from 'luxon';
import { dataTestIds } from '../../../../../constants/data-test-ids';

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
  const { id: encounterId } = useParams();
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
      navigate(`${getInHouseMedicationDetailsUrl(encounterId!)}?scrollTo=${medication.id}`);
    });
  };

  const formatDateTime = useMemo(() => {
    if (!medication.dateTimeCreated) return '-';

    const dt = DateTime.fromISO(medication.dateTimeCreated);

    if (!dt.isValid) return '-';

    return dt.toFormat('MM/dd/yyyy HH:mm a');
  }, [medication.dateTimeCreated]);

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
      <StyledTouchRipple ref={rippleRef} center={false} />
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableMedicationCell} sx={columnStyles.medication}>
        <MedicationBarcodeScan medication={medication} />
      </TableCell>
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableDoseCell} sx={columnStyles.dose}>
        {medication.dose}
      </TableCell>
      <TableCell data-testid={dataTestIds.inHouseMedicationsPage.marTableRouteCell} sx={columnStyles.route}>
        {searchRouteByCode(medication.route)?.display || '-'}
      </TableCell>
      <TableCell sx={columnStyles.orderDateTime}>{formatDateTime}</TableCell>
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
    </TableRow>
  );
};
