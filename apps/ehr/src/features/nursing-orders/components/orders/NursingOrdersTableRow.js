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
exports.NursingOrdersTableRow = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var ottehr_1 = require("../../../../themes/ottehr");
var NursingOrdersStatusChip_1 = require("../NursingOrdersStatusChip");
var useNursingOrders_1 = require("./useNursingOrders");
var NursingOrdersTableRow = function (_a) {
    var nursingOrderData = _a.nursingOrderData, columns = _a.columns, refetchOrders = _a.refetchOrders, onRowClick = _a.onRowClick;
    var updateNursingOrder = (0, useNursingOrders_1.useUpdateNursingOrder)({
        serviceRequestId: nursingOrderData.serviceRequestId,
        action: 'CANCEL ORDER',
    }).updateNursingOrder;
    var handleCancel = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, updateNursingOrder()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error cancelling nursing order:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var formatDate = function (datetime) {
        if (!datetime || !luxon_1.DateTime.fromISO(datetime).isValid)
            return '';
        return luxon_1.DateTime.fromISO(datetime).setZone(nursingOrderData.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
    };
    var renderCellContent = function (column) {
        switch (column) {
            case 'order':
                return (<material_1.Box>
            <material_1.Box style={{ whiteSpace: 'pre-line' }}>{nursingOrderData.note}</material_1.Box>
          </material_1.Box>);
            case 'orderAdded':
                return (<material_1.Box>
            <material_1.Box>{formatDate(nursingOrderData.orderAddedDate)}</material_1.Box>
            <material_1.Box sx={{ opacity: '60%' }}>{nursingOrderData.orderingPhysician}</material_1.Box>
          </material_1.Box>);
            case 'status':
                return (<material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {nursingOrderData.status && <NursingOrdersStatusChip_1.NursingOrdersStatusChip status={nursingOrderData.status}/>}
            {nursingOrderData.status === 'pending' && (<material_1.IconButton onClick={function (event) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        event.stopPropagation();
                                        return [4 /*yield*/, handleCancel()];
                                    case 1:
                                        _a.sent();
                                        refetchOrders();
                                        return [2 /*return*/];
                                }
                            });
                        }); }}>
                <img alt="delete icon" src={ottehr_1.deleteIcon} width={18}/>
              </material_1.IconButton>)}
          </material_1.Box>);
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
exports.NursingOrdersTableRow = NursingOrdersTableRow;
//# sourceMappingURL=NursingOrdersTableRow.js.map