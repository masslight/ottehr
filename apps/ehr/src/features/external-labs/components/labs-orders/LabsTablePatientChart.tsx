import { Box, Button, Pagination, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { LabOrdersSearchBy, LabsTableColumn } from 'utils';
import { LabOrderLoading } from './LabOrderLoading';
import { LabsTableContainer } from './LabsTableContainer';
import { usePatientLabOrders } from './usePatientLabOrders';

type LabsTablePatientChartProps<SearchBy extends LabOrdersSearchBy> = {
  searchBy: SearchBy;
  columns: LabsTableColumn[];
  allowDelete: boolean;
  allowSubmit: boolean;
  onCreateOrder?: () => void;
};

export const LabsTablePatientChart = <SearchBy extends LabOrdersSearchBy>({
  searchBy,
  columns,
  allowDelete,
  allowSubmit,
  onCreateOrder,
}: LabsTablePatientChartProps<SearchBy>): ReactElement => {
  const {
    groupedLabOrdersForChartTable, // includes reflex
    loading,
    totalPages,
    page,
    setSearchParams,
    showPagination,
    error: fetchError,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    fetchLabOrders,
    handleRejectedAbn,
  } = usePatientLabOrders(searchBy);

  if (loading) {
    return <LabOrderLoading />;
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setSearchParams({ pageNumber: value });
  };

  const bundlesWithResults = groupedLabOrdersForChartTable
    ? Object.values(groupedLabOrdersForChartTable.hasResults).flatMap((bundleOrder) => [...bundleOrder.orders])
    : [];

  if (fetchError) {
    return (
      <>
        <Typography color="error" variant="body1" gutterBottom>
          {fetchError.message || 'Failed to fetch external lab orders. Please try again later.'}
        </Typography>
        {onCreateOrder && (
          <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
            Add New External Lab
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {loading && <LabOrderLoading />}

      <Box sx={{ width: '100%' }}>
        {!groupedLabOrdersForChartTable ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" gutterBottom>
              No External Lab Orders to display
            </Typography>
            {onCreateOrder && (
              <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
                Add New External Lab
              </Button>
            )}
          </Box>
        ) : (
          <>
            {Object.entries(groupedLabOrdersForChartTable.pendingActionOrResults).map(
              ([requisitionNumber, orderBundle], idx) => (
                <LabsTableContainer
                  key={`order-bundle-${idx}`}
                  labOrders={orderBundle.orders}
                  orderBundleName={orderBundle.bundleName}
                  requisitionNumber={requisitionNumber}
                  orderBundleNote={orderBundle.bundleNote}
                  abnPdfUrl={orderBundle.abnPdfUrl}
                  orderPdfUrl={orderBundle.orderPdfUrl}
                  searchBy={searchBy}
                  columns={columns}
                  allowDelete={allowDelete}
                  allowSubmit={allowSubmit}
                  fetchLabOrders={fetchLabOrders}
                  showDeleteLabOrderDialog={showDeleteLabOrderDialog}
                  DeleteOrderDialog={DeleteOrderDialog}
                  handleRejectedAbn={handleRejectedAbn}
                />
              )
            )}
            {bundlesWithResults.length > 0 && (
              <LabsTableContainer
                key={`orders-with-results`}
                labOrders={bundlesWithResults}
                orderBundleName="Results"
                abnPdfUrl={undefined}
                orderPdfUrl={undefined}
                searchBy={searchBy}
                columns={columns}
                allowDelete={false}
                allowSubmit={false}
                fetchLabOrders={fetchLabOrders}
                showDeleteLabOrderDialog={showDeleteLabOrderDialog}
                DeleteOrderDialog={DeleteOrderDialog}
              />
            )}
            {showPagination && totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2, width: '100%' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  sx={{
                    '& .MuiPaginationItem-root.Mui-selected': {
                      backgroundColor: 'grey.300',
                      '&:hover': {
                        backgroundColor: 'grey.400',
                      },
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </>
  );
};
