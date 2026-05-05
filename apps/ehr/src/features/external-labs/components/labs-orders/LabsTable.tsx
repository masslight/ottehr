import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FollowUpAppointmentLookup,
  getDrExternalLabEditUrl,
  getExternalLabOrderEditUrl,
  resolveOrderRoutingFromFollowUpLookup,
} from 'src/features/visits/in-person/routing/helpers';
import {
  ExternalLabsStatus,
  getColumnHeader,
  getColumnWidth,
  LabOrderDTO,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  ReflexLabDTO,
} from 'utils';
import { LabsTableRow } from './LabsTableRow';

interface LabsTableProps {
  columns: LabsTableColumn[];
  labOrders: (LabOrderDTO<LabOrdersSearchBy> | ReflexLabDTO)[];
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
    testItemStatus,
  }: {
    serviceRequestId: string;
    testItemName: string;
    testItemStatus: ExternalLabsStatus;
  }) => void;
  dataTestId: string;
  allowDelete?: boolean;
  bundleRow?: ReactElement;
  handleRejectedAbn?: (serviceRequestId: string) => Promise<void>;
  followUpAppointmentLookup?: FollowUpAppointmentLookup;
}

export const LabsTable = ({
  columns,
  labOrders,
  dataTestId,
  allowDelete,
  showDeleteLabOrderDialog,
  bundleRow,
  handleRejectedAbn,
  followUpAppointmentLookup,
}: LabsTableProps): ReactElement => {
  const navigateTo = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const [searchParams] = useSearchParams();
  const encounterIdParam = searchParams.get('encounterId');

  const buildOrderUrl = (orderAppointmentId: string, urlBuilder: (appointmentId: string) => string): string => {
    if (followUpAppointmentLookup) {
      const { appointmentId, encounterIdQuery } = resolveOrderRoutingFromFollowUpLookup(
        orderAppointmentId,
        followUpAppointmentLookup
      );
      const baseUrl = urlBuilder(appointmentId);
      return encounterIdQuery ? `${baseUrl}?encounterId=${encounterIdQuery}` : baseUrl;
    }
    const appointmentId = appointmentIdFromUrl || orderAppointmentId;
    const baseUrl = urlBuilder(appointmentId);
    return encounterIdParam ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}encounterId=${encounterIdParam}` : baseUrl;
  };

  const onRowClick = (labOrderData: LabOrderListPageDTO): void => {
    navigateTo(
      buildOrderUrl(labOrderData.appointmentId, (apptId) =>
        getExternalLabOrderEditUrl(apptId, labOrderData.serviceRequestId)
      )
    );
  };

  const onRowClickForDrDrivenResult = (result: ReflexLabDTO): void => {
    if (!result.appointmentId || !result.resultsDetails?.[0].diagnosticReportId) {
      console.error(`Unable to navigate to dr result row, missing appointmentId or dr id`, result);
      throw new Error('Unable to navigate to dr result row, missing appointmentId or dr id');
    }
    // todo labs future resultsDetails maybe does not need to be an array anymore
    navigateTo(
      buildOrderUrl(result.appointmentId, (apptId) =>
        getDrExternalLabEditUrl(apptId, result.resultsDetails?.[0].diagnosticReportId ?? '')
      )
    );
  };

  return (
    <TableContainer data-testid={dataTestId} sx={{ border: '1px solid #e0e0e0' }}>
      <Table>
        <TableHead>
          {bundleRow ? bundleRow : null}
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column}
                align="left"
                sx={{
                  fontWeight: 'bold',
                  width: getColumnWidth(column),
                  padding: column === 'testType' && !bundleRow ? '16px 16px' : '8px 16px',
                }}
              >
                {getColumnHeader(column)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {labOrders.map((order, idx) => {
            // reflex and pdf attachment results
            if ('drCentricResultType' in order) {
              return (
                <LabsTableRow
                  key={`${idx}-reflex-${order.resultsDetails?.[0].diagnosticReportId}`}
                  labOrderData={order}
                  onRowClick={() => onRowClickForDrDrivenResult(order)}
                  columns={columns}
                  allowDelete={false}
                />
              );
            } else {
              return (
                <LabsTableRow
                  key={`${idx}-order-${order.serviceRequestId}`}
                  labOrderData={order}
                  onDeleteOrder={() =>
                    showDeleteLabOrderDialog({
                      serviceRequestId: order.serviceRequestId,
                      testItemName: order.testItem,
                      testItemStatus: order.orderStatus,
                    })
                  }
                  onRowClick={() => onRowClick(order)}
                  columns={columns}
                  allowDelete={allowDelete}
                  handleRejectedAbn={handleRejectedAbn}
                />
              );
            }
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
