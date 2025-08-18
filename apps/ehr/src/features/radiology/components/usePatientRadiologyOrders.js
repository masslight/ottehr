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
exports.usePatientRadiologyOrders = void 0;
var react_1 = require("react");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useDeleteRadiologyOrderDialog_1 = require("./useDeleteRadiologyOrderDialog");
var usePatientRadiologyOrders = function (options) {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    // Memoize options to prevent unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    var memoizedOptions = (0, react_1.useMemo)(function () { return options; }, [JSON.stringify(options)]);
    var _a = (0, react_1.useState)([]), orders = _a[0], setOrders = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(1), totalPages = _d[0], setTotalPages = _d[1];
    var _e = (0, react_1.useState)(1), page = _e[0], setPage = _e[1];
    var _f = (0, react_1.useState)(false), showPagination = _f[0], setShowPagination = _f[1];
    var getCurrentSearchParamsWithoutPageIndex = (0, react_1.useCallback)(function () {
        var params = {};
        var patientId = memoizedOptions.patientId, encounterIds = memoizedOptions.encounterIds, serviceRequestId = memoizedOptions.serviceRequestId;
        if (patientId) {
            params.patientId = patientId;
        }
        if (encounterIds) {
            params.encounterIds = encounterIds;
        }
        if (serviceRequestId) {
            params.serviceRequestId = serviceRequestId;
        }
        return params;
    }, [memoizedOptions]);
    var getCurrentSearchParamsForPage = (0, react_1.useCallback)(function (pageNumber) {
        if (pageNumber < 1) {
            throw Error('Page number must be greater than 0');
        }
        return __assign(__assign({}, getCurrentSearchParamsWithoutPageIndex()), { pageIndex: pageNumber - 1 });
    }, [getCurrentSearchParamsWithoutPageIndex]);
    var fetchOrders = (0, react_1.useCallback)(function (searchParams) { return __awaiter(void 0, void 0, void 0, function () {
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
                    return [4 /*yield*/, (0, api_1.getRadiologyOrders)(oystehrZambda, searchParams)];
                case 3:
                    response = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    response = {
                        data: [],
                        pagination: utils_1.EMPTY_PAGINATION,
                    };
                    console.error('Error fetching lab orders:', err_1);
                    setError(err_1 instanceof Error ? err_1 : new Error('Unknown error occurred'));
                    return [3 /*break*/, 5];
                case 5:
                    if (response === null || response === void 0 ? void 0 : response.orders) {
                        setOrders(response.orders);
                        if (response.pagination) {
                            setTotalPages(response.pagination.totalPages || 1);
                            setShowPagination(response.pagination.totalPages > 1);
                        }
                        else {
                            setTotalPages(1);
                            setShowPagination(false);
                        }
                    }
                    else {
                        setOrders([]);
                        setTotalPages(1);
                        setShowPagination(false);
                    }
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _a.sent();
                    console.error('error with setting lab orders:', error_1);
                    setError(error_1 instanceof Error ? error_1 : new Error('Unknown error occurred'));
                    setOrders([]);
                    setTotalPages(1);
                    setShowPagination(false);
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda]);
    // initial fetch of lab orders
    (0, react_1.useEffect)(function () {
        var searchParams = getCurrentSearchParamsForPage(1);
        var encounterIdsHasValue = false;
        if (searchParams.encounterIds) {
            if (Array.isArray(searchParams.encounterIds)) {
                // we don't want to call this until there are values in the array
                encounterIdsHasValue = searchParams.encounterIds.length > 0;
            }
            else {
                encounterIdsHasValue = true;
            }
        }
        if (searchParams.patientId || encounterIdsHasValue || searchParams.serviceRequestId) {
            void fetchOrders(searchParams);
        }
    }, [fetchOrders, getCurrentSearchParamsForPage]);
    var didOrdersFetch = orders.length > 0;
    // fetch orders when the page changes
    (0, react_1.useEffect)(function () {
        // skip if the orders haven't been fetched yet, to prevent fetching when the page is first loaded
        if (didOrdersFetch) {
            var searchParams = getCurrentSearchParamsForPage(page);
            void fetchOrders(searchParams);
        }
    }, [fetchOrders, getCurrentSearchParamsForPage, didOrdersFetch, page]);
    var handleDeleteOrder = (0, react_1.useCallback)(function (params) { return __awaiter(void 0, void 0, void 0, function () {
        var serviceRequestId, searchParams, err_2, errorObj;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    serviceRequestId = params.serviceRequestId;
                    if (!serviceRequestId) {
                        console.error('Cannot cancel order: Missing order ID');
                        setError(new Error('Missing order ID'));
                        return [2 /*return*/, false];
                    }
                    if (!oystehrZambda) {
                        console.error('Cannot delete order: API client is not available');
                        setError(new Error('API client is not available'));
                        return [2 /*return*/, false];
                    }
                    setLoading(true);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, api_1.cancelRadiologyOrder)(oystehrZambda, params)];
                case 2:
                    _a.sent();
                    setPage(1);
                    searchParams = getCurrentSearchParamsForPage(1);
                    return [4 /*yield*/, fetchOrders(searchParams)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, true];
                case 4:
                    err_2 = _a.sent();
                    console.error('Error deleting radiology order:', err_2);
                    errorObj = err_2 instanceof Error ? err_2 : new Error(typeof err_2 === 'string' ? err_2 : 'Failed to delete lab order');
                    setError(errorObj);
                    return [2 /*return*/, false];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [fetchOrders, getCurrentSearchParamsForPage, oystehrZambda]);
    // handle delete dialog
    var _g = (0, useDeleteRadiologyOrderDialog_1.useDeleteRadiologyOrderDialog)({
        deleteOrder: handleDeleteOrder,
    }), showDeleteRadiologyOrderDialog = _g.showDeleteRadiologyOrderDialog, DeleteOrderDialog = _g.DeleteOrderDialog;
    return {
        orders: orders,
        loading: loading,
        error: error,
        totalPages: totalPages,
        page: page,
        setPage: setPage,
        fetchOrders: fetchOrders,
        showPagination: showPagination,
        deleteOrder: handleDeleteOrder,
        showDeleteRadiologyOrderDialog: showDeleteRadiologyOrderDialog,
        DeleteOrderDialog: DeleteOrderDialog,
        getCurrentSearchParams: getCurrentSearchParamsWithoutPageIndex,
    };
};
exports.usePatientRadiologyOrders = usePatientRadiologyOrders;
//# sourceMappingURL=usePatientRadiologyOrders.js.map