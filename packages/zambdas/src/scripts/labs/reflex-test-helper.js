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
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var lab_script_consts_1 = require("./lab-script-consts");
var lab_script_helpers_1 = require("./lab-script-helpers");
// Creates a DiagnosticReport and Observation(s) to mock a reflex test
// npm run mock-reflex-test ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]
var EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
var REFLEX_TEST_CODE = {
    coding: [
        {
            code: '3051-0',
            system: 'http://loinc.org',
            display: 'Free T3, Blood',
        },
    ],
};
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var ENV, serviceRequestId, envConfig, token, oystehr, serviceRequest, _a, resultResources, requests, drToDuplicate, drContainedSpecimen, drContainedSpecimenRef, relatedObservations, resultRefsForReflexTest, reflexDR, randomString, fillerIdIdx, drFullUrl, projectId, patientRef, attachmentDocRef, bundle;
    var _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                if (process.argv.length !== 4) {
                    console.log("exiting, incorrect number of arguments passed\n");
                    console.log("Usage: npm run mock-reflex-test [".concat(EXAMPLE_ENVS.join(' | '), "] [serviceRequest Id]\n"));
                    process.exit(1);
                }
                ENV = process.argv[2];
                serviceRequestId = process.argv[3];
                try {
                    envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                }
                catch (error) {
                    console.error("Error parsing secrets for ENV '".concat(ENV, "'. Error: ").concat(JSON.stringify(error)));
                }
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
            case 1:
                token = _h.sent();
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = (0, shared_1.createOystehrClient)(token, envConfig);
                _h.label = 2;
            case 2:
                _h.trys.push([2, 4, , 5]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'ServiceRequest',
                        id: serviceRequestId,
                    })];
            case 3:
                serviceRequest = _h.sent();
                return [3 /*break*/, 5];
            case 4:
                _a = _h.sent();
                console.log("exiting, no service request found with that ID in this env\n");
                process.exit(1);
                return [3 /*break*/, 5];
            case 5:
                if (!serviceRequest) {
                    console.log("exiting, no service request found with that ID in this env\n");
                    process.exit(1);
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: [
                            {
                                name: 'based-on',
                                value: "ServiceRequest/".concat(serviceRequestId),
                            },
                            {
                                name: '_include:iterate',
                                value: 'DiagnosticReport:result',
                            },
                        ],
                    })];
            case 6:
                resultResources = (_h.sent()).unbundle();
                if (!resultResources.length || !resultResources) {
                    console.log("exiting, no diagnostic reports found for that service request in this env\n");
                    process.exit(1);
                }
                requests = [];
                drToDuplicate = resultResources.find(function (resource) {
                    var _a, _b;
                    return resource.resourceType === 'DiagnosticReport' &&
                        !((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.some(function (tag) { return tag.system === utils_1.LAB_DR_TYPE_TAG.system && tag.display === utils_1.LAB_DR_TYPE_TAG.display.reflex; }));
                });
                console.log('DiagnosticReport that will be used to make the reflex test DR - ', drToDuplicate.id);
                drContainedSpecimen = {
                    resourceType: 'Specimen',
                    id: 'resultSpecimenId',
                    collection: {
                        quantity: {
                            system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-result-collection-volume',
                            code: '2100',
                            unit: 'mL',
                        },
                        collectedDateTime: luxon_1.DateTime.now().toISO(),
                    },
                };
                drContainedSpecimenRef = {
                    reference: '#resultSpecimenId',
                };
                // add specimen info if there isn't any
                if (!drToDuplicate.specimen) {
                    drToDuplicate.specimen = [drContainedSpecimenRef];
                    if ((_b = drToDuplicate.contained) === null || _b === void 0 ? void 0 : _b.length)
                        drToDuplicate.contained.push(drContainedSpecimen);
                    else
                        drToDuplicate.contained = [drContainedSpecimen];
                }
                relatedObservations = [];
                (_c = drToDuplicate.result) === null || _c === void 0 ? void 0 : _c.forEach(function (result) {
                    var _a;
                    var obsID = (_a = result.reference) === null || _a === void 0 ? void 0 : _a.replace('Observation/', '');
                    var observationReturned = resultResources.find(function (resource) { return resource.resourceType === 'Observation' && resource.id === obsID; });
                    relatedObservations.push(observationReturned);
                });
                resultRefsForReflexTest = [];
                relatedObservations.forEach(function (obs) {
                    var obsFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                    resultRefsForReflexTest.push({ reference: obsFullUrl });
                    var newObsResource = __assign({}, obs);
                    delete newObsResource.id;
                    delete newObsResource.meta;
                    requests.push({
                        method: 'POST',
                        url: '/Observation',
                        resource: newObsResource,
                        fullUrl: obsFullUrl,
                    });
                });
                reflexDR = __assign(__assign({}, drToDuplicate), { code: REFLEX_TEST_CODE });
                reflexDR.meta = {};
                reflexDR.meta.tag = [lab_script_consts_1.DR_REFLEX_TAG];
                reflexDR.result = resultRefsForReflexTest;
                randomString = Math.random().toString(36).substring(2, 14).toUpperCase();
                fillerIdIdx = (_d = reflexDR.identifier) === null || _d === void 0 ? void 0 : _d.findIndex(function (item) { var _a, _b; return ((_b = (_a = item.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === 'FILL'; });
                if (fillerIdIdx !== undefined && fillerIdIdx >= 0 && ((_e = reflexDR.identifier) === null || _e === void 0 ? void 0 : _e[fillerIdIdx])) {
                    reflexDR.identifier[fillerIdIdx].value = randomString;
                }
                // remove existing id and hl7 extension and basedOn
                // in bundled orders world we wont know which test in the bundle triggered the reflex test, so no basedOn
                delete reflexDR.id;
                delete reflexDR.basedOn;
                drFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                requests.push({
                    method: 'POST',
                    fullUrl: drFullUrl,
                    url: '/DiagnosticReport',
                    resource: reflexDR,
                });
                projectId = envConfig.PROJECT_ID;
                if (!projectId)
                    throw new Error("Could not get projectId");
                patientRef = ((_f = serviceRequest.subject.reference) === null || _f === void 0 ? void 0 : _f.startsWith('Patient/')) ? serviceRequest.subject : undefined;
                attachmentDocRef = (0, lab_script_helpers_1.createResultAttachmentDocRef)({
                    ENV: ENV,
                    projectId: projectId,
                    relatedDiagnosticReportReferences: [{ reference: drFullUrl }],
                    encounterRef: serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.encounter,
                    patientRef: patientRef,
                });
                requests.push({
                    method: 'POST',
                    url: '/DocumentReference',
                    resource: attachmentDocRef,
                });
                console.log('making transaction request');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 7:
                bundle = _h.sent();
                console.log('Successfully created all resources:');
                (_g = bundle.entry) === null || _g === void 0 ? void 0 : _g.forEach(function (entry) {
                    var _a, _b;
                    console.log("".concat((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType, "/").concat((_b = entry.resource) === null || _b === void 0 ? void 0 : _b.id));
                });
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log(error, JSON.stringify(error, null, 2));
    throw error;
});
