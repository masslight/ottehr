import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExternalLabOrderEditUrl } from 'src/features/css-module/routing/helpers';
import {
  getColumnHeader,
  getColumnWidth,
  LabOrderDTO,
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  LabsTableColumn,
  ReflexLabDTO,
} from 'utils';
// import { LabsTableColumn } from './LabsTable';
import { LabsTableRow } from './LabsTableRow';

interface LabsTableContainerProps {
  columns: LabsTableColumn[];
  labOrders: LabOrderDTO<LabOrdersSearchBy>[];
  reflexResults: ReflexLabDTO[];
  allowDelete?: boolean;
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  bundleRow?: ReactElement;
}

export const LabsTableContainer = ({
  columns,
  labOrders,
  reflexResults,
  allowDelete,
  showDeleteLabOrderDialog,
  bundleRow,
}: LabsTableContainerProps): ReactElement => {
  const navigateTo = useNavigate();

  const onRowClick = (labOrderData: LabOrderListPageDTO): void => {
    navigateTo(getExternalLabOrderEditUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  // todo SARAH fix this
  const onRowClickForReflex = (result: ReflexLabDTO): void => {
    console.log('result', result);
    // if (!appointmentId) return;
    // // todo future resultsDetails maybe does not need to be an array anymore
    // navigateTo(getReflexExternalLabEditUrl(appointmentId, result.resultsDetails?.[0].diagnosticReportId));
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
          {labOrders.map((order) => (
            <LabsTableRow
              key={order.serviceRequestId}
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
            />
          ))}
          {reflexResults.map((result, idx) => (
            <LabsTableRow
              key={`${idx}-reflex-${result.resultsDetails?.[0].diagnosticReportId}`}
              labOrderData={result}
              onDeleteOrder={() => console.log('you cannot delete a reflex result')} // todo later, make this better
              onRowClick={() => onRowClickForReflex(result)}
              columns={columns}
              allowDelete={allowDelete}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
