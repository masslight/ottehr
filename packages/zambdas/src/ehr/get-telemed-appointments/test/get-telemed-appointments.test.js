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
var sdk_1 = require("@oystehr/sdk");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var helpers_1 = require("../../../shared/helpers");
var fhir_resources_filters_1 = require("../helpers/fhir-resources-filters");
var fhir_utils_1 = require("../helpers/fhir-utils");
var mappers_1 = require("../helpers/mappers");
var test_data_1 = require("./test-data");
describe('Test "get-telemed-appointments" endpoint', function () {
    describe('Test "filterAppointmentsFromResources" function', function () {
        test('Map encounter statuses to telemed, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var status;
            return __generator(this, function (_a) {
                status = (0, utils_1.getTelemedVisitStatus)('planned', undefined);
                expect(status).toEqual('ready');
                status = (0, utils_1.getTelemedVisitStatus)('arrived', undefined);
                expect(status).toEqual('pre-video');
                status = (0, utils_1.getTelemedVisitStatus)('in-progress', undefined);
                expect(status).toEqual('on-video');
                status = (0, utils_1.getTelemedVisitStatus)('finished', undefined);
                expect(status).toEqual('unsigned');
                status = (0, utils_1.getTelemedVisitStatus)('finished', 'fulfilled');
                expect(status).toEqual('complete');
                status = (0, utils_1.getTelemedVisitStatus)('wrong', undefined);
                expect(status).toBeUndefined();
                return [2 /*return*/];
            });
        }); });
        test('Get video room extension from appointment and encounter, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var videoRoomExtension;
            return __generator(this, function (_a) {
                videoRoomExtension = (0, helpers_1.getVideoRoomResourceExtension)(test_data_1.virtualReadyAppointment);
                expect(videoRoomExtension).toBeDefined();
                videoRoomExtension = (0, helpers_1.getVideoRoomResourceExtension)(test_data_1.encounterWithVRExtension);
                expect(videoRoomExtension).toBeDefined();
                videoRoomExtension = (0, helpers_1.getVideoRoomResourceExtension)(test_data_1.appointmentWithoutVRExtension);
                expect(videoRoomExtension).toBeNull();
                return [2 /*return*/];
            });
        }); });
        test('Filter appointments from all resources, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var appointments;
            return __generator(this, function (_a) {
                appointments = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: test_data_1.allTestResources,
                    statusesFilter: ['ready'],
                    virtualLocationsMap: test_data_1.testVirtualLocationsMap,
                });
                expect(appointments[0].appointment).toEqual(test_data_1.virtualReadyAppointment);
                expect(appointments[0].paperwork).toEqual(test_data_1.questionnaireForReadyEncounter);
                appointments = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: test_data_1.allTestResources,
                    statusesFilter: ['pre-video'],
                    virtualLocationsMap: test_data_1.testVirtualLocationsMap,
                });
                expect(appointments[0].appointment).toEqual(test_data_1.virtualPreVideoAppointment);
                expect(appointments[0].paperwork).toEqual(test_data_1.questionnaireForPreVideoEncounter);
                appointments = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: test_data_1.allTestResources,
                    statusesFilter: ['on-video'],
                    virtualLocationsMap: test_data_1.testVirtualLocationsMap,
                });
                expect(appointments[0].appointment).toEqual(test_data_1.virtualOnVideoAppointment);
                appointments = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: test_data_1.allTestResources,
                    statusesFilter: ['unsigned'],
                    virtualLocationsMap: test_data_1.testVirtualLocationsMap,
                });
                expect(appointments[0].appointment).toEqual(test_data_1.virtualUnsignedAppointment);
                appointments = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: test_data_1.allTestResources,
                    statusesFilter: ['complete'],
                    virtualLocationsMap: test_data_1.testVirtualLocationsMap,
                });
                expect(appointments[0].appointment).toEqual(test_data_1.virtualCompleteAppointment);
                return [2 /*return*/];
            });
        }); });
    });
    describe('Test "getAllLocationIds" function', function () {
        var CLIENT_CONFIG = {
            accessToken: 'a',
            fhirApiUrl: 'a',
            projectApiUrl: 'a',
        };
        var oystehr = new sdk_1.default(CLIENT_CONFIG);
        oystehr.user.me = vitest_1.vi.fn(function () {
            return new Promise(function (resolve) {
                resolve({
                    id: '',
                    name: '',
                    email: '',
                    phoneNumber: '',
                    authenticationMethod: '',
                    profile: '',
                    accessPolicy: {
                        rule: [],
                    },
                });
            });
        });
        oystehr.fhir.get = vitest_1.vi.fn(function () {
            return new Promise(function (resolve) {
                resolve(test_data_1.myPractitioner);
            });
        });
        oystehr.fhir.search = vitest_1.vi.fn(function () {
            return new Promise(function (resolve) {
                resolve(test_data_1.allLocations);
            });
        });
        test('Getting practitioner license locations abbreviations, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var abbreviations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, fhir_utils_1.getPractitionerLicensesLocationsAbbreviations)(oystehr)];
                    case 1:
                        abbreviations = _a.sent();
                        expect(abbreviations).toEqual(['LA', 'NY']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('Questionnaire tests', function () {
        test('Test questionnaire to encounters mapping, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mapAll;
            return __generator(this, function (_a) {
                mapAll = (0, mappers_1.mapQuestionnaireToEncountersIds)(test_data_1.allTestResources);
                expect(mapAll[test_data_1.virtualReadyAppointmentEncounter.id]).toEqual(test_data_1.questionnaireForReadyEncounter);
                expect(mapAll[test_data_1.virtualPreVideoAppointmentEncounter.id]).toEqual(test_data_1.questionnaireForPreVideoEncounter);
                return [2 /*return*/];
            });
        }); });
    });
    describe('Encounter tests', function () {
        test('Test encounter status history mapping, success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var history;
            return __generator(this, function (_a) {
                history = (0, utils_1.getTelemedEncounterStatusHistory)(test_data_1.fullEncounterStatusHistory, 'arrived');
                expect(history).toEqual(test_data_1.unsignedEncounterMappedStatusHistory);
                history = (0, utils_1.getTelemedEncounterStatusHistory)(test_data_1.fullEncounterStatusHistory, 'fulfilled');
                expect(history).toEqual(test_data_1.completeEncounterMappedStatusHistory);
                return [2 /*return*/];
            });
        }); });
    });
});
