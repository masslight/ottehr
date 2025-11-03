import { otherColors } from '@ehrTheme/colors';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import DeleteDialog from 'src/components/dialogs/DeleteDialog';
import {
  formatDateForLabs,
  LabOrderListPageDTO,
  LabsTableColumn,
  PdfAttachmentDTO,
  PSC_LOCALE,
  ReflexLabDTO,
  UnsolicitedLabListPageDTO,
} from 'utils';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';

interface LabsTableRowProps {
  columns: LabsTableColumn[];
  labOrderData: LabOrderListPageDTO | ReflexLabDTO | UnsolicitedLabListPageDTO | PdfAttachmentDTO;
  handleRejectedAbn?: (serviceRequestId: string) => Promise<void>;
  onDeleteOrder?: () => void;
  allowDelete?: boolean;
  onRowClick?: () => void;
}

export const LabsTableRow = ({
  labOrderData,
  handleRejectedAbn,
  onDeleteOrder,
  columns,
  allowDelete = false,
  onRowClick,
}: LabsTableRowProps): ReactElement => {
  const theme = useTheme();
  const [rejectAbnDialogOpen, setRejectAbnDialogOpen] = useState<boolean>(false);
  const [rejectingAbn, setRejectingAbn] = useState<boolean>(false);

  const isLabWithoutSR = 'drCentricResultType' in labOrderData || 'isUnsolicited' in labOrderData;
  const allowAbnRejection =
    !isLabWithoutSR && handleRejectedAbn && labOrderData.abnPdfUrl && labOrderData.serviceRequestId;

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onDeleteOrder) {
      onDeleteOrder();
    }
  };

  const handleRejectAbnClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setRejectAbnDialogOpen(true);
  };

  const rejectAbn = async (): Promise<void> => {
    if (!allowAbnRejection) {
      // this should never happen since you can't open the dialog when allowAbnRejection is falsy
      console.log('allowAbnRejection is unexpectedly falsy', allowAbnRejection);
      return;
    }

    setRejectingAbn(true);
    try {
      await handleRejectedAbn(labOrderData.serviceRequestId);
      setRejectAbnDialogOpen(false);
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('Error marking this abn as rejected', sdkError.code, sdkError.message);
      enqueueSnackbar('Error marking this abn as rejected', { variant: 'error' });
    } finally {
      setRejectingAbn(false);
    }
  };

  const getLabDetail = (lab: ReflexLabDTO | UnsolicitedLabListPageDTO | PdfAttachmentDTO): string => {
    if ('isUnsolicited' in lab) {
      return 'UNS';
    } else if ('drCentricResultType' in lab) {
      return lab.drCentricResultType === 'reflex' ? 'RFX' : 'PDF';
    }
    return '';
  };

  const renderCellContentForLabWithoutSR = (
    column: LabsTableColumn,
    lab: ReflexLabDTO | UnsolicitedLabListPageDTO | PdfAttachmentDTO
  ): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{lab.testItem}</Box>
          </Box>
        );
      case 'visit':
        return '';
      case 'orderAdded':
        return '';
      case 'provider':
        return '';
      case 'ordered':
        return '';
      case 'dx':
        return '';
      case 'resultsReceived':
        return <Box>{formatDateForLabs(lab.lastResultReceivedDate, undefined)}</Box>;
      case 'accessionNumber':
        return lab.accessionNumbers.join(', ');
      case 'requisitionNumber':
        return 'orderNumber' in lab ? lab.orderNumber : '';
      case 'status':
        return <LabsOrderStatusChip status={lab.orderStatus} />;
      case 'detail':
        return getLabDetail(lab);
      case 'actions':
        return null;
      default:
        return null;
    }
  };

  const renderCellContentForOrderedLab = (column: LabsTableColumn, lab: LabOrderListPageDTO): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{lab.testItem}</Box>
          </Box>
        );
      case 'visit':
        return <Box>{formatDateForLabs(lab.visitDate, lab.encounterTimezone)}</Box>;
      case 'orderAdded':
        return <Box>{formatDateForLabs(lab.orderAddedDate, lab.encounterTimezone)}</Box>;
      case 'provider':
        return lab.orderingPhysician || '';
      case 'ordered':
        return (
          <Box>
            <Box>{formatDateForLabs(lab.orderAddedDate, lab.encounterTimezone)}</Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                by {lab.orderingPhysician || ''}
              </Typography>
            </Box>
          </Box>
        );
      case 'dx': {
        const firstDx = lab.diagnosesDTO[0]?.display || '';
        const firstDxCode = lab.diagnosesDTO[0]?.code || '';
        const firstDxText = `${firstDxCode} ${firstDx}`;
        const fullDxText = lab.diagnosesDTO.map((dx) => `${dx.code} ${dx.display}`).join('; ');
        const dxCount = lab.diagnosesDTO.length;
        if (dxCount > 1) {
          return (
            <Tooltip title={fullDxText} arrow placement="top">
              <Typography variant="body2">
                {firstDxText}; <span style={{ color: theme.palette.text.secondary }}>+ {dxCount - 1} more</span>
              </Typography>
            </Tooltip>
          );
        }
        return <Typography variant="body2">{firstDxText}</Typography>;
      }
      case 'resultsReceived':
        return <Box>{formatDateForLabs(lab.lastResultReceivedDate, lab.encounterTimezone)}</Box>;
      case 'accessionNumber':
        return lab.accessionNumbers.join(', ');
      case 'requisitionNumber':
        return lab.orderNumber;
      case 'status':
        return <LabsOrderStatusChip status={lab.orderStatus} />;
      case 'detail':
        return lab.isPSC ? PSC_LOCALE : '';
      case 'actions':
        if (allowDelete && (lab.orderStatus === 'pending' || lab.orderStatus === 'ready')) {
          return (
            <Button
              onClick={handleDeleteClick}
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              <DeleteIcon sx={{ color: otherColors.priorityHighText }} />
            </Button>
          );
        } else if (allowAbnRejection && lab.orderStatus === 'sent') {
          return (
            <Button
              onClick={handleRejectAbnClick}
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              <CancelOutlinedIcon sx={{ color: otherColors.priorityHighText }} />
            </Button>
          );
        }
        return null;
      default:
        return null;
    }
  };

  const rejectAbnDialogDescription = (
    <>
      <Typography>
        Patient has not signed the ABN for{' '}
        <strong>
          {labOrderData.testItem} / {labOrderData.fillerLab}
        </strong>
        . The lab will still receive the order, but not process the test if you do not send a specimen. Please hand
        write a corresponding note on the printed order form.
      </Typography>
      <Typography sx={{ mt: '8px' }}>
        Click the button below to mark this test as "Rejected ABN" in the EHR. This cannot be undone.
      </Typography>
    </>
  );

  return (
    <>
      <TableRow
        sx={{
          '&:hover': { backgroundColor: '#f5f5f5' },
          cursor: 'pointer',
        }}
        onClick={onRowClick}
      >
        {columns.map((column) =>
          isLabWithoutSR ? (
            <TableCell key={column}>{renderCellContentForLabWithoutSR(column, labOrderData)}</TableCell>
          ) : (
            <TableCell key={column}>{renderCellContentForOrderedLab(column, labOrderData)}</TableCell>
          )
        )}
      </TableRow>
      <DeleteDialog
        open={rejectAbnDialogOpen}
        handleClose={() => setRejectAbnDialogOpen(false)}
        title="Mark as Rejected ABN"
        description={rejectAbnDialogDescription}
        closeButtonText="Keep"
        handleDelete={rejectAbn}
        deleteButtonText={'Mark as Rejected ABN'}
        loadingDelete={rejectingAbn}
      ></DeleteDialog>
    </>
  );
};
