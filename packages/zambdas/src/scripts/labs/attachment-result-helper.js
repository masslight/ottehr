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
var fs_1 = require("fs");
var shared_1 = require("../../shared");
var lab_script_consts_1 = require("./lab-script-consts");
var lab_script_helpers_1 = require("./lab-script-helpers");
// Creates a DiagnosticReport and an Observation to mock a pdf attachment
// npm run mock-pdf-result ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var ENV, serviceRequestId, envConfig, projectId, token, oystehr, serviceRequest, _a, encounterRef, patientRef, resultResources, requests, diagnosticReports, relatedDiagnosticReportReferences, docRef, bundle;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                if (process.argv.length !== 4) {
                    console.log("exiting, incorrect number of arguments passed\n");
                    console.log("Usage: npm run mock-attachment-result [".concat(lab_script_consts_1.EXAMPLE_ENVS.join(' | '), "] [serviceRequest Id]\n"));
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
                projectId = envConfig.PROJECT_ID;
                if (!projectId)
                    throw new Error("Could not get projectId");
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
            case 1:
                token = _d.sent();
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = (0, shared_1.createOystehrClient)(token, envConfig);
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'ServiceRequest',
                        id: serviceRequestId,
                    })];
            case 3:
                serviceRequest = _d.sent();
                return [3 /*break*/, 5];
            case 4:
                _a = _d.sent();
                console.log("exiting, no service request found with that ID in this env\n");
                process.exit(1);
                return [3 /*break*/, 5];
            case 5:
                if (!serviceRequest) {
                    console.log("exiting, no service request found with that ID in this env\n");
                    process.exit(1);
                }
                encounterRef = serviceRequest.encounter;
                patientRef = ((_b = serviceRequest.subject.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/')) ? serviceRequest.subject : undefined;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: [
                            {
                                name: 'based-on',
                                value: "ServiceRequest/".concat(serviceRequestId),
                            },
                        ],
                    })];
            case 6:
                resultResources = (_d.sent()).unbundle();
                if (!resultResources.length || !resultResources) {
                    console.log("exiting, no diagnostic reports found for that service request in this env\n");
                    process.exit(1);
                }
                requests = [];
                diagnosticReports = resultResources.filter(function (resource) { return resource.resourceType === 'DiagnosticReport'; });
                relatedDiagnosticReportReferences = diagnosticReports.map(function (dr) { return ({ reference: "DiagnosticReport/".concat(dr.id) }); });
                docRef = (0, lab_script_helpers_1.createResultAttachmentDocRef)({
                    ENV: ENV,
                    projectId: projectId,
                    relatedDiagnosticReportReferences: relatedDiagnosticReportReferences,
                    encounterRef: encounterRef,
                    patientRef: patientRef,
                });
                requests.push({
                    method: 'POST',
                    url: '/DocumentReference',
                    resource: docRef,
                });
                console.log('making transaction request');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 7:
                bundle = _d.sent();
                console.log('Successfully created all resources:');
                (_c = bundle.entry) === null || _c === void 0 ? void 0 : _c.forEach(function (entry) {
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
