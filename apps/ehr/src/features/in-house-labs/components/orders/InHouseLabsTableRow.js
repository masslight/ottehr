"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabsTableRow = void 0;
var colors_1 = require("@ehrTheme/colors");
var DeleteOutlined_1 = require("@mui/icons-material/DeleteOutlined");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var InHouseLabsStatusChip_1 = require("../InHouseLabsStatusChip");
var InHouseLabsTableRow = function (_a) {
    var labOrderData = _a.labOrderData, columns = _a.columns, onRowClick = _a.onRowClick, allowDelete = _a.allowDelete, onDeleteOrder = _a.onDeleteOrder;
    var theme = (0, material_1.useTheme)();
    var renderCellContent = function (column) {
        var _a, _b;
        switch (column) {
            case 'testType':
                return (<material_1.Box>
            <material_1.Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItemName}</material_1.Box>
          </material_1.Box>);
            case 'visit':
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.visitDate, labOrderData.timezone)}</material_1.Box>;
            case 'orderAdded':
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.orderAddedDate, labOrderData.timezone)}</material_1.Box>;
            case 'provider':
                return labOrderData.orderingPhysicianFullName || '';
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
                return <material_1.Box>{(0, utils_1.formatDateForLabs)(labOrderData.resultReceivedDate || '-', labOrderData.timezone)}</material_1.Box>;
            case 'status':
                return <InHouseLabsStatusChip_1.InHouseLabsStatusChip status={labOrderData.status}/>;
            case 'actions':
                if (allowDelete && labOrderData.status === 'ORDERED') {
                    return (<material_1.Button onClick={function (e) {
                            e.stopPropagation();
                            onDeleteOrder === null || onDeleteOrder === void 0 ? void 0 : onDeleteOrder();
                        }} sx={{
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
exports.InHouseLabsTableRow = InHouseLabsTableRow;
//# sourceMappingURL=InHouseLabsTableRow.js.map