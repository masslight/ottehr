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
exports.useInHouseLabOrders = void 0;
var react_1 = require("react");
var feature_flags_1 = require("src/constants/feature-flags");
var useDeleteCommonLabOrderDialog_1 = require("src/features/common/useDeleteCommonLabOrderDialog");
var utils_1 = require("utils");
var api_1 = require("../../../../api/api");
var useAppClients_1 = require("../../../../hooks/useAppClients");
var useInHouseLabOrders = function (_searchBy) {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _a = (0, react_1.useState)([]), labOrders = _a[0], setLabOrders = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(1), totalPages = _d[0], setTotalPages = _d[1];
    var _e = (0, react_1.useState)(0), totalItems = _e[0], setTotalItems = _e[1];
    /**
     * Search state management strategy:
     *
     * Page: object in useState to force useEffect re-runs even with same value
     * Filters: refs to avoid re-renders when setting multiple filters and to get updated values synchronously
     *
     * Benefits:
     * - Single useEffect handles all search logic (page + searchBy dependencies)
     * - Filters can be set independently without triggering fetches
     * - Page changes are the only fetch trigger (predictable data flow)
     * - Simplified API: one setSearchParams method for everything
     */
    var _f = (0, react_1.useState)({ pageNumber: 1 }), page = _f[0], setPage = _f[1];
    var testTypeFilterRef = (0, react_1.useRef)('');
    var visitDateFilterRef = (0, react_1.useRef)(null);
    var _g = (0, react_1.useState)(false), showPagination = _g[0], setShowPagination = _g[1];
    // calling without arguments will refetch the data with the current search params
    var setSearchParams = (0, react_1.useCallback)(function (searchParams) {
        if (searchParams.testTypeFilter !== undefined) {
            testTypeFilterRef.current = searchParams.testTypeFilter;
        }
        if (searchParams.visitDateFilter !== undefined) {
            visitDateFilterRef.current = searchParams.visitDateFilter;
        }
        setPage(function (page) { return ({ pageNumber: searchParams.pageNumber || page.pageNumber }); });
    }, []);
    // Memoize searchBy to prevent unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    var memoizedSearchBy = (0, react_1.useMemo)(function () { return _searchBy; }, [JSON.stringify(_searchBy)]);
    var fetchLabOrders = (0, react_1.useCallback)(function (searchParams) { return __awaiter(void 0, void 0, void 0, function () {
        var response, fetchError_1, errorMessage;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED !== true) {
                        return [2 /*return*/];
                    }
                    if (!oystehrZambda) {
                        console.error('oystehrZambda is not defined');
                        setError(new Error('API client not available'));
                        return [2 /*return*/];
                    }
                    if (!searchParams.searchBy.value ||
                        (Array.isArray(searchParams.searchBy.value) && searchParams.searchBy.value.length === 0)) {
                        // search params are not ready yet, that's ok probably
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, api_1.getInHouseOrders)(oystehrZambda, searchParams)];
                case 2:
                    response = _b.sent();
                    if (response === null || response === void 0 ? void 0 : response.data) {
                        setLabOrders(response.data);
                        setTotalItems(((_a = response.pagination) === null || _a === void 0 ? void 0 : _a.totalItems) || 0);
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
                        setLabOrders([]);
                        setTotalItems(0);
                        setTotalPages(1);
                        setShowPagination(false);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    fetchError_1 = _b.sent();
                    errorMessage = fetchError_1 instanceof Error ? fetchError_1.message : 'Unknown error occurred';
                    setError(new Error("Failed to fetch in-house lab orders: ".concat(errorMessage)));
                    // Reset state on error
                    setLabOrders([]);
                    setTotalItems(0);
                    setTotalPages(1);
                    setShowPagination(false);
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda]);
    (0, react_1.useEffect)(function () {
        if (page.pageNumber < 1) {
            throw new Error('Page number must be greater than 0');
        }
        var params = __assign(__assign(__assign({ itemsPerPage: utils_1.DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE }, memoizedSearchBy), (testTypeFilterRef.current && { orderableItemCode: testTypeFilterRef.current })), (visitDateFilterRef.current &&
            visitDateFilterRef.current.isValid && { visitDate: (0, utils_1.tryFormatDateToISO)(visitDateFilterRef.current) }));
        var searchParams = __assign(__assign({}, params), { pageIndex: page.pageNumber - 1 });
        if (searchParams.searchBy.field && searchParams.searchBy.value) {
            void fetchLabOrders(searchParams);
        }
        else {
            console.error('searchParams are not valid', searchParams);
        }
    }, [fetchLabOrders, page, memoizedSearchBy]);
    var hasData = labOrders.length > 0;
    var handleDeleteLabOrder = (0, react_1.useCallback)(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var err_1, errorObj;
        var serviceRequestId = _b.serviceRequestId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!serviceRequestId) {
                        console.error('Cannot delete lab order: Missing service request ID');
                        setError(new Error('Missing service request ID'));
                        return [2 /*return*/, false];
                    }
                    if (!oystehrZambda) {
                        console.error('Cannot delete lab order: API client is not available');
                        setError(new Error('API client is not available'));
                        return [2 /*return*/, false];
                    }
                    setLoading(true);
                    setError(null);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, api_1.deleteInHouseLabOrder)(oystehrZambda, {
                            serviceRequestId: serviceRequestId,
                        })];
                case 2:
                    _c.sent();
                    setSearchParams({ pageNumber: 1 });
                    return [2 /*return*/, true];
                case 3:
                    err_1 = _c.sent();
                    console.error('Error deleting In-house Lab Order:', err_1);
                    errorObj = err_1 instanceof Error ? err_1 : new Error(typeof err_1 === 'string' ? err_1 : 'Failed to delete lab order');
                    setError(errorObj);
                    return [2 /*return*/, false];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda, setSearchParams]);
    // handle delete dialog
    var _h = (0, useDeleteCommonLabOrderDialog_1.useDeleteCommonLabOrderDialog)({
        deleteOrder: handleDeleteLabOrder,
    }), showDeleteLabOrderDialog = _h.showDeleteLabOrderDialog, DeleteOrderDialog = _h.DeleteOrderDialog;
    return {
        labOrders: labOrders,
        loading: loading,
        error: error,
        totalPages: totalPages,
        totalItems: totalItems,
        page: page.pageNumber,
        setSearchParams: setSearchParams,
        showPagination: showPagination,
        hasData: hasData,
        showDeleteLabOrderDialog: showDeleteLabOrderDialog,
        DeleteOrderDialog: DeleteOrderDialog,
        testTypeFilter: testTypeFilterRef.current,
        visitDateFilter: visitDateFilterRef.current,
    };
};
exports.useInHouseLabOrders = useInHouseLabOrders;
//# sourceMappingURL=useInHouseLabOrders.js.map