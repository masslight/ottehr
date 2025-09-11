import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { IconButton, TableCell, TableRow, Typography } from '@mui/material';
import { alpha, Stack, useTheme } from '@mui/system';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomDialog } from 'src/components/dialogs';
import {
  ReasonListCodes,
  reasonListValues,
} from 'src/features/css-module/components/medication-administration/medicationTypes';
import { useCancelImmunizationOrder } from 'src/features/css-module/hooks/useImmunization';
import { getImmunizationOrderEditUrl, getImmunizationVaccineDetailsUrl } from 'src/features/css-module/routing/helpers';
import { OrderStatusChip } from 'src/features/immunization/components/OrderStatusChip';
import { ImmunizationOrder, searchRouteByCode } from 'utils';

interface Props {
  order: ImmunizationOrder;
  showActions: boolean;
}

export const OrderHistoryTableRow: React.FC<Props> = ({ order, showActions }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const [isDeleteDialogOpened, setIsDeleteDialogOpened] = useState(false);

  const navigateToEditOrder = (): void => {
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate(getImmunizationOrderEditUrl(appointmentId, order.id));
  };

  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();

  const handleConfirmDelete = async (): Promise<void> => {
    try {
      await cancelOrder({
        orderId: order.id,
      });
    } catch (error) {
      console.error('Error deleting vaccine order:', error);
      enqueueSnackbar('An error occurred while deleting the vaccine order. Please try again.', { variant: 'error' });
    } finally {
      setIsDeleteDialogOpened(false);
    }
  };

  const isPending = order.status === 'pending';

  const handleRowClick = (): void => {
    if (!isPending || !showActions) {
      return;
    }
    requestAnimationFrame(() => {
      navigate(`${getImmunizationVaccineDetailsUrl(appointmentId!)}?scrollTo=${order.id}`);
    });
  };

  return (
    <TableRow
      sx={{
        ...(isPending && showActions
          ? {
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
              willChange: 'background-color',
              cursor: 'pointer',
            }
          : { cursor: 'default' }),
      }}
      onClick={handleRowClick}
    >
      <TableCell>{order.details.medication.name}</TableCell>
      <TableCell>
        {order.details.dose} {order.details.units}{' '}
        {order.details.route ? `/ ${searchRouteByCode(order.details.route)?.display}` : null}
        {grayText(order.details.instructions)}
      </TableCell>
      <TableCell>
        {formatDateTime(order.details.orderedDateTime)}
        {grayText(order.details.orderedProvider.name)}
      </TableCell>
      <TableCell>
        {formatDateTime(order.administrationDetails?.administeredDateTime)}
        {grayText(order.administrationDetails?.administeredProvider?.name)}
      </TableCell>
      <TableCell>
        <Stack direction="row" justifyContent="space-between">
          <Stack>
            <OrderStatusChip status={order.status} />
            {reasonListValues[order.reason as ReasonListCodes] ?? order.reason}
          </Stack>
          {showActions && order.status === 'pending' ? (
            <Stack direction="row" onClick={(e) => e.stopPropagation()}>
              <IconButton size="small" aria-label="edit" onClick={navigateToEditOrder}>
                <EditIcon sx={{ color: theme.palette.primary.dark }} />
              </IconButton>
              <IconButton size="small" aria-label="delete" onClick={() => setIsDeleteDialogOpened(true)}>
                <DeleteIcon sx={{ color: theme.palette.warning.dark }} />
              </IconButton>
              <CustomDialog
                open={isDeleteDialogOpened}
                handleClose={() => setIsDeleteDialogOpened(false)}
                title="Delete vaccine order"
                description={`Are you sure you want to delete the vaccine order?`}
                closeButtonText="Cancel"
                closeButton={false}
                handleConfirm={handleConfirmDelete}
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                confirmLoading={isDeleting}
              />
            </Stack>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
};

function formatDateTime(dateTime: string | undefined): string | undefined {
  if (!dateTime) {
    return undefined;
  }
  return DateTime.fromISO(dateTime)?.toFormat('MM/dd/yyyy HH:mm a');
}

function grayText(text: string | undefined): ReactElement {
  return <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{text}</Typography>;
}
