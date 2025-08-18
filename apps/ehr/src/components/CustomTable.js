"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateTimeEqualsOperator = void 0;
exports.default = CustomTable;
var material_1 = require("@mui/material");
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var luxon_1 = require("luxon");
exports.dateTimeEqualsOperator = {
    label: 'DTEquals',
    // cSpell:disable-next dtequals
    value: 'dtequals',
    getApplyFilterFn: function (filterItem) {
        if (!filterItem.field || !filterItem.value || !filterItem.operator) {
            return null;
        }
        return function (params) {
            return luxon_1.DateTime.fromISO(params.value).toISODate() === filterItem.value.toISODate();
        };
    },
    InputComponentProps: { type: luxon_1.DateTime },
};
function CustomTable(_a) {
    var defaultSort = _a.defaultSort, emptyMessage = _a.emptyMessage, filterModel = _a.filterModel, isLoading = _a.isLoading, rows = _a.rows, columns = _a.columns;
    var theme = (0, material_1.useTheme)();
    var emptyTable = function () { return (<material_1.Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
      {emptyMessage}
    </material_1.Box>); };
    return (<x_data_grid_pro_1.DataGridPro autoHeight columnHeaderHeight={52} disableColumnFilter disableColumnMenu filterModel={filterModel} hideFooterSelectedRowCount initialState={{
            pagination: {
                paginationModel: {
                    pageSize: 10,
                    page: 0,
                },
            },
            sorting: { sortModel: [defaultSort] },
        }} loading={isLoading} pageSizeOptions={[10]} rows={rows !== null && rows !== void 0 ? rows : []} columns={columns.map(function (column) { return (__assign(__assign({}, column), { flex: 1 })); })} slots={{
            noRowsOverlay: emptyTable,
            noResultsOverlay: emptyTable,
        }} sx={{
            border: 'none',
            mt: 1.5,
            height: '100%',
            width: '100%',
            '& .MuiDataGrid-columnSeparator': {
                display: 'none',
            },
            '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
                backgroundColor: (0, material_1.alpha)(theme.palette.primary.light, 0.08),
            },
            '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold',
            },
        }}/>);
}
//# sourceMappingURL=CustomTable.js.map