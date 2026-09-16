import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { getColumnHeader, getColumnWidth } from 'utils/lib/helpers/labs/helpers';
import {
  ExternalLabsStatus,
  LabOrderDTO,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  ReflexLabDTO,
} from 'utils/lib/types/data/labs/labs.types';
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
  onRowClick: (labOrderData: LabOrderListPageDTO) => void;
  onDrDrivenRowClick: (result: ReflexLabDTO) => void;
}

export const LabsTable = ({
  columns,
  labOrders,
  dataTestId,
  allowDelete,
  showDeleteLabOrderDialog,
  bundleRow,
  handleRejectedAbn,
  onRowClick,
  onDrDrivenRowClick,
}: LabsTableProps): ReactElement => {
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
                  onRowClick={() => onDrDrivenRowClick(order)}
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
