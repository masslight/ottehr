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
exports.useUpdateNursingOrder = exports.useGetNursingOrders = void 0;
var react_1 = require("react");
var api_1 = require("src/api/api");
var useAppClients_1 = require("../../../../hooks/useAppClients");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetNursingOrders = function (_a) {
    var searchBy = _a.searchBy;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)([]), nursingOrders = _b[0], setNursingOrders = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    // Memoize searchBy to prevent unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    var memoizedSearchBy = (0, react_1.useMemo)(function () { return searchBy; }, [JSON.stringify(searchBy)]);
    var fetchNursingOrders = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, err_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehrZambda) {
                        console.error('oystehrZambda is not defined');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    response = void 0;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, api_1.getNursingOrders)(oystehrZambda, { searchBy: memoizedSearchBy })];
                case 3:
                    response = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    console.error('Error fetching nursing orders:', err_1);
                    setError(err_1 instanceof Error ? err_1 : new Error('Unknown error occurred'));
                    return [3 /*break*/, 5];
                case 5:
                    if (response === null || response === void 0 ? void 0 : response.data) {
                        setNursingOrders(response.data);
                    }
                    else {
                        setNursingOrders([]);
                    }
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _a.sent();
                    console.error('error with setting nursing orders:', error_1);
                    setError(error_1 instanceof Error ? error_1 : new Error('Unknown error occurred'));
                    setNursingOrders([]);
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda, memoizedSearchBy]);
    // Initial fetch of nursing orders
    (0, react_1.useEffect)(function () {
        if (!(memoizedSearchBy === null || memoizedSearchBy === void 0 ? void 0 : memoizedSearchBy.value) || (Array.isArray(memoizedSearchBy.value) && memoizedSearchBy.value.length === 0)) {
            console.log('search values loading');
            return;
        }
        else {
            void fetchNursingOrders();
        }
    }, [fetchNursingOrders, memoizedSearchBy]);
    return {
        nursingOrders: nursingOrders,
        loading: loading,
        error: error,
        fetchNursingOrders: fetchNursingOrders,
    };
};
exports.useGetNursingOrders = useGetNursingOrders;
var useUpdateNursingOrder = function (_a) {
    var serviceRequestId = _a.serviceRequestId, action = _a.action;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var updateNursingOrder = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_2, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehrZambda) {
                        console.error('oystehrZambda is not defined');
                        return [2 /*return*/];
                    }
                    if (!serviceRequestId) {
                        console.warn('ServiceRequestId is undefined — skipping update.');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, api_1.updateNursingOrder)(oystehrZambda, { serviceRequestId: serviceRequestId, action: action })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    console.error('Error updating nursing order:', err_2);
                    setError(err_2 instanceof Error ? err_2 : new Error('Unknown error occurred'));
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 8];
                case 6:
                    error_2 = _a.sent();
                    console.error('error with setting nursing order:', error_2);
                    setError(error_2 instanceof Error ? error_2 : new Error('Unknown error occurred'));
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda, serviceRequestId, action]);
    return {
        loading: loading,
        error: error,
        updateNursingOrder: updateNursingOrder,
    };
};
exports.useUpdateNursingOrder = useUpdateNursingOrder;
//# sourceMappingURL=useNursingOrders.js.map