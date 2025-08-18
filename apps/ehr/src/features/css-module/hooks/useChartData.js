"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useChartData = void 0;
var react_1 = require("react");
var telemed_1 = require("../../../telemed");
var useExamObservations_1 = require("../../../telemed/hooks/useExamObservations");
var useOystehrAPIClient_1 = require("../../../telemed/hooks/useOystehrAPIClient");
var useChartData = function (_a) {
    var encounterId = _a.encounterId, requestedFields = _a.requestedFields, shouldUpdateExams = _a.shouldUpdateExams, onSuccess = _a.onSuccess, onError = _a.onError, _b = _a.enabled, enabled = _b === void 0 ? true : _b, _c = _a.replaceStoreValues, replaceStoreValues = _c === void 0 ? false : _c, refetchInterval = _a.refetchInterval;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var updateExamObservations = (0, useExamObservations_1.useExamObservations)().update;
    var setPartialChartData = (0, telemed_1.useAppointmentStore)(function (state) { return state.setPartialChartData; });
    var _d = (0, telemed_1.useGetChartData)({ apiClient: apiClient, encounterId: encounterId, requestedFields: requestedFields, enabled: enabled, refetchInterval: refetchInterval }, function (data) {
        onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess(data);
        if (replaceStoreValues) {
            Object.keys(requestedFields || {}).forEach(function (field) {
                var _a;
                setPartialChartData((_a = {}, _a[field] = data[field], _a));
            });
        }
        if (!requestedFields) {
            telemed_1.useAppointmentStore.setState({
                isChartDataLoading: false,
            });
        }
        // not set state for custom fields request, because data will be incomplete
        if (requestedFields)
            return;
        // should be updated only from root (useAppointment hook)
        if (shouldUpdateExams) {
            updateExamObservations(data.examObservations, true);
        }
    }, function (error) {
        if (!requestedFields) {
            telemed_1.useAppointmentStore.setState({
                isChartDataLoading: false,
            });
        }
        onError === null || onError === void 0 ? void 0 : onError(error);
    }), chartDataError = _d.error, isLoading = _d.isLoading, isFetching = _d.isFetching, refetch = _d.refetch, chartData = _d.data, queryKey = _d.queryKey, isFetched = _d.isFetched;
    (0, react_1.useEffect)(function () {
        if (!requestedFields && enabled) {
            telemed_1.useAppointmentStore.setState({
                isChartDataLoading: isFetching,
            });
        }
    }, [chartData, isFetching, requestedFields, enabled]);
    return { refetch: refetch, chartData: chartData, isLoading: isLoading, error: chartDataError, queryKey: queryKey, isFetching: isFetching, isFetched: isFetched };
};
exports.useChartData = useChartData;
//# sourceMappingURL=useChartData.js.map