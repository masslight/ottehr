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
exports.useUpdateProviderNotificationsMutation = exports.useUpdateProviderNotificationSettingsMutation = exports.useGetProviderNotifications = void 0;
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var useAppClients_1 = require("../../hooks/useAppClients");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetProviderNotifications = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var user = (0, useEvolveUser_1.default)();
    return (0, react_query_1.useQuery)(['provider-notifications'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var notificationResources, communicationResources, encounterResources;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.search({
                        resourceType: 'Communication',
                        params: [
                            {
                                name: '_include',
                                value: 'Communication:encounter',
                            },
                            {
                                name: 'recipient',
                                value: user.profile,
                            },
                            {
                                name: 'category',
                                value: "".concat(utils_1.PROVIDER_NOTIFICATION_TYPE_SYSTEM, "|").concat([
                                    utils_1.AppointmentProviderNotificationTypes.patient_waiting,
                                    utils_1.AppointmentProviderNotificationTypes.unsigned_charts,
                                ].join(',')),
                            },
                            {
                                name: '_count',
                                value: '10',
                            },
                            {
                                name: '_sort',
                                value: '-_lastUpdated',
                            },
                        ],
                    }))];
                case 1:
                    notificationResources = (_a = (_b.sent())) === null || _a === void 0 ? void 0 : _a.unbundle();
                    communicationResources = notificationResources === null || notificationResources === void 0 ? void 0 : notificationResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Communication'; });
                    encounterResources = notificationResources === null || notificationResources === void 0 ? void 0 : notificationResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Encounter'; });
                    return [2 /*return*/, communicationResources.map(function (communicationResource) {
                            var _a, _b, _c, _d;
                            var encounterID = (_b = (_a = communicationResource.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '');
                            var encounter = encounterResources.find(function (encounterTemp) { return encounterID === encounterTemp.id; });
                            var appointmentID = (_d = (_c = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _c === void 0 ? void 0 : _c[0].reference) === null || _d === void 0 ? void 0 : _d.replace('Appointment/', '');
                            var notification = {
                                appointmentID: appointmentID || '',
                                encounter: encounter,
                                communication: communicationResource,
                            };
                            return notification;
                        })];
            }
        });
    }); }, { enabled: !!(oystehr && (user === null || user === void 0 ? void 0 : user.profile)), refetchInterval: 10000, refetchIntervalInBackground: true, onSuccess: onSuccess });
};
exports.useGetProviderNotifications = useGetProviderNotifications;
var useUpdateProviderNotificationSettingsMutation = function (onSuccess) {
    var user = (0, useEvolveUser_1.default)();
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['provider-notifications'], function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var notificationsExtIndex, newNotificationSettingsExtension, patchOp;
        var _c, _d;
        var method = _b.method, enabled = _b.enabled;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!(user === null || user === void 0 ? void 0 : user.profileResource))
                        throw new Error('User practitioner profile not defined');
                    notificationsExtIndex = (_c = (user.profileResource.extension || [])) === null || _c === void 0 ? void 0 : _c.findIndex(function (ext) { return ext.url === utils_1.PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL; });
                    newNotificationSettingsExtension = [
                        {
                            url: utils_1.PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
                            extension: [
                                {
                                    url: utils_1.PROVIDER_NOTIFICATION_METHOD_URL,
                                    valueString: method,
                                },
                                {
                                    url: utils_1.PROVIDER_NOTIFICATIONS_ENABLED_URL,
                                    valueBoolean: enabled,
                                },
                            ],
                        },
                    ];
                    if (!user.profileResource.extension) {
                        patchOp = {
                            op: 'add',
                            path: "/extension",
                            value: newNotificationSettingsExtension,
                        };
                    }
                    else {
                        patchOp = {
                            op: notificationsExtIndex >= 0 ? 'replace' : 'add',
                            path: "/extension/".concat(notificationsExtIndex >= 0 ? notificationsExtIndex : '-'),
                            value: newNotificationSettingsExtension[0],
                        };
                    }
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.patch({
                            id: (_d = user.profileResource.id) !== null && _d !== void 0 ? _d : '',
                            resourceType: 'Practitioner',
                            operations: [patchOp],
                        }))];
                case 1:
                    _e.sent();
                    return [2 /*return*/, { method: method, enabled: enabled }];
            }
        });
    }); }, { onSuccess: onSuccess });
};
exports.useUpdateProviderNotificationSettingsMutation = useUpdateProviderNotificationSettingsMutation;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useUpdateProviderNotificationsMutation = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['provider-notifications'], function (params) { return __awaiter(void 0, void 0, void 0, function () {
        var ids, status, patchOp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ids = params.ids, status = params.status;
                    patchOp = {
                        op: 'replace',
                        path: '/status',
                        value: status,
                    };
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.batch({
                            requests: __spreadArray([], ids.map(function (id) {
                                return (0, utils_1.getPatchBinary)({ resourceId: id, resourceType: 'Communication', patchOperations: [patchOp] });
                            }), true),
                        }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, { onSuccess: onSuccess });
};
exports.useUpdateProviderNotificationsMutation = useUpdateProviderNotificationsMutation;
//# sourceMappingURL=notifications.queries.js.map