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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var validation_1 = require("./validation");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'cancel-radiology-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (unsafeInput) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, validatedInput, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                secrets = (0, validation_1.validateSecrets)(unsafeInput.secrets);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, (0, validation_1.validateInput)(unsafeInput, oystehr)];
            case 2:
                validatedInput = _a.sent();
                return [4 /*yield*/, performEffect(validatedInput, secrets, oystehr)];
            case 3:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 204,
                        body: JSON.stringify({}),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, unsafeInput.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (validatedInput, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehrServiceRequest;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, patchServiceRequestToRevokedInOystehr(validatedInput.body.serviceRequestId, oystehr)];
            case 1:
                oystehrServiceRequest = _a.sent();
                return [4 /*yield*/, updateServiceRequestToRevokedInAdvaPacs(oystehrServiceRequest, secrets)];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var patchServiceRequestToRevokedInOystehr = function (serviceRequestId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var currentServiceRequest, currentStatus, operations;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('setting status to revoked for service request', serviceRequestId);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'ServiceRequest',
                        id: serviceRequestId,
                    })];
            case 1:
                currentServiceRequest = _a.sent();
                currentStatus = currentServiceRequest.status;
                console.log("Saving previous status '".concat(currentStatus, "' for potential restoration"));
                operations = __spreadArray(__spreadArray([], (0, utils_1.createCancellationTagOperations)(currentStatus, currentServiceRequest.meta), true), [
                    {
                        op: 'replace',
                        path: '/status',
                        value: 'revoked',
                    },
                ], false);
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'ServiceRequest',
                        id: serviceRequestId,
                        operations: operations,
                    })];
            case 2: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var updateServiceRequestToRevokedInAdvaPacs = function (oystehrServiceRequest, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var advapacsClientId, advapacsClientSecret, advapacsAuthString, accessionNumber, findServiceRequestResponse, _a, _b, _c, _d, _e, maybeAdvaPACSSr, advapacsSR, advapacsResponse, _f, _g, _h, _j, _k, error_2;
    var _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                _o.trys.push([0, 8, , 9]);
                advapacsClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
                advapacsClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
                advapacsAuthString = "ID=".concat(advapacsClientId, ",Secret=").concat(advapacsClientSecret);
                accessionNumber = (_m = (_l = oystehrServiceRequest.identifier) === null || _l === void 0 ? void 0 : _l.find(function (identifier) { return identifier.system === shared_2.ACCESSION_NUMBER_CODE_SYSTEM; })) === null || _m === void 0 ? void 0 : _m.value;
                if (!accessionNumber) {
                    throw new Error('No accession number found in oystehr service request, cannot update AdvaPACS.');
                }
                return [4 /*yield*/, fetch("".concat(shared_2.ADVAPACS_FHIR_BASE_URL, "/ServiceRequest?identifier=").concat(shared_2.ACCESSION_NUMBER_CODE_SYSTEM, "%7C").concat(accessionNumber), {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                    })];
            case 1:
                findServiceRequestResponse = _o.sent();
                if (!!findServiceRequestResponse.ok) return [3 /*break*/, 3];
                _a = Error.bind;
                _c = (_b = "advapacs search errored out with statusCode ".concat(findServiceRequestResponse.status, ", status text ").concat(findServiceRequestResponse.statusText, ", and body ")).concat;
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, findServiceRequestResponse.json()];
            case 2: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_e.apply(_d, [_o.sent(), null, 2])])]))();
            case 3: return [4 /*yield*/, findServiceRequestResponse.json()];
            case 4:
                maybeAdvaPACSSr = _o.sent();
                if (maybeAdvaPACSSr.resourceType !== 'Bundle') {
                    throw new Error("Expected response to be Bundle but got ".concat(maybeAdvaPACSSr.resourceType));
                }
                if (maybeAdvaPACSSr.entry.length === 0) {
                    throw new Error("No service request found in AdvaPACS for accession number ".concat(accessionNumber));
                }
                if (maybeAdvaPACSSr.entry.length > 1) {
                    throw new Error("Found multiple service requests in AdvaPACS for accession number ".concat(accessionNumber, ", cannot update."));
                }
                advapacsSR = maybeAdvaPACSSr.entry[0].resource;
                return [4 /*yield*/, fetch("".concat(shared_2.ADVAPACS_FHIR_BASE_URL, "/ServiceRequest/").concat(advapacsSR.id), {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                        body: JSON.stringify(__assign(__assign({}, advapacsSR), { status: 'revoked' })),
                    })];
            case 5:
                advapacsResponse = _o.sent();
                if (!!advapacsResponse.ok) return [3 /*break*/, 7];
                _f = Error.bind;
                _h = (_g = "advapacs transaction errored out with statusCode ".concat(advapacsResponse.status, ", status text ").concat(advapacsResponse.statusText, ", and body ")).concat;
                _k = (_j = JSON).stringify;
                return [4 /*yield*/, advapacsResponse.json()];
            case 6: throw new (_f.apply(Error, [void 0, _h.apply(_g, [_k.apply(_j, [_o.sent(), null, 2])])]))();
            case 7: return [3 /*break*/, 9];
            case 8:
                error_2 = _o.sent();
                console.error('Error updating service request to revoked in AdvaPacs:', error_2);
                throw new Error('Failed to update service request to revoked in AdvaPacs');
            case 9: return [2 /*return*/];
        }
    });
}); };
