import { otherColors } from '@ehrTheme/colors';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import { Box, Button, TableCell, TableRow, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { JSXElementConstructor, ReactElement, useState } from 'react';
import { submitLabOrder } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  GetLabOrdersParameters,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  openPdf,
  PdfAttachmentDTO,
  ReflexLabDTO,
} from 'utils';
import { LabsTable } from './LabsTable';

type LabsTableContainerProps<SearchBy extends LabOrdersSearchBy> = {
  labOrders: (LabOrderListPageDTO | ReflexLabDTO | PdfAttachmentDTO)[];
  orderBundleName: string;
  abnPdfUrl: string | undefined;
  searchBy: SearchBy;
  columns: LabsTableColumn[];
  allowDelete: boolean;
  allowSubmit: boolean;
  fetchLabOrders: (params: GetLabOrdersParameters) => Promise<void>;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactElement<any, string | JSXElementConstructor<any>> | null;
};

export const LabsTableContainer = <SearchBy extends LabOrdersSearchBy>({
  labOrders,
  orderBundleName,
  abnPdfUrl,
  searchBy,
  columns,
  allowDelete,
  allowSubmit,
  fetchLabOrders,
  showDeleteLabOrderDialog,
  DeleteOrderDialog,
}: LabsTableContainerProps<SearchBy>): ReactElement => {
  const { oystehrZambda: oystehr } = useApiClients();

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [errorDialogOpen, setErrorDialogOpen] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | undefined>();
  const [failedOrderNumbers, setFailedOrderNumbers] = useState<string[] | undefined>();

  const { pendingLabs, readyLabs } = labOrders.reduce(
    (acc: { pendingLabs: LabOrderListPageDTO[]; readyLabs: LabOrderListPageDTO[] }, lab) => {
      if (isLabOrder(lab)) {
        if (lab.orderStatus === 'pending') acc.pendingLabs.push(lab);
        if (lab.orderStatus === 'ready') acc.readyLabs.push(lab);
      }
      return acc;
    },
    { pendingLabs: [], readyLabs: [] }
  );
  const showSubmitButton = allowSubmit && readyLabs.length + pendingLabs.length > 0;

  const submitOrders = async (manualOrder: boolean, labsToSubmit = readyLabs): Promise<void> => {
    if (!oystehr) {
      console.log('error: oystehr client is missing');
      setError('error submitting orders');
      return;
    }

    setSubmitLoading(true);
    console.log('submitting the orders');

    try {
      const { orderPdfUrls, failedOrdersByOrderNumber } = await submitLabOrder(oystehr, {
        serviceRequestIDs: labsToSubmit.map((order) => order.serviceRequestId),
        manualOrder,
      });
      await Promise.all(orderPdfUrls.map((pdfUrl) => openPdf(pdfUrl)));

      if (failedOrdersByOrderNumber) {
        setFailedOrderNumbers(failedOrdersByOrderNumber);
        setErrorDialogOpen(true);
      } else {
        setErrorDialogOpen(false);
        await fetchLabOrders(searchBy);
      }
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error submitting lab', sdkError.code, sdkError.message);
      if (manualOrder) {
        setManualError(sdkError.message);
      } else {
        setError(sdkError.message);
      }
    }
    setSubmitLoading(false);
  };

  const manualSubmit = async (): Promise<void> => {
    if (!failedOrderNumbers) return;
    const labs: LabOrderListPageDTO[] = labOrders
      .filter(isLabOrder)
      .filter((order) => order.orderNumber && failedOrderNumbers.includes(order.orderNumber));
    await submitOrders(true, labs);
  };
  function isLabOrder(order: LabOrderListPageDTO | ReflexLabDTO | PdfAttachmentDTO): order is LabOrderListPageDTO {
    return !('drCentricResultType' in order);
  }

  const manualSubmitDialogDescription = (
    <Box>
      {manualError ? (
        <Typography color="error">{`Error manually submitting: ${manualError}`}</Typography>
      ) : (
        <>
          <Typography color="error">{`Submits failed for the following orders: ${failedOrderNumbers}`}</Typography>
          <Typography sx={{ marginTop: 1 }}>
            {`After clicking confirm you can no longer electronically submit these orders, please confirm this action`}
          </Typography>
        </>
      )}
    </Box>
  );

  const bundleHeaderRow = (
    <>
      <TableRow>
        <TableCell colSpan={columns.length} sx={{ p: '8px 18px', backgroundColor: '#2169F514' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ fontWeight: '500', color: 'primary.dark' }}>
                {orderBundleName}
              </Typography>
            </Box>
            {showSubmitButton && (
              <LoadingButton
                loading={submitLoading}
                variant="contained"
                sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
                color="primary"
                size={'medium'}
                onClick={() => submitOrders(false)}
                disabled={pendingLabs.length > 0}
              >
                Submit & Print Order(s)
              </LoadingButton>
            )}
            {abnPdfUrl && (
              <Button
                variant="outlined"
                type="button"
                sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
                onClick={() => openPdf(abnPdfUrl)}
              >
                Re-print ABN
              </Button>
            )}
          </Box>
        </TableCell>
      </TableRow>
      {abnPdfUrl && (
        <TableRow sx={{ p: '6px 16px' }}>
          <TableCell colSpan={columns.length} sx={{ p: '8px 18px', background: otherColors.warningBackground }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WarningAmberIcon sx={{ fontWeight: '600', color: otherColors.warningIcon, paddingRight: '8px' }} />
              <Typography variant="h5" color={otherColors.warningIcon}>
                Advance Beneficiary Notice
              </Typography>
            </Box>
            <Typography variant="body2">
              Some tests may not be covered by patient’s insurance. Patient needs to review and sign ABN. If not signed,
              please mark the test(s) as rejected on the printed order form.
            </Typography>
          </TableCell>
        </TableRow>
      )}
    </>
  );

  return (
    <Box sx={{ mb: 2 }}>
      <>
        <Box sx={{ width: '100%' }}>
          <>
            <LabsTable
              columns={columns}
              labOrders={labOrders}
              bundleRow={bundleHeaderRow}
              allowDelete={allowDelete}
              showDeleteLabOrderDialog={showDeleteLabOrderDialog}
            />
          </>
        </Box>
        {DeleteOrderDialog}
      </>
      {error && (
        <Typography sx={{ textAlign: 'right', mt: 1 }} color="error">
          {error}
        </Typography>
      )}
      {failedOrderNumbers && (
        <CustomDialog
          open={errorDialogOpen}
          confirmLoading={submitLoading}
          handleConfirm={manualError ? undefined : manualSubmit}
          confirmText="Confirm manual submit"
          handleClose={async () => {
            await fetchLabOrders(searchBy);
            setErrorDialogOpen(false);
          }}
          title="Manually submitting lab order"
          description={manualSubmitDialogDescription}
          closeButtonText="Cancel"
        />
      )}
    </Box>
  );
};
