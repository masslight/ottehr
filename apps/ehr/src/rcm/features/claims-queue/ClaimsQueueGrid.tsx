import { DataGridPro } from '@mui/x-data-grid-pro';
import { FC } from 'react';
import { ClaimsQueueType } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useOystehrAPIClient } from '../../hooks';
import { useClaimsQueueStore, useGetClaims } from '../../state';
import { ClaimsQueueColumns, mapClaimTypeToColumnNames } from '../../utils';

type ClaimsQueueGridProps = {
  type: ClaimsQueueType;
};

export const ClaimsQueueGrid: FC<ClaimsQueueGridProps> = (props) => {
  const { type } = props;

  const apiClient = useOystehrAPIClient();
  const { pageSize, selectedRows } = getSelectors(useClaimsQueueStore, ['pageSize', 'selectedRows']);
  const { data, isFetching } = useGetClaims({
    apiClient,
    onSuccess: (data) => {
      useClaimsQueueStore.setState({ items: data.items });
    },
  });

  return (
    <DataGridPro
      checkboxSelection
      disableRowSelectionOnClick
      paginationMode="server"
      loading={isFetching}
      pagination
      disableColumnMenu
      rowCount={data?.count || -1}
      pageSizeOptions={[5, 10, 15, 25, 50]}
      paginationModel={{
        pageSize: pageSize || 25,
        page: (data?.offset || 0) / (pageSize || 25),
      }}
      onPaginationModelChange={({ page, pageSize }) =>
        useClaimsQueueStore.setState({ offset: page * pageSize, pageSize })
      }
      rowSelectionModel={selectedRows}
      onRowSelectionModelChange={(selectedRows) =>
        useClaimsQueueStore.setState({ selectedRows: selectedRows as string[] })
      }
      autoHeight
      columns={mapClaimTypeToColumnNames[type].map((column) => ClaimsQueueColumns[column])}
      rows={data?.items || []}
    />
  );
};
