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
exports.useEditNote = void 0;
var react_1 = require("react");
var react_query_1 = require("react-query");
var useEvolveUser_1 = require("../../../../../hooks/useEvolveUser");
var useOystehrAPIClient_1 = require("../../../../../telemed/hooks/useOystehrAPIClient");
var useChartData_1 = require("../../../hooks/useChartData");
var useChartDataCacheKey_1 = require("./useChartDataCacheKey");
var useEditNote = function (_a) {
    var _b;
    var encounterId = _a.encounterId, apiConfig = _a.apiConfig;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var queryClient = (0, react_query_1.useQueryClient)();
    var user = (0, useEvolveUser_1.default)();
    var cacheKey = (0, useChartDataCacheKey_1.useChartDataCacheKey)(apiConfig.fieldName, apiConfig.searchParams);
    var refetch = (0, useChartData_1.useChartData)({
        encounterId: encounterId,
        requestedFields: (_b = {}, _b[apiConfig.fieldName] = apiConfig.searchParams, _b),
    }).refetch;
    var handleEdit = (0, react_1.useCallback)(function (entity, newText) { return __awaiter(void 0, void 0, void 0, function () {
        var updatedNote, result;
        var _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    updatedNote = {
                        resourceId: entity.resourceId,
                        type: entity.type,
                        text: newText,
                        authorId: (_d = (_c = (_b = user === null || user === void 0 ? void 0 : user.profile) === null || _b === void 0 ? void 0 : _b.split('/')) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : 'unknown',
                        authorName: (_e = user === null || user === void 0 ? void 0 : user.userName) !== null && _e !== void 0 ? _e : '',
                        patientId: entity.patientId,
                        encounterId: entity.encounterId,
                    };
                    return [4 /*yield*/, ((_f = apiClient === null || apiClient === void 0 ? void 0 : apiClient.saveChartData) === null || _f === void 0 ? void 0 : _f.call(apiClient, (_a = {
                                encounterId: entity.encounterId
                            },
                            _a[apiConfig.fieldName] = [updatedNote],
                            _a)))];
                case 1:
                    _g.sent();
                    result = queryClient.setQueryData(cacheKey, function (oldData) {
                        var _a;
                        var _b;
                        if (oldData === null || oldData === void 0 ? void 0 : oldData[apiConfig.fieldName]) {
                            return __assign(__assign({}, oldData), (_a = {}, _a[apiConfig.fieldName] = (_b = oldData[apiConfig.fieldName]) === null || _b === void 0 ? void 0 : _b.map(function (note) {
                                if (note.resourceId === updatedNote.resourceId) {
                                    return __assign(__assign({}, note), updatedNote);
                                }
                                return note;
                            }), _a));
                        }
                        return oldData;
                    });
                    if (!((result === null || result === void 0 ? void 0 : result[apiConfig.fieldName]) === undefined)) return [3 /*break*/, 3];
                    // refetch all if the cache didn't found
                    return [4 /*yield*/, refetch()];
                case 2:
                    // refetch all if the cache didn't found
                    _g.sent();
                    _g.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); }, [user === null || user === void 0 ? void 0 : user.profile, user === null || user === void 0 ? void 0 : user.userName, apiClient, apiConfig, queryClient, cacheKey, refetch]);
    return handleEdit;
};
exports.useEditNote = useEditNote;
//# sourceMappingURL=useEditNote.js.map