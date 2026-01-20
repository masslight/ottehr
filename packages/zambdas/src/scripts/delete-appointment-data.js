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
var utils_1 = require("utils");
var helpers_1 = require("./helpers");
var deleteAppointmentData = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, appointmentId, allResources, _a, deleteRequests, person, e_1, relatedPersons, retries, operations, _loop_1, _i, relatedPersons_1, relatedPerson, e_2, personNewlyFetched, e_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, helpers_1.createOystehrClientFromConfig)(config)];
            case 1:
                oystehr = _d.sent();
                appointmentId = process.argv[3];
                return [4 /*yield*/, getAppointmentById(oystehr, appointmentId)];
            case 2:
                allResources = _d.sent();
                _a = generateDeleteRequestsAndPerson(allResources), deleteRequests = _a[0], person = _a[1];
                _d.label = 3;
            case 3:
                _d.trys.push([3, 5, 6, 7]);
                console.log("Deleting resources...");
                return [4 /*yield*/, oystehr.fhir.batch({ requests: __spreadArray([], deleteRequests, true) })];
            case 4:
                _d.sent();
                return [3 /*break*/, 7];
            case 5:
                e_1 = _d.sent();
                console.log("Error deleting resources: ".concat(e_1), JSON.stringify(e_1));
                return [3 /*break*/, 7];
            case 6:
                console.log("Deleting resources complete");
                return [7 /*endfinally*/];
            case 7:
                if (!person) {
                    return [2 /*return*/];
                }
                _d.label = 8;
            case 8:
                _d.trys.push([8, 19, , 20]);
                console.log("Patching Person...");
                relatedPersons = allResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'RelatedPerson'; });
                retries = 0;
                _d.label = 9;
            case 9:
                if (!(retries < 20)) return [3 /*break*/, 18];
                operations = [];
                _loop_1 = function (relatedPerson) {
                    var linkIndex = ((_b = person === null || person === void 0 ? void 0 : person.link) === null || _b === void 0 ? void 0 : _b.findIndex(function (linkTemp) { var _a; return ((_a = linkTemp.target) === null || _a === void 0 ? void 0 : _a.reference) === "RelatedPerson/".concat(relatedPerson.id); })) ||
                        -1;
                    if (linkIndex >= 0) {
                        if (((_c = person === null || person === void 0 ? void 0 : person.link) === null || _c === void 0 ? void 0 : _c.length) === 1) {
                            operations.push({ op: 'remove', path: '/link' });
                        }
                        else {
                            operations.push({ op: 'remove', path: "/link/".concat(linkIndex) });
                        }
                    }
                    else {
                        console.log("RelatedPerson/".concat(relatedPerson.id, " link not found in Person ").concat(person === null || person === void 0 ? void 0 : person.id));
                    }
                };
                for (_i = 0, relatedPersons_1 = relatedPersons; _i < relatedPersons_1.length; _i++) {
                    relatedPerson = relatedPersons_1[_i];
                    _loop_1(relatedPerson);
                }
                _d.label = 10;
            case 10:
                _d.trys.push([10, 14, , 17]);
                if (!(operations.length > 0)) return [3 /*break*/, 12];
                return [4 /*yield*/, oystehr.fhir.patch({ resourceType: 'Person', id: person.id, operations: operations }, { optimisticLockingVersionId: person.meta.versionId })];
            case 11:
                _d.sent();
                return [3 /*break*/, 13];
            case 12:
                console.log("No operations to patch Person/".concat(person.id));
                return [3 /*break*/, 18];
            case 13:
                console.log("Patching Person complete");
                return [3 /*break*/, 18];
            case 14:
                e_2 = _d.sent();
                console.error("Error patching resource: ".concat(e_2), JSON.stringify(e_2));
                retries++;
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
            case 15:
                _d.sent();
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Person',
                        params: [{ name: '_id', value: person.id }],
                    })];
            case 16:
                personNewlyFetched = (_d.sent()).unbundle()[0];
                if (personNewlyFetched) {
                    person.meta.versionId = personNewlyFetched.meta.versionId;
                    person.link = personNewlyFetched.link;
                }
                return [3 /*break*/, 17];
            case 17: return [3 /*break*/, 9];
            case 18: return [3 /*break*/, 20];
            case 19:
                e_3 = _d.sent();
                console.error("Error patching resources: ".concat(e_3), JSON.stringify(e_3));
                return [3 /*break*/, 20];
            case 20:
                console.log('Appointment data batch removed and person patched');
                return [2 /*return*/];
        }
    });
}); };
var generateDeleteRequestsAndPerson = function (allResources) {
    var _a;
    var deleteRequests = [];
    var person = (_a = allResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Person'; })) === null || _a === void 0 ? void 0 : _a[0];
    var deleteSlotRequests = allResources
        .filter(function (resourceTemp) { return resourceTemp.resourceType === 'Slot'; })
        .map(function (slotTemp) { return ({ method: 'DELETE', url: "Slot/".concat(slotTemp.id) }); });
    deleteRequests.push.apply(deleteRequests, deleteSlotRequests);
    allResources
        .filter(function (resourceTemp) { return resourceTemp.resourceType === 'Appointment'; })
        .forEach(function (appointmentTemp) {
        var fhirAppointment = appointmentTemp;
        if (!fhirAppointment.id) {
            return;
        }
        deleteRequests.push({ method: 'DELETE', url: "/Appointment/".concat(fhirAppointment.id) });
        var patient = allResources.find(function (resourceTemp) { return resourceTemp.id === (0, utils_1.getParticipantIdFromAppointment)(fhirAppointment, 'Patient'); });
        if (patient === null || patient === void 0 ? void 0 : patient.id) {
            deleteRequests.push({ method: 'DELETE', url: "/Patient/".concat(patient.id) });
            allResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Encounter'; })
                .filter(function (encounterTemp) { var _a; return ((_a = encounterTemp.subject) === null || _a === void 0 ? void 0 : _a.reference) === "Patient/".concat(patient.id); })
                .forEach(function (encounterTemp) {
                return encounterTemp.id && deleteRequests.push({ method: 'DELETE', url: "/Encounter/".concat(encounterTemp.id) });
            });
            allResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'RelatedPerson'; })
                .filter(function (relatedPersonTemp) { return relatedPersonTemp.patient.reference === "Patient/".concat(patient.id); })
                .forEach(function (relatedPersonTemp) {
                if (relatedPersonTemp.id) {
                    deleteRequests.push({ method: 'DELETE', url: "/RelatedPerson/".concat(relatedPersonTemp.id) });
                }
            });
            allResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'QuestionnaireResponse'; })
                .filter(function (questionnaireResponseTemp) { var _a; return ((_a = questionnaireResponseTemp.subject) === null || _a === void 0 ? void 0 : _a.reference) === "Patient/".concat(patient.id); })
                .forEach(function (questionnaireResponseTemp) {
                return questionnaireResponseTemp.id &&
                    deleteRequests.push({ method: 'DELETE', url: "/QuestionnaireResponse/".concat(questionnaireResponseTemp.id) });
            });
        }
    });
    console.log('Resources to be deleted:');
    deleteRequests.forEach(function (request) {
        var _a = request.url.slice(1).split('/'), resourceType = _a[0], id = _a[1];
        console.log("".concat(resourceType, ": ").concat(id));
    });
    if (person) {
        console.log("Person to be patched: ".concat(person.resourceType, ": ").concat(person.id));
    }
    else {
        console.log('No Person resource found');
    }
    return [deleteRequests, person];
};
var getAppointmentById = function (oystehr, appointmentId) { return __awaiter(void 0, void 0, void 0, function () {
    var fhirSearchParams;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fhirSearchParams = {
                    resourceType: 'Appointment',
                    params: [
                        {
                            name: '_id',
                            value: appointmentId,
                        },
                        {
                            name: '_include',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:slot',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'RelatedPerson:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:participant',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Person:relatedperson',
                        },
                    ],
                };
                return [4 /*yield*/, oystehr.fhir.search(fhirSearchParams)];
            case 1: return [2 /*return*/, (_a.sent()).unbundle()];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(deleteAppointmentData)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
// tsx ./scripts/delete-appointment-data.ts <env> <appointmentId>
