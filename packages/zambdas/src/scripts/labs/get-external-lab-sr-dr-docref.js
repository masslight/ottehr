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
var fs_1 = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var ENV, orderNumber, envConfig, token, oystehr, resources, allDiagnosticReports, emptyGroupedResources, resourcesByDiagnosticReportRef, _i, _a, _b, key, resources_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (process.argv.length !== 4) {
                    console.log("exiting, incorrect number of arguments passed\n");
                    console.log("Usage: npm run get-lab-sr-dr-docref [orderNumber] [".concat(EXAMPLE_ENVS.join(' | '), "]\n"));
                    process.exit(1);
                }
                ENV = process.argv[3];
                orderNumber = process.argv[2];
                try {
                    envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                }
                catch (error) {
                    console.error("Error parsing secrets for ENV '".concat(ENV, "'. Error: ").concat(JSON.stringify(error)));
                }
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
            case 1:
                token = _c.sent();
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = (0, shared_1.createOystehrClient)(token, envConfig);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: [
                            {
                                name: 'identifier',
                                value: "".concat(orderNumber), // order number or accession number
                            },
                            {
                                name: '_include',
                                value: 'DiagnosticReport:based-on',
                            },
                            {
                                name: '_revinclude',
                                value: 'DocumentReference:related',
                            },
                        ],
                    })];
            case 2:
                resources = (_c.sent()).unbundle();
                allDiagnosticReports = resources.filter(function (res) {
                    return res.resourceType === 'DiagnosticReport';
                });
                emptyGroupedResources = {
                    testName: '',
                    diagnosticReportRef: '',
                    resultType: undefined,
                    documentReferenceInfo: [],
                };
                resourcesByDiagnosticReportRef = new Map();
                allDiagnosticReports.forEach(function (dr) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    var srRef = (_b = (_a = dr.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (basedOn) { var _a; return (_a = basedOn.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _b === void 0 ? void 0 : _b.reference;
                    var resultType = (_f = (_e = (_d = (_c = dr.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d.find(function (tag) { return tag.system === utils_1.LAB_DR_TYPE_TAG.system; })) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : utils_1.LabType.external;
                    var drRef = "DiagnosticReport/".concat(dr.id);
                    var testName = (_j = (_h = (_g = dr.code.coding) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.display) !== null && _j !== void 0 ? _j : '';
                    resourcesByDiagnosticReportRef.set(drRef, __assign(__assign(__assign(__assign({}, emptyGroupedResources), { testName: testName, diagnosticReportRef: drRef }), (srRef ? { serviceRequestIdRef: srRef } : {})), { resultType: resultType }));
                });
                resources.forEach(function (res) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                    if (res.resourceType === 'DocumentReference') {
                        var documentReferenceRef = "DocumentReference/".concat(res.id);
                        var docRefDrRef = (_c = (_b = (_a = res.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.find(function (related) { var _a; return (_a = related.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport/'); })) === null || _c === void 0 ? void 0 : _c.reference;
                        if (!docRefDrRef)
                            return;
                        var groupedResources = resourcesByDiagnosticReportRef.get(docRefDrRef);
                        if (!groupedResources) {
                            console.warn("".concat(documentReferenceRef, " has a related DR but that DR wasn't in our map"));
                            return;
                        }
                        var existingDocRefInfo = __spreadArray([], groupedResources.documentReferenceInfo, true);
                        var docRefTypeCoding = (_e = (_d = res.type) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0];
                        if (!docRefTypeCoding) {
                            console.warn("No docRefCoding for ".concat(documentReferenceRef));
                            return;
                        }
                        var isHL7Transmission = docRefTypeCoding.system === utils_1.LAB_RESULT_HL7_DOC_REF_CODING_CODE.system &&
                            docRefTypeCoding.code === utils_1.LAB_RESULT_HL7_DOC_REF_CODING_CODE.code;
                        // the transmission docRef is being superseded so we'll have a different branch of logic for that
                        if (!isHL7Transmission && res.status === 'current') {
                            // if (docRefTypeCoding.system !== LAB_RESULT_DOC_REF_CODING_CODE.system && docRefTypeCoding.code !== LAB_RESULT_DOC_REF_CODING_CODE.code) return;
                            existingDocRefInfo.push({
                                documentReferenceRef: documentReferenceRef,
                                documentReferenceType: (_f = docRefTypeCoding.display) !== null && _f !== void 0 ? _f : '',
                                lastUpdated: (_h = (_g = res.meta) === null || _g === void 0 ? void 0 : _g.lastUpdated) !== null && _h !== void 0 ? _h : '',
                                status: res.status,
                            });
                        }
                        else if (isHL7Transmission) {
                            var hl7B64 = (_j = res.content.find(function (cont) { return cont.attachment.contentType === 'hl7'; })) === null || _j === void 0 ? void 0 : _j.attachment.data;
                            existingDocRefInfo.push({
                                documentReferenceRef: documentReferenceRef,
                                documentReferenceType: (_k = docRefTypeCoding.display) !== null && _k !== void 0 ? _k : '',
                                lastUpdated: (_m = (_l = res.meta) === null || _l === void 0 ? void 0 : _l.lastUpdated) !== null && _m !== void 0 ? _m : '',
                                status: res.status,
                                hl7: hl7B64 ? safeDecodeBase64String(hl7B64) : 'No HL7 found',
                            });
                        }
                        resourcesByDiagnosticReportRef.set(docRefDrRef, __assign(__assign({}, groupedResources), { documentReferenceInfo: existingDocRefInfo }));
                    }
                });
                console.log("Found ".concat(allDiagnosticReports.length, " DiagnosticReport resources:\n\n"));
                for (_i = 0, _a = resourcesByDiagnosticReportRef.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], resources_1 = _b[1];
                    console.log("Resources for: ".concat(key));
                    console.log(JSON.stringify(resources_1, undefined, 2));
                    console.log();
                }
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log(error, JSON.stringify(error, null, 2));
    throw error;
});
/**
 * Safely decode a base64 encoded string. If the input is not base64 encoded, it is returned as is.
 * @param input a string that is maybe base64 encoded
 * @returns
 */
function safeDecodeBase64String(input) {
    var buff = Buffer.from(input, 'base64');
    if (buff.toString('base64') !== input) {
        return input;
    }
    return buff.toString('utf-8');
}
