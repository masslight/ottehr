"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useChartDataCacheKey = void 0;
var react_1 = require("react");
var useEvolveUser_1 = require("../../../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../../telemed");
var useOystehrAPIClient_1 = require("../../../../../telemed/hooks/useOystehrAPIClient");
var useChartDataCacheKey = function (fieldName, searchParams) {
    var encounterId = (0, telemed_1.useAppointmentStore)(function (state) { var _a; return (_a = state.encounter) === null || _a === void 0 ? void 0 : _a.id; });
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var user = (0, useEvolveUser_1.default)();
    var isAppointmentLoading = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isAppointmentLoading']).isAppointmentLoading;
    var isReadOnly = (0, telemed_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var cacheKey = (0, react_1.useMemo)(function () {
        var _a;
        var requestedFields = searchParams ? (_a = {}, _a[fieldName] = searchParams, _a) : undefined;
        return [telemed_1.CHART_DATA_QUERY_KEY_BASE, apiClient, encounterId, user, isReadOnly, isAppointmentLoading, requestedFields];
    }, [apiClient, fieldName, searchParams, encounterId, isAppointmentLoading, isReadOnly, user]);
    return cacheKey;
};
exports.useChartDataCacheKey = useChartDataCacheKey;
//# sourceMappingURL=useChartDataCacheKey.js.map