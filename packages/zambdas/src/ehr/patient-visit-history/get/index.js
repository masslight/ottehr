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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var zod_1 = require("zod");
var shared_1 = require("../../../shared");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrM2MClientToken;
var ZAMBDA_NAME = 'get-patient-visit-history';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehrClient, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = validateRequestParameters(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                secrets = input.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrM2MClientToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrM2MClientToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _a.label = 3;
            case 3:
                oystehrClient = (0, shared_1.createOystehrClient)(oystehrM2MClientToken, secrets);
                return [4 /*yield*/, complexValidation(__assign(__assign({}, validatedParameters), { secrets: input.secrets }), oystehrClient)];
            case 4:
                effectInput = _a.sent();
                return [4 /*yield*/, performEffect(effectInput, oystehrClient)];
            case 5:
                response = _a.sent();
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, response)];
            case 6:
                error_1 = _a.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, type, status, from, to, serviceMode, sortDirection, params, allResources, appointments, encounters, practitioners, locations, slots, tasks, followUpMap, visitRows, visits;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = input.patientId, type = input.type, status = input.status, from = input.from, to = input.to, serviceMode = input.serviceMode, sortDirection = input.sortDirection;
                params = [
                    {
                        name: 'patient._id',
                        value: patientId,
                    },
                    {
                        name: '_revinclude',
                        value: 'Encounter:appointment',
                    },
                    {
                        name: '_include:iterate',
                        value: 'Appointment:patient',
                    },
                    {
                        name: '_include:iterate',
                        value: 'Encounter:participant:Practitioner',
                    },
                    {
                        name: '_include',
                        value: 'Appointment:location',
                    },
                    {
                        name: '_include:iterate',
                        value: 'Appointment:slot',
                    },
                    {
                        name: '_revinclude:iterate',
                        value: 'Task:encounter',
                    },
                    {
                        name: '_revinclude:iterate',
                        value: 'Encounter:part-of',
                    },
                    {
                        name: '_include:iterate',
                        value: 'Encounter:location',
                    },
                    {
                        name: '_sort',
                        value: sortDirection === 'asc' ? 'date' : '-date',
                    },
                ];
                if (from) {
                    params.push({ name: 'date', value: "ge".concat(from) });
                }
                if (to) {
                    params.push({ name: 'date', value: "le".concat(to) });
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: params,
                    })];
            case 1:
                allResources = (_a.sent()).unbundle();
                appointments = [];
                encounters = [];
                practitioners = [];
                locations = [];
                slots = [];
                tasks = [];
                followUpMap = {};
                allResources.forEach(function (res) {
                    switch (res.resourceType) {
                        case 'Appointment':
                            appointments.push(res);
                            break;
                        case 'Encounter':
                            if (res.partOf && res.partOf.reference && getFollowUpTypeFromEncounter(res)) {
                                var parentEncounterId = res.partOf.reference.replace('Encounter/', '');
                                followUpMap[parentEncounterId] = followUpMap[parentEncounterId] || [];
                                followUpMap[parentEncounterId].push(res);
                            }
                            else {
                                encounters.push(res);
                            }
                            break;
                        case 'Practitioner':
                            practitioners.push(res);
                            break;
                        case 'Location':
                            locations.push(res);
                            break;
                        case 'Slot':
                            slots.push(res);
                            break;
                        case 'Task':
                            tasks.push(res);
                            break;
                    }
                });
                visitRows = appointments.flatMap(function (appointment) {
                    var _a;
                    // build out AppointmentHistoryRow here
                    if (!appointment.id) {
                        return [];
                    }
                    var slot = slots.find(function (slot) { var _a; return (_a = appointment.slot) === null || _a === void 0 ? void 0 : _a.some(function (s) { return s.reference === "Slot/".concat(slot.id); }); });
                    var location = locations.find(function (location) { var _a; return (_a = appointment === null || appointment === void 0 ? void 0 : appointment.participant) === null || _a === void 0 ? void 0 : _a.some(function (p) { var _a, _b; return ((_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Location/', '')) === location.id; }); });
                    var encounter = encounters.find(function (encounter) { var _a, _b; return ((_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "Appointment/".concat(appointment.id) && !encounter.partOf; });
                    var provider = getProviderFromEncounter(encounter, practitioners);
                    var followUps = encounter
                        ? (_a = followUpMap[encounter.id || '']) === null || _a === void 0 ? void 0 : _a.map(function (followUpEncounter) {
                            return followUpVisitHistoryRowFromEncounter(followUpEncounter, {
                                practitioners: practitioners,
                                locations: locations,
                                originalEncounter: encounter,
                            });
                        }).filter(function (fu) { return fu !== undefined; })
                        : undefined;
                    var timezone = utils_1.TIMEZONES[0]; // default timezone
                    if (slot && slot.start) {
                        // we can just grab the tz from the slot rather than getting the schedule resource
                        var slotDateTime = luxon_1.DateTime.fromISO(slot.start, { setZone: true });
                        if (slotDateTime.isValid) {
                            timezone = slotDateTime.zoneName;
                        }
                    }
                    var dateTime = luxon_1.DateTime.fromISO(appointment.start).setZone(timezone).toISO() || undefined;
                    var serviceMode = (0, utils_1.isTelemedAppointment)(appointment) ? utils_1.ServiceMode.virtual : utils_1.ServiceMode['in-person'];
                    var telemedStatus;
                    var inPersonStatus;
                    if (encounter) {
                        if (serviceMode === utils_1.ServiceMode.virtual) {
                            telemedStatus = (0, utils_1.getTelemedVisitStatus)(encounter.status, appointment.status);
                        }
                        else {
                            inPersonStatus = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                        }
                    }
                    var type = (0, utils_1.appointmentTypeForAppointment)(appointment);
                    var sendInvoiceTask = (encounter === null || encounter === void 0 ? void 0 : encounter.id)
                        ? tasks.find(function (task) {
                            var _a, _b, _c;
                            // todo: confirm task.code plan
                            return ((_a = task.encounter) === null || _a === void 0 ? void 0 : _a.reference) === "Encounter/".concat(encounter.id) &&
                                ((_c = (_b = task.code) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.some(function (coding) { return coding.system === utils_1.RCM_TASK_SYSTEM && coding.code === utils_1.RcmTaskCode.sendInvoiceToPatient; }));
                        })
                        : undefined;
                    var baseRow = {
                        appointmentId: appointment.id,
                        type: type,
                        visitReason: (0, utils_1.getReasonForVisitFromAppointment)(appointment),
                        office: location === null || location === void 0 ? void 0 : location.name,
                        dateTime: dateTime,
                        provider: provider,
                        encounterId: encounter === null || encounter === void 0 ? void 0 : encounter.id,
                        sendInvoiceTask: sendInvoiceTask,
                        length: serviceMode === utils_1.ServiceMode.virtual
                            ? (0, utils_1.getTelemedLength)(encounter === null || encounter === void 0 ? void 0 : encounter.statusHistory)
                            : (encounter && (0, utils_1.getVisitTotalTime)(appointment, (0, utils_1.getVisitStatusHistory)(encounter), luxon_1.DateTime.now())) || 0,
                        followUps: followUps,
                    };
                    if (serviceMode === utils_1.ServiceMode.virtual) {
                        return __assign(__assign({}, baseRow), { serviceMode: utils_1.ServiceMode.virtual, status: telemedStatus });
                    }
                    else {
                        return __assign(__assign({}, baseRow), { serviceMode: utils_1.ServiceMode['in-person'], status: inPersonStatus });
                    }
                });
                visits = visitRows.filter(function (visit) {
                    var typeMatch = true;
                    var statusMatch = true;
                    var serviceModeMatch = true;
                    if (type && type.length > 0) {
                        typeMatch = !!visit.type && type.includes(visit.type);
                    }
                    if (status && status.length > 0) {
                        statusMatch = status.includes(visit.status || '');
                    }
                    if (serviceMode) {
                        serviceModeMatch = visit.serviceMode === serviceMode;
                    }
                    return typeMatch && statusMatch && serviceModeMatch;
                });
                return [2 /*return*/, { visits: visits, metadata: { totalCount: visitRows.length, sortDirection: sortDirection } }];
        }
    });
}); };
var complexValidation = function (input, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, patient;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = input.patientId;
                return [4 /*yield*/, oystehrClient.fhir.get({ resourceType: 'Patient', id: patientId })];
            case 1:
                patient = _a.sent();
                if (!patient) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Patient');
                }
                return [2 /*return*/, input];
        }
    });
}); };
var validateRequestParameters = function (input) {
    var _a;
    var authorization = input.headers.Authorization;
    if (!authorization) {
        throw utils_1.NOT_AUTHORIZED;
    }
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _b = JSON.parse(input.body), patientId = _b.patientId, type = _b.type, status = _b.status, from = _b.from, to = _b.to, serviceMode = _b.serviceMode, maybeSortDirection = _b.sortDirection;
    if (!patientId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['patientId']);
    }
    if (!(0, utils_1.isValidUUID)(patientId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientId" must be a valid UUID.');
    }
    if (from && typeof from === 'string' && !luxon_1.DateTime.fromISO(from).isValid) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"from" must be a valid ISO date string.');
    }
    else if (from && typeof from !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"from" must be a valid ISO date string.');
    }
    if (to && typeof to === 'string' && !luxon_1.DateTime.fromISO(to).isValid) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"to" must be a valid ISO date string.');
    }
    else if (to && typeof to !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"to" must be a valid ISO date string.');
    }
    if (from && to) {
        var fromDateTime = luxon_1.DateTime.fromISO(from);
        var toDateTime = luxon_1.DateTime.fromISO(to);
        if (fromDateTime >= toDateTime) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('The "from" date must be earlier than the "to" date.');
        }
    }
    if (type) {
        try {
            utils_1.AppointmentTypeSchema.parse(type);
        }
        catch (_c) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("\"type\" must be an array of ".concat(Object.values(utils_1.AppointmentTypeOptions).join(', '), "."));
        }
    }
    if (status) {
        try {
            // it would be nice to type this more strongly but difficult to do with current design
            zod_1.z.array(zod_1.z.string()).parse(status);
        }
        catch (_d) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"status" must be an array of strings.');
        }
    }
    if (serviceMode) {
        try {
            zod_1.z.enum([utils_1.ServiceMode['in-person'], utils_1.ServiceMode.virtual]).parse(serviceMode);
        }
        catch (_e) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("\"serviceMode\" must be one of ".concat(utils_1.ServiceMode['in-person'], " or ").concat(utils_1.ServiceMode.virtual, "."));
        }
    }
    var sortDirection = maybeSortDirection !== null && maybeSortDirection !== void 0 ? maybeSortDirection : 'desc';
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"sortDirection" must be either "asc" or "desc".');
    }
    return {
        patientId: patientId,
        from: from,
        to: to,
        type: type,
        status: status,
        sortDirection: sortDirection,
        serviceMode: serviceMode,
        secrets: (_a = input.secrets) !== null && _a !== void 0 ? _a : null,
    };
};
var getFollowUpTypeFromEncounter = function (encounter) {
    var _a;
    var typeCoding = (_a = encounter.type) === null || _a === void 0 ? void 0 : _a.find(function (t) { var _a; return (_a = t.coding) === null || _a === void 0 ? void 0 : _a.find(function (c) { return c.system === utils_1.FOLLOWUP_SYSTEMS.type.url && c.code === utils_1.FOLLOWUP_SYSTEMS.type.code; }); });
    if (!typeCoding)
        return undefined;
    var typeText = '-';
    if (typeCoding.text) {
        typeText = typeCoding.text;
    }
    return typeText;
};
var followUpVisitHistoryRowFromEncounter = function (encounter, context) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!encounter.id) {
        return undefined;
    }
    var followUpType = getFollowUpTypeFromEncounter(encounter);
    var practitioners = context.practitioners, locations = context.locations, originalEncounter = context.originalEncounter;
    var location = locations.find(function (location) { var _a; return (_a = encounter === null || encounter === void 0 ? void 0 : encounter.location) === null || _a === void 0 ? void 0 : _a.some(function (loc) { var _a, _b; return ((_b = (_a = loc.location) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Location/', '')) === location.id; }); });
    var office = ((_a = location === null || location === void 0 ? void 0 : location.address) === null || _a === void 0 ? void 0 : _a.state) && (location === null || location === void 0 ? void 0 : location.name) ? "".concat(location.address.state.toUpperCase(), " - ").concat(location.name) : '-';
    var originalAppointmentId = (_d = (_c = (_b = originalEncounter.appointment) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Appointment/', '');
    return {
        encounterId: encounter.id,
        dateTime: (_e = encounter.period) === null || _e === void 0 ? void 0 : _e.start,
        type: followUpType,
        visitReason: (_g = (_f = encounter.reasonCode) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.text,
        provider: getProviderFromEncounter(encounter, practitioners),
        office: office,
        status: (_h = encounter.status) !== null && _h !== void 0 ? _h : '-',
        originalEncounterId: originalEncounter.id,
        originalAppointmentId: originalAppointmentId,
    };
};
var getProviderFromEncounter = function (encounter, practitioners) {
    var practitionerId = encounter ? (0, utils_1.getAttendingPractitionerId)(encounter) : undefined;
    var providerResource;
    if (practitionerId) {
        providerResource = practitioners.find(function (practitioner) { return practitioner.id === practitionerId; });
    }
    var provider;
    if (providerResource && providerResource.id) {
        provider = {
            name: "".concat((0, utils_1.getFirstName)(providerResource), " ").concat((0, utils_1.getLastName)(providerResource)),
            id: providerResource.id,
        };
    }
    return provider;
};
