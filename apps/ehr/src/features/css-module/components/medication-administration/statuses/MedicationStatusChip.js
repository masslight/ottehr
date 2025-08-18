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
exports.MedicationStatusChip = exports.statusColors = void 0;
var ArrowDropDown_1 = require("@mui/icons-material/ArrowDropDown");
var material_1 = require("@mui/material");
var react_1 = require("react");
var styled_components_1 = require("styled-components");
var utils_1 = require("utils");
var useMedicationManagement_1 = require("../../../hooks/useMedicationManagement");
var StyledChip = (0, styled_components_1.default)(material_1.Chip)(function () { return ({
    borderRadius: '8px',
    padding: '0 9px',
    margin: 0,
    height: '24px',
    '& .MuiChip-label': {
        padding: 0,
        fontWeight: 'bold',
        fontSize: '12px',
    },
    '& .MuiChip-icon': {
        marginLeft: 'auto',
        marginRight: '-4px',
        order: 1,
    },
}); });
var StatusMenuItem = (0, styled_components_1.default)(material_1.MenuItem)({
    padding: 0,
    '& .MuiChip-root': {
        width: '100%',
        borderRadius: '4px',
        justifyContent: 'flex-start',
    },
});
exports.statusColors = {
    pending: { bg: '#f1f2f6', text: '#616161' },
    'administered-partly': { bg: '#B2EBF2', text: '#006064' },
    'administered-not': { bg: '#FECDD2', text: '#B71C1C' },
    administered: { bg: '#C8E6C9', text: '#1B5E20' },
    cancelled: { bg: '#FFFFFF', text: '#616161', border: '#BFC2C6' },
};
var MedicationStatusChip = function (_a) {
    var _b;
    var medication = _a.medication, onClick = _a.onClick, currentStatus = _a.status, _c = _a.isEditable, isEditable = _c === void 0 ? false : _c;
    var getAvailableStatuses = (0, useMedicationManagement_1.useMedicationManagement)().getAvailableStatuses;
    var _d = (0, react_1.useState)(null), anchorEl = _d[0], setAnchorEl = _d[1];
    var status = ((_b = currentStatus !== null && currentStatus !== void 0 ? currentStatus : medication === null || medication === void 0 ? void 0 : medication.status) !== null && _b !== void 0 ? _b : 'pending');
    var chipColors = exports.statusColors[status] || { bg: '#F5F5F5', text: '#757575' };
    var handleClick = function (event) {
        if (isEditable && onClick) {
            setAnchorEl(event.currentTarget);
        }
    };
    var handleClosePopover = function () {
        setAnchorEl(null);
    };
    var handleStatusClick = function (newStatus) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (onClick) {
                void onClick(newStatus);
                handleClosePopover();
            }
            return [2 /*return*/];
        });
    }); };
    var availableStatuses = onClick ? getAvailableStatuses(medication === null || medication === void 0 ? void 0 : medication.status) : [];
    var formatReason = function (reason) {
        if (!reason)
            return '';
        return reason.replace(/-/g, ' ');
    };
    return (<>
      <material_1.Stack direction="column" spacing={1} sx={{ width: 'fit-content' }}>
        <StyledChip label={utils_1.medicationStatusDisplayLabelMap[status] || status} onClick={handleClick} icon={isEditable && onClick ? <ArrowDropDown_1.default /> : undefined} sx={{
            backgroundColor: chipColors.bg,
            color: chipColors.text,
            border: chipColors.border ? "1px solid ".concat(chipColors.border) : 'none',
            '& .MuiSvgIcon-root': {
                color: 'inherit',
                fontSize: '1.2rem',
                margin: '0 -4px 0 2px',
            },
            cursor: isEditable && onClick ? 'pointer' : 'default',
            width: 'fit-content',
        }}/>
        {(medication === null || medication === void 0 ? void 0 : medication.reason) && (<material_1.Typography variant="caption" sx={{
                mt: 0.5,
                color: 'text.secondary',
                fontSize: '0.75rem',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
            }}>
            {formatReason(medication.reason)}
          </material_1.Typography>)}
      </material_1.Stack>
      {isEditable ? (<material_1.Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClosePopover} anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}>
          <material_1.Box sx={{ p: 1 }}>
            {availableStatuses.map(function (status) { return (<StatusMenuItem key={status} onClick={function () { return handleStatusClick(status); }}>
                <material_1.Chip label={status} sx={{
                    my: 0.5,
                    backgroundColor: exports.statusColors[status].bg,
                    color: exports.statusColors[status].text,
                    border: exports.statusColors[status].border ? "1px solid ".concat(exports.statusColors[status].border) : 'none',
                    fontWeight: 'bold',
                    '& .MuiChip-label': {
                        padding: '4px 8px',
                    },
                }}/>
              </StatusMenuItem>); })}
          </material_1.Box>
        </material_1.Popover>) : null}
    </>);
};
exports.MedicationStatusChip = MedicationStatusChip;
//# sourceMappingURL=MedicationStatusChip.js.map