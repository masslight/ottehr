import ClearIcon from '@mui/icons-material/Clear';
import { Box, Grid, IconButton, Pagination, Paper, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { getColumnHeader, getColumnWidth, LabOrdersSearchBy, LabsTableColumn, OrderableItemSearchResult } from 'utils';
import { LabsAutocompleteForPatient } from '../LabsAutocompleteForPatient';
import { LabOrderLoading } from './LabOrderLoading';
import { LabsTable } from './LabsTable';
import { UnsolicitedLabsTable } from './UnsolicitedLabsTable';
import { usePatientLabOrders } from './usePatientLabOrders';

interface LabsTablePatientRecordProps {
  searchBy: LabOrdersSearchBy;
  titleText: string;
  patientId: string | undefined;
  columns: LabsTableColumn[];
}
export const LabsTablePatientRecord = ({
  searchBy,
  titleText,
  patientId,
  columns,
}: LabsTablePatientRecordProps): ReactElement => {
  const {
    labOrders,
    drDrivenResults,
    loading,
    totalPages,
    page,
    setSearchParams,
    visitDateFilter,
    showPagination,
    // error: fetchError,
    showDeleteLabOrderDialog,
    patientLabItems,
  } = usePatientLabOrders(searchBy);

  const [selectedOrderedItem, setSelectedOrderedItem] = useState<OrderableItemSearchResult | null>(null);
  const [tempDateFilter, setTempDateFilter] = useState(visitDateFilter);

  const submitFilterByDate = (date?: DateTime | null): void => {
    const dateToSet = date || tempDateFilter;
    setSearchParams({ pageNumber: 1, visitDateFilter: dateToSet });
  };

  const handleClearDate = (): void => {
    setTempDateFilter(null);
    setSearchParams({ pageNumber: 1, visitDateFilter: null });
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setSearchParams({ pageNumber: value });
  };

  const handleOrderableItemCodeChange = (value: OrderableItemSearchResult | null): void => {
    setSelectedOrderedItem(value || null);
    setSearchParams({ pageNumber: 1, testTypeFilter: value?.item.itemLoinc || '' });
  };

  return (
    <>
      <Paper
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          mt: 2,
          p: 3,
          position: 'relative',
        }}
      >
        <Typography
          variant="h3"
          color="primary.dark"
          sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}
        >
          {titleText}
        </Typography>

        <Box sx={{ width: '100%' }}>
          {loading ? (
            <LabOrderLoading />
          ) : (
            <>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
                  <Grid item xs={4}>
                    <LabsAutocompleteForPatient
                      patientLabItems={patientLabItems}
                      selectedLabItem={selectedOrderedItem}
                      setSelectedLabItem={handleOrderableItemCodeChange}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <DatePicker
                      label="Visit date"
                      value={tempDateFilter}
                      onChange={setTempDateFilter}
                      onAccept={submitFilterByDate}
                      format="MM/dd/yyyy"
                      slotProps={{
                        textField: (params) => ({
                          ...params,
                          onBlur: () => submitFilterByDate(),
                          fullWidth: true,
                          size: 'small',
                          InputProps: {
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {tempDateFilter && (
                                  <IconButton size="small" onClick={handleClearDate} edge="end">
                                    <ClearIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {params.InputProps?.endAdornment}
                              </>
                            ),
                          },
                        }),
                      }}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>

              {!Array.isArray(labOrders) || labOrders.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" gutterBottom>
                    No External Lab Orders to display
                  </Typography>
                </Box>
              ) : (
                <LabsTable
                  columns={columns}
                  labOrders={[...labOrders, ...drDrivenResults]}
                  allowDelete={false}
                  showDeleteLabOrderDialog={showDeleteLabOrderDialog}
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
      </Paper>
      {patientId && !loading && (
        <UnsolicitedLabsTable
          patientId={patientId}
          columns={columns}
          getColumnHeader={getColumnHeader}
          getColumnWidth={getColumnWidth}
        />
      )}
    </>
  );
};
