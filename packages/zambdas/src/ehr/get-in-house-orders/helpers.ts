// import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  // InHouseOrderDetailedPageDTO,
  //  InHouseOrderListPageDTO,
  InHouseOrdersSearchBy,
} from 'utils';
import { InHouseOrderDTO } from 'utils';

// // cache for the service request context: contains parsed tasks and results
// type Cache = {
//   parsedResults?: ReturnType<typeof parseResults>;
//   parsedTasks?: ReturnType<typeof parseTasks>;
// };

// type InHouseOrderPDF = {
//   url: string;
//   diagnosticReportId: string;
// };

// export const mapResourcesToInHouseOrderDTOs = <SearchBy extends InHouseOrdersSearchBy>(
//   searchBy: SearchBy
// ): InHouseOrderDTO<SearchBy>[] => {
//   return serviceRequests.map((serviceRequest) => {
//     return parseOrderData({
//       searchBy,
//     });
//   });
// };

export const parseOrderData = <SearchBy extends InHouseOrdersSearchBy>({
  _searchBy,
}: {
  _searchBy: SearchBy;
}): InHouseOrderDTO<SearchBy> => {
  // if (!serviceRequest.id) {
  //   throw new Error('ServiceRequest ID is required');
  // }

  // const listPageDTO: InHouseOrderListPageDTO = {};

  // if (searchBy.searchBy.field === 'serviceRequestId') {
  //   const detailedPageDTO: InHouseOrderDetailedPageDTO = {};

  //   return detailedPageDTO as InHouseOrderDTO<SearchBy>;
  // }

  return {} as InHouseOrderDTO<SearchBy>;
};
