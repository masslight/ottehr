"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyTableRow = void 0;
var colors_1 = require("@ehrTheme/colors");
var DeleteOutlined_1 = require("@mui/icons-material/DeleteOutlined");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var RadiologyTableStatusChip_1 = require("./RadiologyTableStatusChip");
var RadiologyTableRow = function (_a) {
    var order = _a.order, onDeleteOrder = _a.onDeleteOrder, columns = _a.columns, _b = _a.allowDelete, allowDelete = _b === void 0 ? false : _b, onRowClick = _a.onRowClick;
    var theme = (0, material_1.useTheme)();
    var handleDeleteClick = function (e) {
        e.stopPropagation();
        if (onDeleteOrder) {
            onDeleteOrder();
        }
    };
    var renderCellContent = function (column) {
        switch (column) {
            case 'studyType':
                return <material_1.Typography variant="body2">{order.studyType}</material_1.Typography>;
            case 'dx': {
                return <material_1.Typography variant="body2">{order.diagnosis}</material_1.Typography>;
            }
            case 'ordered':
                return (<material_1.Box>
            <DateTimeDisplay dateTimeString={order.orderAddedDateTime}/>
            <material_1.Typography variant="body2" sx={{
                        color: 'gray',
                    }}>{"".concat(order.providerName)}</material_1.Typography>
          </material_1.Box>);
            case 'stat':
                if (order.isStat) {
                    return (<material_1.Chip size="small" label="STAT" sx={{
                            borderRadius: '4px',
                            border: 'none',
                            fontWeight: 900,
                            fontSize: '14px',
                            textTransform: 'uppercase',
                            background: theme.palette.error.main,
                            color: 'white',
                            padding: '8px',
                            height: '24px',
                            width: 'fit-content',
                        }} variant="outlined"/>);
                }
                else {
                    return <></>;
                }
            case 'status':
                return <RadiologyTableStatusChip_1.RadiologyTableStatusChip status={order.status}/>;
            case 'actions':
                if (allowDelete && order.status === 'pending') {
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
exports.RadiologyTableRow = RadiologyTableRow;
var DateTimeDisplay = function (_a) {
    var dateTimeString = _a.dateTimeString;
    var dateTimeRegex = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2} [AP]M)$/;
    var formattedDate = (0, utils_1.formatDate)(dateTimeString, 'MM/dd/yyyy hh:mm a');
    var match = formattedDate.match(dateTimeRegex);
    if (!match) {
        return <material_1.Box>{formattedDate}</material_1.Box>;
    }
    var dateStr = match[1], timeStr = match[2];
    return (<material_1.Box>
      <material_1.Typography variant="body2">
        {dateStr}&nbsp;{timeStr}
      </material_1.Typography>
    </material_1.Box>);
};
//# sourceMappingURL=RadiologyTableRow.js.map