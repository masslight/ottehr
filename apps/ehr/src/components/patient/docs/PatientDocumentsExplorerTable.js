"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDocumentsExplorerTable = exports.DocumentTableActionType = void 0;
// import ErrorIcon from '@mui/icons-material/Error';
var Download_1 = require("@mui/icons-material/Download");
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var luxon_1 = require("luxon");
var react_1 = require("react");
var formatDateTime_1 = require("../../../helpers/formatDateTime");
var DocumentTableActionType;
(function (DocumentTableActionType) {
    DocumentTableActionType["ActionDownload"] = "ActionDownload";
})(DocumentTableActionType || (exports.DocumentTableActionType = DocumentTableActionType = {}));
var DocActionsCell = function (_a) {
    var docInfo = _a.docInfo, actions = _a.actions;
    var isActionAllowed = actions.isActionAllowed, onDocumentDownload = actions.onDocumentDownload;
    var theme = (0, material_1.useTheme)();
    var lineColor = theme.palette.primary.main;
    var handleDocDownload = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onDocumentDownload(docInfo.id)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [docInfo.id, onDocumentDownload]);
    return (<material_2.Box sx={{
            display: 'flex',
            flexDirection: 'row',
        }}>
      {/* <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
          TODO
        </Typography>
        DownloadIcon
        <ErrorIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', color: lineColor }} /> */}

      {isActionAllowed(docInfo.id, DocumentTableActionType.ActionDownload) && (<material_1.IconButton aria-label="Download" onClick={handleDocDownload}>
          <Download_1.default fontSize="small" sx={{ verticalAlign: 'middle', color: lineColor }}/>
        </material_1.IconButton>)}

      {/* {isActionAllowed(docInfo.id, DocumentTableActionType.ActionDownload) && (
          <IconButton aria-label="Download" onClick={() => onDocumentDownload(docInfo.id)}>
            <DownloadIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', color: lineColor }} />
          </IconButton>
        )} */}
    </material_2.Box>);
};
var configureTableColumns = function (actions) {
    return [
        {
            sortable: false,
            field: 'docName',
            headerName: 'Doc Name',
            width: 400,
            renderCell: function (_a) {
                var docName = _a.row.docName;
                return docName;
            },
        },
        {
            sortComparator: function (a, b) {
                console.log("[When added] sortComparator() a=".concat(a, " :: b=").concat(b));
                var createdA = luxon_1.DateTime.fromISO(a !== null && a !== void 0 ? a : '');
                var createdB = luxon_1.DateTime.fromISO(b !== null && b !== void 0 ? b : '');
                return createdA.diff(createdB).milliseconds;
            },
            sortable: true,
            field: 'whenAddedDate',
            headerName: 'When added',
            width: 150,
            renderCell: function (_a) {
                var whenAddedDate = _a.row.whenAddedDate;
                return (whenAddedDate ? (0, formatDateTime_1.formatISOStringToDateAndTime)(whenAddedDate) : '-');
            },
        },
        {
            sortable: true,
            field: 'whoAdded',
            headerName: 'Who added',
            width: 150,
            renderCell: function (_a) {
                var whoAdded = _a.row.whoAdded;
                return whoAdded !== null && whoAdded !== void 0 ? whoAdded : '-';
            },
        },
        {
            sortable: false,
            field: 'actions',
            headerName: 'Action',
            width: 150,
            renderCell: function (_a) {
                var row = _a.row;
                return <DocActionsCell docInfo={row} actions={actions}/>;
            },
        },
    ];
};
var PatientDocumentsExplorerTable = function (props) {
    var isLoadingDocs = props.isLoadingDocs, documents = props.documents, documentTableActions = props.documentTableActions;
    var filteredDocs = documents !== null && documents !== void 0 ? documents : [];
    var tableColumns = (0, react_1.useMemo)(function () {
        return configureTableColumns(documentTableActions);
    }, [documentTableActions]);
    return (<x_data_grid_pro_1.DataGridPro rows={filteredDocs} columns={tableColumns} initialState={{
            pagination: {
                paginationModel: {
                    pageSize: 10,
                },
            },
            sorting: {
                sortModel: [{ field: 'whenAdded', sort: 'desc' }],
            },
        }} autoHeight loading={isLoadingDocs} pagination disableColumnMenu pageSizeOptions={[10]} disableRowSelectionOnClick sx={{
            border: 0,
            '.MuiDataGrid-columnHeaderTitle': {
                fontWeight: 500,
            },
        }}/>);
};
exports.PatientDocumentsExplorerTable = PatientDocumentsExplorerTable;
//# sourceMappingURL=PatientDocumentsExplorerTable.js.map