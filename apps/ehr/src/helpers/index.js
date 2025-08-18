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
exports.hasAtLeastOneOrder = exports.displayOrdersToolTip = exports.patchAppointmentComment = exports.formatLastModifiedTag = exports.sortLocationsByLabel = exports.checkInPatient = exports.messageIsFromPatient = exports.classifyAppointments = void 0;
var luxon_1 = require("luxon");
var AppointmentTabs_1 = require("src/components/AppointmentTabs");
var utils_1 = require("utils");
var activityLogsUtils_1 = require("./activityLogsUtils");
var formatDateTime_1 = require("./formatDateTime");
var classifyAppointments = function (appointments) {
    var statusCounts = new Map();
    appointments.forEach(function (appointment) {
        var status = appointment.status;
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    return statusCounts;
};
exports.classifyAppointments = classifyAppointments;
var messageIsFromPatient = function (message) {
    var _a, _b;
    return (_b = (_a = message.author) === null || _a === void 0 ? void 0 : _a.startsWith('+')) !== null && _b !== void 0 ? _b : false;
};
exports.messageIsFromPatient = messageIsFromPatient;
var checkInPatient = function (oystehr, appointmentId, encounterId, user) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentToUpdate, encounterToUpdate, checkedInBy, metaPatchOperations, encounterStatusHistoryUpdate, patchOp;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.get({
                    resourceType: 'Appointment',
                    id: appointmentId,
                })];
            case 1:
                appointmentToUpdate = _a.sent();
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Encounter',
                        id: encounterId,
                    })];
            case 2:
                encounterToUpdate = _a.sent();
                checkedInBy = "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")"));
                metaPatchOperations = (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(appointmentToUpdate, 'arrived', {
                    updatedByOverride: checkedInBy,
                });
                encounterStatusHistoryUpdate = (0, utils_1.getEncounterStatusHistoryUpdateOp)(encounterToUpdate, 'arrived');
                patchOp = {
                    op: 'replace',
                    path: '/status',
                    value: 'arrived',
                };
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: [
                            (0, utils_1.getPatchBinary)({
                                resourceId: appointmentId,
                                resourceType: 'Appointment',
                                patchOperations: __spreadArray([patchOp], metaPatchOperations, true),
                            }),
                            (0, utils_1.getPatchBinary)({
                                resourceId: encounterId,
                                resourceType: 'Encounter',
                                patchOperations: [patchOp, encounterStatusHistoryUpdate],
                            }),
                        ],
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.checkInPatient = checkInPatient;
var sortLocationsByLabel = function (locations) {
    function compare(a, b) {
        var labelA = a.label.toUpperCase();
        var labelB = b.label.toUpperCase();
        if (labelA < labelB) {
            return -1;
        }
        if (labelA > labelB) {
            return 1;
        }
        return 0;
    }
    locations.sort(compare);
    return locations;
};
exports.sortLocationsByLabel = sortLocationsByLabel;
var formatLastModifiedTag = function (field, resource, location) {
    var _a, _b, _c;
    if (!resource)
        return;
    var codeString = (_c = (_b = (_a = resource === null || resource === void 0 ? void 0 : resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "staff-update-history-".concat(field); })) === null || _c === void 0 ? void 0 : _c.code;
    if (codeString) {
        var locationTimeZone = (0, formatDateTime_1.getTimezone)(location);
        var codeJson = JSON.parse(codeString);
        var date = luxon_1.DateTime.fromISO(codeJson.lastModifiedDate).setZone(locationTimeZone);
        var timeFormatted = date.toLocaleString(luxon_1.DateTime.TIME_SIMPLE);
        var dateFormatted = (0, formatDateTime_1.formatDateUsingSlashes)(date.toISO() || '');
        var timezone = date.offsetNameShort;
        return "".concat(dateFormatted, " ").concat(timeFormatted, " ").concat(timezone !== null && timezone !== void 0 ? timezone : '', " By ").concat(codeJson.lastModifiedBy);
    }
    return;
};
exports.formatLastModifiedTag = formatLastModifiedTag;
var patchAppointmentComment = function (appointment, comment, user, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patchOp, patchOperations, fhirAppointment, updateTag, updatedAppointment;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!appointment || !appointment.id) {
                    return [2 /*return*/];
                }
                patchOperations = [];
                if (comment !== '') {
                    patchOp = appointment.comment ? 'replace' : 'add';
                    patchOperations.push({ op: patchOp, path: '/comment', value: comment });
                }
                else {
                    patchOp = 'remove';
                    patchOperations.push({ op: patchOp, path: '/comment' });
                }
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Appointment',
                        id: appointment.id,
                    })];
            case 1:
                fhirAppointment = _a.sent();
                updateTag = (0, activityLogsUtils_1.getCriticalUpdateTagOp)(fhirAppointment, (user === null || user === void 0 ? void 0 : user.name) || "".concat(utils_1.PROJECT_NAME, " Team Member (").concat(user === null || user === void 0 ? void 0 : user.id, ")"));
                patchOperations.push(updateTag);
                console.log('patchOperations', patchOperations);
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Appointment',
                        id: appointment.id,
                        operations: patchOperations,
                    })];
            case 2:
                updatedAppointment = _a.sent();
                return [2 /*return*/, updatedAppointment];
        }
    });
}); };
exports.patchAppointmentComment = patchAppointmentComment;
// there are two different tooltips that are show on the tracking board depending which tab/section you are on
// 1. visit components on prebooked, in-office/waiting and cancelled
// 2. orders on in-office/in-exam and completed
var displayOrdersToolTip = function (appointment, tab) {
    var display = false;
    if (tab === AppointmentTabs_1.ApptTab.completed) {
        display = true;
    }
    else if (tab === AppointmentTabs_1.ApptTab['in-office'] && appointment.status !== 'arrived' && appointment.status !== 'ready') {
        // in exam
        display = true;
    }
    return display;
};
exports.displayOrdersToolTip = displayOrdersToolTip;
var hasAtLeastOneOrder = function (orders) {
    return Object.values(orders).some(function (orderList) { return Array.isArray(orderList) && orderList.length > 0; });
};
exports.hasAtLeastOneOrder = hasAtLeastOneOrder;
//# sourceMappingURL=index.js.map