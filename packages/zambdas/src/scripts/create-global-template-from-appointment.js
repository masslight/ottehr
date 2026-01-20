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
var sdk_1 = require("@oystehr/sdk");
var utils_1 = require("utils");
var uuid_1 = require("uuid");
var shared_1 = require("../shared");
var templates_1 = require("../shared/templates");
var helpers_1 = require("./helpers");
var getOystehr = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var token;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 1:
                token = _a.sent();
                if (!token)
                    throw new Error('Failed to fetch auth token.');
                return [2 /*return*/, new sdk_1.default({
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(config.AUTH0_AUDIENCE),
                        accessToken: token,
                    })];
        }
    });
}); };
var APPOINTMENT_ID = '466c3232-d06e-4d76-8d6a-a6eaa12057c9';
var TITLE = '';
function createGlobalTemplateFromAppointment(config) {
    return __awaiter(this, void 0, void 0, function () {
        var oystehr, appointmentBundle, listToCreate, stubPatient, oldIdToNewIdMap, seenTags, _i, _a, entry, anonymizedResource, newId, oldEncounter, stubEncounter;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0: return [4 /*yield*/, getOystehr(config)];
                case 1:
                    oystehr = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: APPOINTMENT_ID },
                                { name: '_revinclude', value: 'Encounter:appointment' },
                                // { name: '_revinclude:iterate', value: 'Observation:encounter' },
                                // { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
                                // { name: '_revinclude:iterate', value: 'Communication:encounter' },
                                { name: '_revinclude:iterate', value: 'Condition:encounter' },
                            ],
                        })];
                case 2:
                    appointmentBundle = _f.sent();
                    // console.log(JSON.stringify(appointmentBundle));
                    if (!appointmentBundle.entry) {
                        console.log('No entries found in appointment bundle, cannot make a template');
                        return [2 /*return*/];
                    }
                    listToCreate = {
                        resourceType: 'List',
                        code: {
                            coding: [
                                {
                                    system: templates_1.GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
                                    code: "default",
                                    version: utils_1.examConfig.inPerson.default.version,
                                    display: 'Global Template In-Person',
                                },
                            ],
                        },
                        status: 'current',
                        mode: 'working',
                        title: TITLE,
                        entry: [],
                        contained: [],
                    };
                    stubPatient = {
                        resourceType: 'Patient',
                        id: (0, uuid_1.v4)(),
                        name: [
                            {
                                family: 'stub',
                                given: ['placeholder'],
                            },
                        ],
                    };
                    listToCreate.contained.push(stubPatient);
                    listToCreate.entry.push({
                        item: {
                            reference: "#".concat(stubPatient.id),
                        },
                    });
                    oldIdToNewIdMap = new Map();
                    // Sort and take most only the most recent resource matching tags for resources subject to the bug that leads to multiple resources with the same meta tag.
                    // Sort by lastUpdated
                    appointmentBundle.entry.sort(function (a, b) {
                        var _a, _b;
                        if (!a.resource || !b.resource)
                            return 0;
                        if (!((_a = a.resource.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated) || !((_b = b.resource.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated))
                            return 0;
                        return a.resource.meta.lastUpdated > b.resource.meta.lastUpdated ? 1 : -1;
                    });
                    seenTags = new Set();
                    appointmentBundle.entry = appointmentBundle.entry.filter(function (entry) {
                        var _a, _b, _c, _d;
                        if (((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Condition')
                            return true;
                        var tags = (_d = (_c = (_b = entry.resource) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d.map(function (tag) { return "".concat(tag.system, "|").concat(tag.code); });
                        if (!tags)
                            return true;
                        var isDuplicate = tags.some(function (tag) { return seenTags.has(tag); });
                        if (!isDuplicate)
                            tags.forEach(function (tag) { return seenTags.add(tag); });
                        return !isDuplicate;
                    });
                    console.log('count of resources', appointmentBundle.entry.length);
                    // let counter = 0;
                    // let observationCounter = 0;
                    for (_i = 0, _a = appointmentBundle.entry; _i < _a.length; _i++) {
                        entry = _a[_i];
                        // We need to push each resource into `contained` and also put a reference to the contained resource in `entry`
                        if (!entry.resource)
                            continue;
                        // Skip the Appointment that was just used to fetch through to the resources we want.
                        if (entry.resource.resourceType === 'Appointment')
                            continue;
                        // Skip the Encounter that was just used to fetch through to the resources we want.
                        if (entry.resource.resourceType === 'Encounter')
                            continue;
                        anonymizedResource = __assign({}, entry.resource);
                        (_b = anonymizedResource.meta) === null || _b === void 0 ? true : delete _b.versionId;
                        (_c = anonymizedResource.meta) === null || _c === void 0 ? true : delete _c.lastUpdated;
                        delete anonymizedResource.encounter;
                        // The stub patient makes the resources that require a subject valid
                        anonymizedResource.subject = {
                            reference: "#".concat(stubPatient.id),
                        };
                        newId = (0, uuid_1.v4)();
                        oldIdToNewIdMap.set(entry.resource.id, newId);
                        anonymizedResource.id = newId;
                        // if (entry.resource.resourceType === 'Condition') {
                        //   console.log('new id and old id', newId, entry.resource.id);
                        // }
                        // if (counter < 90) {
                        listToCreate.contained.push(anonymizedResource);
                        listToCreate.entry.push({
                            item: {
                                reference: "#".concat(anonymizedResource.id),
                            },
                        });
                        // counter++;
                        // if (entry.resource.resourceType === 'Observation') observationCounter++; //TODO temp
                    }
                    oldEncounter = appointmentBundle.entry.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Encounter'; });
                    if (!oldEncounter) {
                        throw new Error('Unexpectedly found no Encounter when preparing template');
                    }
                    stubEncounter = {
                        resourceType: 'Encounter',
                        id: (0, uuid_1.v4)(),
                        status: 'unknown', // Stub will be replaced when template is applied.
                        class: {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', // Stub will be replaced when template is applied.
                            code: 'AMB',
                            display: 'Ambulatory',
                        },
                        diagnosis: (_e = (_d = oldEncounter.resource) === null || _d === void 0 ? void 0 : _d.diagnosis) === null || _e === void 0 ? void 0 : _e.map(function (diagnosis) {
                            var _a, _b, _c;
                            if (!((_a = diagnosis.condition) === null || _a === void 0 ? void 0 : _a.reference)) {
                                throw new Error('Unexpectedly found no condition reference in diagnosis');
                            }
                            // We keep this information when the template is applied. This is why we make the encounter stub.
                            return __assign(__assign({}, diagnosis), { condition: {
                                    reference: "Condition/".concat(oldIdToNewIdMap.get((_c = (_b = diagnosis.condition) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1])),
                                } });
                        }),
                    };
                    listToCreate.contained.push(stubEncounter);
                    listToCreate.entry.push({
                        item: {
                            reference: "#".concat(stubEncounter.id),
                        },
                    });
                    console.log(JSON.stringify(listToCreate, null, 2));
                    return [2 /*return*/];
            }
        });
    });
}
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(createGlobalTemplateFromAppointment)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                e_1 = _a.sent();
                console.log('Catch some error while running all effects: ', e_1);
                console.log('Stringifies: ', JSON.stringify(e_1));
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
