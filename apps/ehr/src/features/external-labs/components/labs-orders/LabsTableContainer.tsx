import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExternalLabOrderEditUrl, getReflexExternalLabEditUrl } from 'src/features/css-module/routing/helpers';
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
  labOrders: (LabOrderDTO<LabOrdersSearchBy> | ReflexLabDTO)[];
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  allowDelete?: boolean;
  bundleRow?: ReactElement;
}

export const LabsTableContainer = ({
  columns,
  labOrders,
  allowDelete,
  showDeleteLabOrderDialog,
  bundleRow,
}: LabsTableContainerProps): ReactElement => {
  const navigateTo = useNavigate();

  const onRowClick = (labOrderData: LabOrderListPageDTO): void => {
    navigateTo(getExternalLabOrderEditUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  const onRowClickForReflex = (result: ReflexLabDTO): void => {
    console.log('result', result);
    // todo future resultsDetails maybe does not need to be an array anymore
    navigateTo(getReflexExternalLabEditUrl(result.appointmentId, result.resultsDetails?.[0].diagnosticReportId));
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
            if ('isReflex' in order) {
              return (
                <LabsTableRow
                  key={`${idx}-reflex-${order.resultsDetails?.[0].diagnosticReportId}`}
                  labOrderData={order}
                  onDeleteOrder={() => console.log('you cannot delete a reflex result')} // todo later, make this better
                  onRowClick={() => onRowClickForReflex(order)}
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
                />
              );
            }
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
