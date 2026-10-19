import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { LoadingButton } from '@mui/lab';
import { Alert, Box, Button, Paper, Stack, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactNode, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FormsCard } from 'src/features/visits/shared/components/FormsCard';
import {
  DME_LATERALITY_LABELS,
  DME_MODIFIER_LABELS,
  DmeOrderDTO,
  DmeOrderStatus,
  formatDmeBillingCode,
  formatDmeDuration,
} from 'utils/lib/types/api/dme.types';
import { formatDate } from 'utils/lib/utils/date';
import { useDmeOrderPdf } from '../dme.queries';
import { DmeOrderAction, DmeOrderActionDialog } from './DmeOrderActionDialog';
import { DmeStatusChip } from './DmeStatusChip';

const DetailRow: React.FC<{ label: string; value?: ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 180 }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1 }}>
      {typeof value === 'string' || value === undefined ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
          {value || '—'}
        </Typography>
      ) : (
        value
      )}
    </Box>
  </Box>
);

const lines = (values: string[]): ReactNode =>
  values.length ? (
    <Box>
      {values.map((value) => (
        <Typography key={value} variant="body2">
          {value}
        </Typography>
      ))}
    </Box>
  ) : undefined;

interface DmeOrderDetailsProps {
  order: DmeOrderDTO;
  readOnly?: boolean;
  onEdit?: () => void;
  onDeleted?: () => void;
}

export const DmeOrderDetails: React.FC<DmeOrderDetailsProps> = ({ order, readOnly, onEdit, onDeleted }) => {
  const theme = useTheme();
  const { mutateAsync: getPdf, isPending: isPrinting } = useDmeOrderPdf();
  const [pendingAction, setPendingAction] = useState<DmeOrderAction | undefined>();
  const ids = dataTestIds.dmeOrders.details;
  const canDispense = !readOnly && !order.external && order.status === DmeOrderStatus.pending;

  const handlePrint = async (): Promise<void> => {
    // opened before the await so popup blockers still count it as user-initiated
    const newTab = window.open('', '_blank');
    try {
      const { presignedURL } = await getPdf(order.id);
      if (newTab) newTab.location.href = presignedURL;
      else window.open(presignedURL, '_blank');
    } catch (error) {
      newTab?.close();
      console.error('Error generating DME order PDF:', error);
      enqueueSnackbar('Failed to generate the DME order PDF', { variant: 'error' });
    }
  };

  const orderedBy = [formatDate(order.orderedAt, 'MM/dd/yyyy hh:mm a'), order.orderedBy.name]
    .filter(Boolean)
    .join(' by ');
  const dispensed = order.dispensed
    ? [formatDate(order.dispensed.at, 'MM/dd/yyyy hh:mm a'), order.dispensed.name].filter(Boolean).join(' by ')
    : undefined;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" data-testid={ids.title}>
          {order.itemName}
        </Typography>
        <DmeStatusChip status={order.status} />
      </Box>

      {order.external && (
        <Alert severity="info" data-testid={ids.externalHint}>
          Fulfilled by an external site / third party. This order is print only, so no dispensing task is created.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ color: theme.palette.primary.dark, mb: 2 }}>
          Order Details
        </Typography>
        <DetailRow label="DME" value={order.itemName} />
        <DetailRow label="Associated Dx" value={lines(order.diagnoses.map((dx) => `${dx.code} ${dx.display}`))} />
        <DetailRow label="Quantity Dispensed" value={String(order.quantity)} />
        <DetailRow label="Laterality" value={order.laterality && DME_LATERALITY_LABELS[order.laterality]} />
        <DetailRow label="Modifiers" value={order.modifier && DME_MODIFIER_LABELS[order.modifier]} />
        <DetailRow label="Duration of use" value={formatDmeDuration(order.duration)} />
        <DetailRow label="Ordered" value={orderedBy} />
        {!order.external && <DetailRow label="Dispensed" value={dispensed} />}
        <DetailRow label="Instructions" value={order.instructions} />
        <DetailRow label="CPT / HCPCS Codes" value={lines(order.billingCodes.map(formatDmeBillingCode))} />
        <DetailRow label="Fulfilled by" value={order.external ? 'External Site / Third Party' : 'In-house'} />

        {order.external && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ color: theme.palette.primary.dark, mb: 1 }}>
              Third Party Information
            </Typography>
            <DetailRow label="Clinic name" value={order.thirdParty?.name} />
            <DetailRow label="Address" value={order.thirdParty?.address} />
            <DetailRow label="Phone" value={order.thirdParty?.phone} />
            <DetailRow label="Fax" value={order.thirdParty?.fax} />
          </Box>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 }}>
          {!readOnly && onEdit && (
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={onEdit}
              sx={{ borderRadius: '50px', textTransform: 'none' }}
              data-testid={ids.editButton}
            >
              Edit
            </Button>
          )}
          <LoadingButton
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            loading={isPrinting}
            onClick={handlePrint}
            sx={{ borderRadius: '50px', textTransform: 'none' }}
            data-testid={ids.printButton}
          >
            Print
          </LoadingButton>
          {!readOnly && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlinedIcon />}
              onClick={() => setPendingAction('delete')}
              sx={{ borderRadius: '50px', textTransform: 'none' }}
              data-testid={ids.deleteButton}
            >
              Delete
            </Button>
          )}
          {canDispense && (
            <Button
              variant="contained"
              onClick={() => setPendingAction('dispense')}
              sx={{ borderRadius: '50px', textTransform: 'none', ml: 'auto' }}
              data-testid={ids.dispenseButton}
            >
              Dispense
            </Button>
          )}
        </Box>
      </Paper>

      {!order.external && <FormsCard />}

      {pendingAction && (
        <DmeOrderActionDialog
          order={order}
          action={pendingAction}
          open
          onClose={() => setPendingAction(undefined)}
          onDone={pendingAction === 'delete' ? onDeleted : undefined}
        />
      )}
    </Stack>
  );
};
