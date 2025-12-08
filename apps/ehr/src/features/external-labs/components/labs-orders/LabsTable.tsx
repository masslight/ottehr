import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDrExternalLabEditUrl, getExternalLabOrderEditUrl } from 'src/features/visits/in-person/routing/helpers';
import {
  getColumnHeader,
  getColumnWidth,
  LabOrderDTO,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  PdfAttachmentDTO,
  ReflexLabDTO,
} from 'utils';
import { LabsTableRow } from './LabsTableRow';

interface LabsTableProps {
  columns: LabsTableColumn[];
  labOrders: (LabOrderDTO<LabOrdersSearchBy> | ReflexLabDTO | PdfAttachmentDTO)[];
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  allowDelete?: boolean;
  bundleRow?: ReactElement;
  handleRejectedAbn?: (serviceRequestId: string) => Promise<void>;
}

export const LabsTable = ({
  columns,
  labOrders,
  allowDelete,
  showDeleteLabOrderDialog,
  bundleRow,
  handleRejectedAbn,
}: LabsTableProps): ReactElement => {
  const navigateTo = useNavigate();

  const onRowClick = (labOrderData: LabOrderListPageDTO): void => {
    navigateTo(getExternalLabOrderEditUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  const onRowClickForDrDrivenResult = (result: ReflexLabDTO | PdfAttachmentDTO): void => {
    if (!result.appointmentId || result.resultsDetails?.[0].diagnosticReportId) {
      console.error(`Unable to navigate to dr result row, missing appointmentId or dr id`, result);
      throw new Error('Unable to navigate to dr result row, missing appointmentId or dr id');
    }
    // todo labs future resultsDetails maybe does not need to be an array anymore
    navigateTo(getDrExternalLabEditUrl(result.appointmentId, result.resultsDetails?.[0].diagnosticReportId));
  };

  return (
    <TableContainer sx={{ border: '1px solid #e0e0e0' }}>
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
