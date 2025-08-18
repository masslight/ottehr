"use strict";
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
exports.useEditPatientInformationMutation = exports.useSignAppointmentMutation = exports.useChangeTelemedAppointmentStatusMutation = exports.useInitTelemedSessionMutation = exports.useGetTelemedAppointments = void 0;
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useGetTelemedAppointments = function (_a, onSuccess
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var apiClient = _a.apiClient, usStatesFilter = _a.usStatesFilter, dateFilter = _a.dateFilter, providersFilter = _a.providersFilter, groupsFilter = _a.groupsFilter, patientFilter = _a.patientFilter, statusesFilter = _a.statusesFilter, locationsIdsFilter = _a.locationsIdsFilter, visitTypesFilter = _a.visitTypesFilter;
    return (0, react_query_1.useQuery)([
        'telemed-appointments',
        {
            apiClient: apiClient,
            usStatesFilter: usStatesFilter,
            providersFilter: providersFilter,
            groupsFilter: groupsFilter,
            dateFilter: dateFilter,
            patientFilter: patientFilter,
            statusesFilter: statusesFilter,
            locationsIdsFilter: locationsIdsFilter,
            visitTypesFilter: visitTypesFilter,
        },
    ], function () {
        if (apiClient) {
            return apiClient.getTelemedAppointments({
                usStatesFilter: usStatesFilter,
                providersFilter: providersFilter,
                groupsFilter: groupsFilter,
                dateFilter: dateFilter,
                patientFilter: patientFilter,
                statusesFilter: statusesFilter,
                locationsIdsFilter: locationsIdsFilter,
                visitTypesFilter: visitTypesFilter,
            });
        }
        throw new Error('api client not defined');
    }, {
        refetchInterval: 10000,
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get telemed appointments: ', err);
        },
    });
};
exports.useGetTelemedAppointments = useGetTelemedAppointments;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useInitTelemedSessionMutation = function () {
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var apiClient = _a.apiClient, appointmentId = _a.appointmentId, userId = _a.userId;
            return apiClient.initTelemedSession({
                appointmentId: appointmentId,
                userId: userId,
            });
        },
    });
};
exports.useInitTelemedSessionMutation = useInitTelemedSessionMutation;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useChangeTelemedAppointmentStatusMutation = function () {
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var apiClient = _a.apiClient, appointmentId = _a.appointmentId, newStatus = _a.newStatus;
            return apiClient.changeTelemedAppointmentStatus({
                appointmentId: appointmentId,
                newStatus: newStatus,
            });
        },
    });
};
exports.useChangeTelemedAppointmentStatusMutation = useChangeTelemedAppointmentStatusMutation;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useSignAppointmentMutation = function () {
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var apiClient = _a.apiClient, appointmentId = _a.appointmentId, timezone = _a.timezone;
            return apiClient.signAppointment({
                appointmentId: appointmentId,
                timezone: timezone,
            });
        },
    });
};
exports.useSignAppointmentMutation = useSignAppointmentMutation;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useEditPatientInformationMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b;
            var originalPatientData = _a.originalPatientData, updatedPatientData = _a.updatedPatientData, fieldsToUpdate = _a.fieldsToUpdate;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
                fieldsToUpdate = ['name', 'birthDate', 'address', 'telecom'];
            }
            var fieldsSet = __spreadArray([], new Set(fieldsToUpdate), true);
            var patchOperations = fieldsSet.map(function (field) {
                return (0, utils_1.addOrReplaceOperation)(originalPatientData[field], "/".concat(field), updatedPatientData[field]);
            });
            return oystehr.fhir.patch({
                resourceType: 'Patient',
                id: (_b = updatedPatientData.id) !== null && _b !== void 0 ? _b : '',
                operations: patchOperations,
            });
        },
        onError: function (err) {
            console.error('Error during editing patient information: ', err);
        },
    });
};
exports.useEditPatientInformationMutation = useEditPatientInformationMutation;
//# sourceMappingURL=tracking-board.queries.js.map