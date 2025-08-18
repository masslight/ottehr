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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useExamObservations = useExamObservations;
var notistack_1 = require("notistack");
var react_1 = require("react");
var featureFlags_1 = require("../../features/css-module/context/featureFlags");
var state_1 = require("../state");
var arrayToObject = function (array) {
    return array.reduce(function (prev, curr) {
        prev[curr.field] = curr;
        return prev;
    }, {});
};
var objectToArray = function (object) { return Object.values(object); };
function useExamObservations(param) {
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var useExamObservationsStore = css ? state_1.useInPersonExamObservationsStore : state_1.useExamObservationsStore;
    var state = useExamObservationsStore();
    var _a = (0, state_1.useSaveChartData)(), saveChartData = _a.mutate, isSaveLoading = _a.isLoading;
    var _b = (0, state_1.useDeleteChartData)(), deleteChartData = _b.mutate, isDeleteLoading = _b.isLoading;
    var getPrevStateAndValues = (0, react_1.useCallback)(function (param) {
        // TODO: fix types
        var _a;
        var prevState = useExamObservationsStore.getState();
        var prevValues = Array.isArray(param)
            ? param.reduce(function (prev, curr) {
                prev[curr.field] = prevState[curr.field];
                // prev[curr.field] = prevState[curr.field];
                return prev;
            }, {})
            : Object.prototype.hasOwnProperty.call(param, 'field')
                ? (_a = {},
                    _a[param.field] = prevState[param.field],
                    _a) : Object.keys(param).reduce(function (prev, curr) {
                prev[curr] = prevState[curr];
                return prev;
            }, {});
        return { prevState: prevState, prevValues: prevValues };
    }, [useExamObservationsStore]);
    var update = function (param, noFetch) {
        var _a;
        if (!param) {
            return;
        }
        var prevValues = getPrevStateAndValues(param).prevValues;
        useExamObservationsStore.setState(Array.isArray(param)
            ? arrayToObject(param)
            : Object.prototype.hasOwnProperty.call(param, 'field')
                ? (_a = {}, _a[param.field] = param, _a) : param);
        if (noFetch) {
            return;
        }
        saveChartData({
            examObservations: Array.isArray(param)
                ? param
                : Object.prototype.hasOwnProperty.call(param, 'field')
                    ? [param]
                    : objectToArray(param),
        }, {
            onSuccess: function (data) {
                var _a;
                var newState = (_a = data.chartData.examObservations) === null || _a === void 0 ? void 0 : _a.filter(function (observation) {
                    var _a;
                    return !observation.field.endsWith('-comment') ||
                        !((_a = prevValues[observation.field]) === null || _a === void 0 ? void 0 : _a.resourceId);
                });
                if (newState) {
                    useExamObservationsStore.setState(arrayToObject(newState));
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while saving exam data. Please try again.', { variant: 'error' });
                useExamObservationsStore.setState(prevValues);
            },
        });
    };
    var deleteExamObservations = function (param, noFetch) {
        if (!param) {
            return;
        }
        var _a = getPrevStateAndValues(param), prevState = _a.prevState, prevValues = _a.prevValues;
        useExamObservationsStore.setState(function () {
            var _a;
            // If param is an array, convert to object
            if (Array.isArray(param)) {
                var newObject = arrayToObject(param);
                // Remove fields from prevState that are in newObject
                var filteredState_1 = __assign({}, prevState);
                Object.keys(newObject).forEach(function (key) {
                    delete filteredState_1[key];
                });
                return __assign(__assign({}, filteredState_1), newObject);
            }
            // If param is a single observation
            if (Object.prototype.hasOwnProperty.call(param, 'field')) {
                var field = param.field;
                // Create a new state without the field
                var _b = prevState, _c = field, _removed = _b[_c], rest = __rest(_b, [typeof _c === "symbol" ? _c : _c + ""]);
                return __assign((_a = {}, _a[field] = { field: _removed.field, note: '' }, _a), rest);
            }
            // If param is an ExamRecord
            var examRecord = param;
            // Remove all fields from prevState that are in examRecord
            var filteredState = __assign({}, prevState);
            Object.keys(examRecord).forEach(function (key) {
                delete filteredState[key];
            });
            return __assign(__assign({}, filteredState), examRecord);
        });
        if (noFetch) {
            return;
        }
        deleteChartData({
            examObservations: Array.isArray(param)
                ? param
                : Object.prototype.hasOwnProperty.call(param, 'field')
                    ? [param]
                    : objectToArray(param),
        }, {
            onError: function () {
                useExamObservationsStore.setState(prevValues);
            },
        });
    };
    return {
        value: param
            ? typeof param === 'string'
                ? state[param]
                : param.map(function (option) { return state[option]; })
            : objectToArray(state),
        update: update,
        delete: deleteExamObservations,
        isLoading: isDeleteLoading || isSaveLoading,
    };
}
//# sourceMappingURL=useExamObservations.js.map