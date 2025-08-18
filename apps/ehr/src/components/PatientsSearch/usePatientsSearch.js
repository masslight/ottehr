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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePatientsSearch = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var constants_1 = require("./constants");
var addSearchPagination_1 = require("./utils/addSearchPagination");
var addSearchSort_1 = require("./utils/addSearchSort");
var buildSearchQuery_1 = require("./utils/buildSearchQuery");
var parseSearchResults_1 = require("./utils/parseSearchResults");
var emptySearchResult = {
    patients: [],
    pagination: { next: null, prev: null, totalItems: 0 },
};
var projectId = import.meta.env.VITE_APP_PROJECT_ID;
if (!projectId) {
    throw new Error('PROJECT_ID is not set');
}
var fetchPatients = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var token, headers, response, patientBundle, parsedSearchResult, error_1, message;
    var searchUrl = _b.searchUrl, setSearchResult = _b.setSearchResult, setArePatientsLoading = _b.setArePatientsLoading, getAccessTokenSilently = _b.getAccessTokenSilently;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                setArePatientsLoading(true);
                _c.label = 1;
            case 1:
                _c.trys.push([1, 5, 6, 7]);
                return [4 /*yield*/, getAccessTokenSilently()];
            case 2:
                token = _c.sent();
                headers = {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: "Bearer ".concat(token),
                    'x-zapehr-project-id': projectId,
                };
                return [4 /*yield*/, fetch(searchUrl, {
                        method: 'GET',
                        headers: headers,
                    })];
            case 3:
                response = _c.sent();
                if (!response.ok) {
                    throw new Error("HTTP error! status: ".concat(response.status));
                }
                return [4 /*yield*/, response.json()];
            case 4:
                patientBundle = _c.sent();
                parsedSearchResult = (0, parseSearchResults_1.parseSearchResults)(patientBundle);
                setSearchResult(parsedSearchResult);
                return [3 /*break*/, 7];
            case 5:
                error_1 = _c.sent();
                setSearchResult(emptySearchResult);
                message = error_1 instanceof Error ? error_1.message : 'An error occurred while searching';
                (0, notistack_1.enqueueSnackbar)(message, { variant: 'error' });
                return [3 /*break*/, 7];
            case 6:
                setArePatientsLoading(false);
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); };
var getFiltersFromUrl = function (searchParams) { return ({
    givenNames: searchParams.get('givenNames') || '',
    lastName: searchParams.get('lastName') || '',
    dob: searchParams.get('dob') || '',
    pid: searchParams.get('pid') || '',
    phone: searchParams.get('phone') || '',
    address: searchParams.get('address') || '',
    email: searchParams.get('email') || '',
    // subscriberNumber: searchParams.get('subscriberNumber') || '',
    status: searchParams.get('status') || 'All',
    location: searchParams.get('location') || 'All',
}); };
var getSortFromUrl = function (searchParams) { return ({
    field: searchParams.get('field') || constants_1.SEARCH_CONFIG.DEFAULT_SORT.field,
    order: searchParams.get('order') || constants_1.SEARCH_CONFIG.DEFAULT_SORT.order,
}); };
var getPaginationFromUrl = function (searchParams) { return ({
    pageSize: Number(searchParams.get('pageSize')) || constants_1.SEARCH_CONFIG.DEFAULT_PAGE_SIZE,
    offset: Number(searchParams.get('offset')) || 0,
}); };
var defaultSearchOptions = {
    filters: {
        givenNames: '',
        lastName: '',
        dob: '',
        pid: '',
        phone: '',
        address: '',
        email: '',
        // subscriberNumber: '',
        status: 'All',
        location: 'All',
    },
    sort: constants_1.SEARCH_CONFIG.DEFAULT_SORT,
    pagination: { pageSize: constants_1.SEARCH_CONFIG.DEFAULT_PAGE_SIZE, offset: 0 },
};
var usePatientsSearch = function () {
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var _a = (0, react_router_dom_1.useSearchParams)(), searchParams = _a[0], setSearchParams = _a[1];
    var _b = (0, react_1.useState)(emptySearchResult), searchResult = _b[0], setSearchResult = _b[1];
    var _c = (0, react_1.useState)(false), arePatientsLoading = _c[0], setArePatientsLoading = _c[1];
    var _d = (0, react_1.useState)({
        filters: getFiltersFromUrl(searchParams),
        sort: getSortFromUrl(searchParams),
        pagination: getPaginationFromUrl(searchParams),
    }), searchOptions = _d[0], setSearchOptions = _d[1];
    var setSearchField = (0, react_1.useCallback)(function (_a) {
        var field = _a.field, value = _a.value;
        setSearchOptions(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), { filters: __assign(__assign({}, prev.filters), (_a = {}, _a[field] = value, _a)) }));
        });
    }, [setSearchOptions]);
    var resetFilters = (0, react_1.useCallback)(function () {
        setSearchOptions(defaultSearchOptions);
    }, [setSearchOptions]);
    // 1. update state with newSearchOptions
    //      Note: if newSearchOptions is not provided, it will use the current searchOptions state,
    //            if provided - it will merge and update current searchOptions with newSearchOptions.
    // 2. set new search options params to the url
    var search = (0, react_1.useCallback)(function (newSearchOptions) {
        var filters = searchOptions.filters, sort = searchOptions.sort, pagination = searchOptions.pagination;
        var newFilters = __assign(__assign({}, filters), newSearchOptions === null || newSearchOptions === void 0 ? void 0 : newSearchOptions.filters);
        var newSort = __assign(__assign({}, sort), newSearchOptions === null || newSearchOptions === void 0 ? void 0 : newSearchOptions.sort);
        var newPagination = __assign(__assign({}, pagination), newSearchOptions === null || newSearchOptions === void 0 ? void 0 : newSearchOptions.pagination);
        setSearchOptions({ filters: newFilters, sort: newSort, pagination: newPagination });
        var newSearchParams = new URLSearchParams(searchParams);
        Object.entries(newFilters).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value) {
                newSearchParams.set(key, value.toString());
            }
            else {
                newSearchParams.delete(key);
            }
        });
        Object.entries(newSort).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value) {
                newSearchParams.set(key, value);
            }
            else {
                newSearchParams.delete(key);
            }
        });
        Object.entries(newPagination).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value) {
                newSearchParams.set(key, value.toString());
            }
            else {
                newSearchParams.delete(key);
            }
        });
        setSearchParams(newSearchParams);
    }, [searchOptions, searchParams, setSearchParams]);
    // run search on url params change
    (0, react_1.useEffect)(function () {
        if (__spreadArray([], searchParams.entries(), true).length > 0) {
            var loadPatients = function () { return __awaiter(void 0, void 0, void 0, function () {
                var filter, sort, pagination, url, error_2, message;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            setArePatientsLoading(true);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 5]);
                            filter = getFiltersFromUrl(searchParams);
                            sort = getSortFromUrl(searchParams);
                            pagination = getPaginationFromUrl(searchParams);
                            url = (0, buildSearchQuery_1.buildSearchQuery)(filter);
                            url = (0, addSearchSort_1.addSearchSort)(url, sort);
                            url = (0, addSearchPagination_1.addSearchPagination)(url, pagination);
                            url = "".concat(import.meta.env.VITE_APP_FHIR_API_URL, "/").concat(url);
                            return [4 /*yield*/, fetchPatients({ searchUrl: url, setSearchResult: setSearchResult, setArePatientsLoading: setArePatientsLoading, getAccessTokenSilently: getAccessTokenSilently })];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 3:
                            error_2 = _a.sent();
                            setSearchResult(emptySearchResult);
                            message = error_2 instanceof Error ? error_2.message : 'An error occurred while searching';
                            (0, notistack_1.enqueueSnackbar)(message, { variant: 'error' });
                            return [3 /*break*/, 5];
                        case 4:
                            setArePatientsLoading(false);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); };
            void loadPatients();
        }
    }, [getAccessTokenSilently, searchParams]);
    return {
        searchResult: searchResult,
        arePatientsLoading: arePatientsLoading,
        searchOptions: searchOptions,
        search: search,
        setSearchField: setSearchField,
        resetFilters: resetFilters,
    };
};
exports.usePatientsSearch = usePatientsSearch;
//# sourceMappingURL=usePatientsSearch.js.map