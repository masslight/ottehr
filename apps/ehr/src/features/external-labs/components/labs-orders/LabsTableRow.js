"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabsTableRow = void 0;
var colors_1 = require("@ehrTheme/colors");
var DeleteOutlined_1 = require("@mui/icons-material/DeleteOutlined");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var ExternalLabsStatusChip_1 = require("../ExternalLabsStatusChip");
var LabsTableRow = function (_a) {
    var labOrderData = _a.labOrderData, onDeleteOrder = _a.onDeleteOrder, columns = _a.columns, _b = _a.allowDelete, allowDelete = _b === void 0 ? false : _b, onRowClick = _a.onRowClick;
    var theme = (0, material_1.useTheme)();
    var handleDeleteClick = function (e) {
        e.stopPropagation();
        if (onDeleteOrder) {
            onDeleteOrder();
        }
    };
    var renderCellContent = function (column) {
        var _a, _b;
        switch (column) {
            case 'testType':
                return (<material_1.Box>
            <material_1.Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItem}</material_1.Box>
            {(labOrderData.reflexResultsCount || 0) > 0 && (<material_1.Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                + {labOrderData.reflexResultsCount} Reflex results
              </material_1.Box>)}
          </material_1.Box>);
            case 'visit':
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.visitDate, labOrderData.encounterTimezone)}</material_1.Box>;
            case 'orderAdded':
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.orderAddedDate, labOrderData.encounterTimezone)}</material_1.Box>;
            case 'provider':
                return labOrderData.orderingPhysician || '';
            case 'dx': {
                var firstDx = ((_a = labOrderData.diagnosesDTO[0]) === null || _a === void 0 ? void 0 : _a.display) || '';
                var firstDxCode = ((_b = labOrderData.diagnosesDTO[0]) === null || _b === void 0 ? void 0 : _b.code) || '';
                var firstDxText = "".concat(firstDxCode, " ").concat(firstDx);
                var fullDxText = labOrderData.diagnosesDTO.map(function (dx) { return "".concat(dx.code, " ").concat(dx.display); }).join('; ');
                var dxCount = labOrderData.diagnosesDTO.length;
                if (dxCount > 1) {
                    return (<material_1.Tooltip title={fullDxText} arrow placement="top">
              <material_1.Typography variant="body2">
                {firstDxText}; <span style={{ color: theme.palette.text.secondary }}>+ {dxCount - 1} more</span>
              </material_1.Typography>
            </material_1.Tooltip>);
                }
                return <material_1.Typography variant="body2">{firstDxText}</material_1.Typography>;
            }
            case 'resultsReceived':
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.lastResultReceivedDate, labOrderData.encounterTimezone)}</material_1.Box>;
            case 'accessionNumber':
                return labOrderData.accessionNumbers.join(', ');
            case 'status':
                return <ExternalLabsStatusChip_1.LabsOrderStatusChip status={labOrderData.orderStatus}/>;
            case 'psc':
                return labOrderData.isPSC ? utils_1.PSC_LOCALE : '';
            case 'actions':
                if (allowDelete && labOrderData.orderStatus === 'pending') {
                    return (<material_1.Button onClick={handleDeleteClick} sx={{
                            textTransform: 'none',
                            borderRadius: 28,
                            fontWeight: 'bold',
                        }}>
              <DeleteOutlined_1.default sx={{ color: colors_1.otherColors.priorityHighText }}/>
            </material_1.Button>);
                }
                return null;
            default:
                return null;
        }
    };
    return (<material_1.TableRow sx={{
            '&:hover': { backgroundColor: '#f5f5f5' },
            cursor: 'pointer',
        }} onClick={onRowClick}>
      {columns.map(function (column) { return (<material_1.TableCell key={column}>{renderCellContent(column)}</material_1.TableCell>); })}
    </material_1.TableRow>);
};
exports.LabsTableRow = LabsTableRow;
//# sourceMappingURL=LabsTableRow.js.map