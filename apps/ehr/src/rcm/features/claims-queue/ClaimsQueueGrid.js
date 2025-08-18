"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimsQueueGrid = void 0;
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var hooks_1 = require("../../hooks");
var state_1 = require("../../state");
var utils_1 = require("../../utils");
var ClaimsQueueGrid = function (props) {
    var type = props.type;
    var apiClient = (0, hooks_1.useOystehrAPIClient)();
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimsQueueStore, ['pageSize', 'selectedRows']), pageSize = _a.pageSize, selectedRows = _a.selectedRows;
    var _b = (0, state_1.useGetClaims)({
        apiClient: apiClient,
        onSuccess: function (data) {
            state_1.useClaimsQueueStore.setState({ items: data.items });
        },
    }), data = _b.data, isFetching = _b.isFetching;
    return (<x_data_grid_pro_1.DataGridPro checkboxSelection disableRowSelectionOnClick paginationMode="server" loading={isFetching} pagination disableColumnMenu rowCount={(data === null || data === void 0 ? void 0 : data.count) || -1} pageSizeOptions={[5, 10, 15, 25, 50]} paginationModel={{
            pageSize: pageSize || 25,
            page: ((data === null || data === void 0 ? void 0 : data.offset) || 0) / (pageSize || 25),
        }} onPaginationModelChange={function (_a) {
            var page = _a.page, pageSize = _a.pageSize;
            return state_1.useClaimsQueueStore.setState({ offset: page * pageSize, pageSize: pageSize });
        }} rowSelectionModel={selectedRows} onRowSelectionModelChange={function (selectedRows) {
            return state_1.useClaimsQueueStore.setState({ selectedRows: selectedRows });
        }} autoHeight columns={utils_1.mapClaimTypeToColumnNames[type].map(function (column) { return utils_1.ClaimsQueueColumns[column]; })} rows={(data === null || data === void 0 ? void 0 : data.items) || []}/>);
};
exports.ClaimsQueueGrid = ClaimsQueueGrid;
//# sourceMappingURL=ClaimsQueueGrid.js.map