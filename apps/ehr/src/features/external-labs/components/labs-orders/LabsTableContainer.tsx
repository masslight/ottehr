import { Box, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { ReactElement, useState } from 'react';
import { submitLabOrder } from 'src/api/api';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { useApiClients } from 'src/hooks/useAppClients';
import { openPdf } from 'utils/lib/helpers/labs/helpers';
import {
  ExternalLabsStatus,
  GetLabOrdersParameters,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  ReflexLabDTO,
} from 'utils/lib/types/data/labs/labs.types';
import { configBundleTableTestId } from '../../utils/test-ids';
import { LabsTable } from './LabsTable';
import { LabsTableBundleHeaderRow } from './LabsTableBundleHeaderRow';

type LabsTableContainerProps<SearchBy extends LabOrdersSearchBy> = {
  labOrders: (LabOrderListPageDTO | ReflexLabDTO)[];
  orderBundleName: string;
  abnPdfUrl: string | undefined;
  orderPdfUrl: string | undefined;
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
    testItemStatus: ExternalLabsStatus;
  }) => void;
  handleRejectedAbn?: (serviceRequestId: string) => Promise<void>;
  requisitionNumber?: string; // optional because the result table is not grouped by requisition
  orderBundleNote?: string; // right now with the way results are organized this will not be viewable once results come in. not sure if thats a problem.
  onRowClick: (labOrderData: LabOrderListPageDTO) => void;
  onDrDrivenRowClick: (result: ReflexLabDTO) => void;
};

export const LabsTableContainer = <SearchBy extends LabOrdersSearchBy>({
  labOrders,
  orderBundleName,
  abnPdfUrl,
  orderPdfUrl,
  searchBy,
  columns,
  allowDelete,
  allowSubmit,
  fetchLabOrders,
  showDeleteLabOrderDialog,
  handleRejectedAbn,
  requisitionNumber,
  orderBundleNote,
  onRowClick,
  onDrDrivenRowClick,
}: LabsTableContainerProps<SearchBy>): ReactElement => {
  const { oystehrZambda: oystehr } = useApiClients();

  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [errorDialogOpen, setErrorDialogOpen] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | undefined>();
  const [failedOrderNumbers, setFailedOrderNumbers] = useState<{ [orderNumber: string]: string } | undefined>();

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

  const refetchLabOrders = async (): Promise<void> => {
    await fetchLabOrders(searchBy);
  };

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
        await refetchLabOrders();
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
      .filter((order) => order.orderNumber && Object.keys(failedOrderNumbers).includes(order.orderNumber));
    await submitOrders(true, labs);
  };

  function isLabOrder(order: LabOrderListPageDTO | ReflexLabDTO): order is LabOrderListPageDTO {
    return !('drCentricResultType' in order);
  }

  const manualSubmitDialogDescription = (
    <Box>
      {manualError ? (
        <Typography color="error">{`Error manually submitting: ${manualError}`}</Typography>
      ) : (
        <>
          <Typography color="error">Submits failed for the following:</Typography>

          {Object.entries(failedOrderNumbers ?? {}).map(([orderNumber, reason], index) => (
            <Typography key={index} color="error">
              {orderNumber}: {reason}
            </Typography>
          ))}

          <Typography sx={{ marginTop: 1 }}>
            After clicking confirm you can no longer electronically submit these orders, please confirm this action
          </Typography>
        </>
      )}
    </Box>
  );

  const closeErrorDialog = (): void => {
    void (async (): Promise<void> => {
      await fetchLabOrders(searchBy);
      setErrorDialogOpen(false);
    })();
  };

  const bundleHeaderRowProps = {
    columnsLen: columns.length,
    orderBundleName,
    showSubmitButton,
    pendingLabsLen: pendingLabs.length,
    submitLoading,
    abnPdfUrl,
    orderPdfUrl,
    submitOrders,
    refetchLabOrders,
    oystehr,
    requisitionNumber,
    existingNote: orderBundleNote,
  };

  return (
    <Box sx={{ mb: 2 }}>
      <>
        <Box sx={{ width: '100%' }}>
          <>
            <LabsTable
              columns={columns}
              labOrders={labOrders}
              bundleRow={<LabsTableBundleHeaderRow {...bundleHeaderRowProps} />}
              dataTestId={configBundleTableTestId(orderBundleName)}
              allowDelete={allowDelete}
              showDeleteLabOrderDialog={showDeleteLabOrderDialog}
              handleRejectedAbn={handleRejectedAbn}
              onRowClick={onRowClick}
              onDrDrivenRowClick={onDrDrivenRowClick}
            />
          </>
        </Box>
      </>
      {error && (
        <Typography sx={{ textAlign: 'right', mt: 1 }} color="error">
          {error}
        </Typography>
      )}
      {failedOrderNumbers &&
        (manualError ? (
          // The manual submit failed too: nothing is left to confirm, so the dialog only reports it.
          <AppDialog
            variant="alert"
            severity="error"
            open={errorDialogOpen}
            onClose={closeErrorDialog}
            title="Manually Submitting Lab Order"
            dismiss={{ label: 'Close' }}
          >
            {manualSubmitDialogDescription}
          </AppDialog>
        ) : (
          <AppDialog
            variant="confirm"
            open={errorDialogOpen}
            onClose={closeErrorDialog}
            title="Manually Submitting Lab Order"
            primary={{ label: 'Confirm Manual Submit', onClick: manualSubmit, loading: submitLoading }}
          >
            {manualSubmitDialogDescription}
          </AppDialog>
        ))}
    </Box>
  );
};
