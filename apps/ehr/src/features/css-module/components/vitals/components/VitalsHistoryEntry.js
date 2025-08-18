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
exports.VitalHistoryElement = void 0;
var icons_material_1 = require("@mui/icons-material");
var Error_1 = require("@mui/icons-material/Error");
var WarningAmberOutlined_1 = require("@mui/icons-material/WarningAmberOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var DeleteVitalModal_1 = require("../DeleteVitalModal");
var VitalHistoryElement = function (_a) {
    var _b;
    var historyEntry = _a.historyEntry, onDelete = _a.onDelete;
    var theme = (0, material_1.useTheme)();
    var isDeletable = onDelete !== undefined && historyEntry.resourceId !== undefined;
    var _c = (0, react_1.useState)(false), isDeleteModalOpen = _c[0], setIsDeleteModalOpen = _c[1];
    var handleDeleteClick = function () {
        setIsDeleteModalOpen(true);
    };
    var handleCloseDeleteModal = function () {
        setIsDeleteModalOpen(false);
    };
    var hasAuthor = !!historyEntry.authorName && ((_b = historyEntry.authorName) === null || _b === void 0 ? void 0 : _b.length) > 0;
    var lineColor = (function () {
        if (historyEntry.alertCriticality === 'critical')
            return theme.palette.error.main;
        if (historyEntry.alertCriticality === 'abnormal')
            return theme.palette.warning.main;
        return theme.palette.text.primary;
    })();
    var observationMethod = getObservationMethod(historyEntry);
    var observationValueElements = getObservationValueElements(historyEntry, lineColor);
    return (<>
      <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <material_1.Typography color="textPrimary" component="div">
          {(0, utils_1.formatDateTimeToLocalTimezone)(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          {observationValueElements.map(function (value, index) {
            if (typeof value === 'string') {
                return (<material_1.Typography key={index} component="span" sx={{ fontWeight: index === 0 ? 'bold' : 'normal', color: lineColor }}>
                  {value}
                </material_1.Typography>);
            }
            else {
                return __assign(__assign({}, value), { key: index });
            }
        })}
          {historyEntry.alertCriticality === 'critical' && (<Error_1.default fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }}/>)}
          {historyEntry.alertCriticality === 'abnormal' && (<WarningAmberOutlined_1.default fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}/>)}
          {observationMethod && " (".concat(observationMethod, ")")}
        </material_1.Typography>

        {isDeletable && (<material_1.IconButton size="small" aria-label="delete" sx={{ ml: 'auto', color: theme.palette.warning.dark }} onClick={handleDeleteClick}>
            <icons_material_1.DeleteOutlined fontSize="small"/>
          </material_1.IconButton>)}
      </material_1.Box>

      <DeleteVitalModal_1.DeleteVitalModal open={isDeleteModalOpen} onClose={handleCloseDeleteModal} entity={historyEntry} onDelete={function (obs) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, onDelete === null || onDelete === void 0 ? void 0 : onDelete(obs)];
    }); }); }}/>
    </>);
};
exports.VitalHistoryElement = VitalHistoryElement;
var getObservationMethod = function (historyEntry) {
    if (historyEntry.field === 'vital-temperature' ||
        historyEntry.field === 'vital-oxygen-sat' ||
        historyEntry.field === 'vital-heartbeat' ||
        historyEntry.field === 'vital-blood-pressure') {
        return historyEntry.observationMethod;
    }
    return undefined;
};
var getObservationValueElements = function (historyEntry, lineColor) {
    var _a, _b, _c;
    // todo: it would be cool if the units came from the Observation resource
    switch (historyEntry.field) {
        case 'vital-temperature':
            return ["".concat(historyEntry.value, " C")];
        case 'vital-oxygen-sat':
            return ["".concat(historyEntry.value, "%")];
        case 'vital-heartbeat':
            return ["".concat(historyEntry.value, "/min")];
        case 'vital-blood-pressure':
            return ["".concat(historyEntry.systolicPressure, "/").concat(historyEntry.diastolicPressure, " mm Hg")];
        case 'vital-respiration-rate':
            return ["".concat(historyEntry.value, "/min")];
        case 'vital-weight':
            return ["".concat(historyEntry.value, " kg"), " / ".concat((0, utils_1.kgToLbs)(historyEntry.value).toFixed(1), " lb")];
        case 'vital-height':
            return ["".concat(historyEntry.value, " cm"), " / ".concat((0, utils_1.cmToInches)(historyEntry.value).toFixed(0), " in")];
        case 'vital-vision':
            return [
                <>
          <material_1.Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Left eye: {(_a = historyEntry.leftEyeVisionText) !== null && _a !== void 0 ? _a : '-'};&nbsp;
          </material_1.Typography>
          <material_1.Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Right eye: {(_b = historyEntry.rightEyeVisionText) !== null && _b !== void 0 ? _b : '-'};&nbsp;{' '}
            {"".concat((_c = (0, utils_1.getVisionExtraOptionsFormattedString)(historyEntry.extraVisionOptions)) !== null && _c !== void 0 ? _c : '')}
          </material_1.Typography>
        </>,
            ];
        default:
            return [];
    }
};
exports.default = exports.VitalHistoryElement;
//# sourceMappingURL=VitalsHistoryEntry.js.map