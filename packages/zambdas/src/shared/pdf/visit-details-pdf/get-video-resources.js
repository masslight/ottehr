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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentAndRelatedResources = void 0;
var utils_1 = require("utils");
var helpers_1 = require("../../helpers");
var getAppointmentAndRelatedResources = function (oystehr, appointmentId, inPerson, encounterId) { return __awaiter(void 0, void 0, void 0, function () {
    var searchParams, items, appointment, encounter, mainEncounter, chargeItem, patient, account, location, questionnaireResponse, practitioners, documentReferences, coverage, schedule, listResources, timezone;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                searchParams = encounterId
                    ? [
                        {
                            name: '_id',
                            value: encounterId,
                        },
                        {
                            name: '_include',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_include',
                            value: 'Encounter:part-of',
                        },
                        {
                            name: '_revinclude',
                            value: 'ChargeItem:context',
                        },
                        {
                            name: '_include',
                            value: 'Encounter:subject',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Schedule:actor:Location',
                        },
                        { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' },
                        {
                            name: '_include:iterate',
                            value: 'Encounter:participant:Practitioner',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Account:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Coverage:beneficiary',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'List:patient',
                        },
                    ]
                    : [
                        {
                            name: 'appointment',
                            value: "Appointment/".concat(appointmentId),
                        },
                        {
                            name: '_include',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_revinclude',
                            value: 'ChargeItem:context',
                        },
                        {
                            name: '_include',
                            value: 'Encounter:subject',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Schedule:actor:Location',
                        },
                        { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' },
                        {
                            name: '_include:iterate',
                            value: 'Encounter:participant:Practitioner',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Account:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Coverage:beneficiary',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'List:patient',
                        },
                    ];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: searchParams,
                    })];
            case 1:
                items = (_a.sent())
                    .unbundle()
                    .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                appointment = items.find(function (item) {
                    return item.resourceType === 'Appointment';
                });
                if (!appointment)
                    return [2 /*return*/, undefined];
                encounter = items.find(function (item) {
                    return (item.resourceType === 'Encounter' &&
                        (inPerson || (0, helpers_1.getVideoRoomResourceExtension)(item)) &&
                        (encounterId ? item.id === encounterId : !item.partOf));
                });
                if (!encounter)
                    return [2 /*return*/, undefined];
                mainEncounter = items.find(function (item) {
                    return item.resourceType === 'Encounter' && !item.partOf;
                });
                chargeItem = items.find(function (item) {
                    return item.resourceType === 'ChargeItem';
                });
                patient = items.find(function (item) {
                    return item.resourceType === 'Patient';
                });
                account = items.find(function (item) {
                    return item.resourceType === 'Account';
                });
                location = items.find(function (item) {
                    return item.resourceType === 'Location';
                });
                questionnaireResponse = items === null || items === void 0 ? void 0 : items.find(function (item) { return item.resourceType === 'QuestionnaireResponse'; });
                practitioners = items.filter(function (item) {
                    return item.resourceType === 'Practitioner';
                });
                documentReferences = items.filter(function (item) {
                    return item.resourceType === 'DocumentReference';
                });
                coverage = items === null || items === void 0 ? void 0 : items.find(function (item) {
                    return item.resourceType === 'Coverage';
                });
                schedule = items === null || items === void 0 ? void 0 : items.find(function (item) {
                    return item.resourceType === 'Schedule';
                });
                listResources = items.filter(function (item) { return item.resourceType === 'List'; });
                timezone = (0, helpers_1.resolveTimezone)(schedule, location);
                return [2 /*return*/, {
                        appointment: appointment,
                        encounter: encounter,
                        mainEncounter: mainEncounter,
                        chargeItem: chargeItem,
                        patient: patient,
                        account: account,
                        location: location,
                        questionnaireResponse: questionnaireResponse,
                        practitioners: practitioners,
                        documentReferences: documentReferences,
                        coverage: coverage,
                        listResources: listResources,
                        timezone: timezone,
                    }];
        }
    });
}); };
exports.getAppointmentAndRelatedResources = getAppointmentAndRelatedResources;
