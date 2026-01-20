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
exports.performEffect = exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'bulk-update-insurance-status';
var BATCH_SIZE = 100;
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Stringified error: ' + JSON.stringify(error_1));
                console.error('Error: ' + error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (oystehr, params) { return __awaiter(void 0, void 0, void 0, function () {
    var insuranceIds, active, patchOp, batchRequests, requestChunks, i, chunk, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                insuranceIds = params.insuranceIds, active = params.active;
                if (insuranceIds.length === 0) {
                    return [2 /*return*/, {
                            message: 'No insurance IDs provided.',
                            updatedCount: 0,
                        }];
                }
                patchOp = {
                    op: 'replace',
                    path: '/active',
                    value: active,
                };
                batchRequests = insuranceIds.map(function (insuranceId) {
                    return (0, utils_1.getPatchBinary)({
                        resourceId: insuranceId,
                        resourceType: 'Organization',
                        patchOperations: [patchOp],
                    });
                });
                requestChunks = (0, utils_1.chunkThings)(batchRequests, BATCH_SIZE);
                console.log("Processing ".concat(insuranceIds.length, " insurance updates in ").concat(requestChunks.length, " batch(es)"));
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < requestChunks.length)) return [3 /*break*/, 6];
                chunk = requestChunks[i];
                console.log("Processing batch ".concat(i + 1, " of ").concat(requestChunks.length, " (").concat(chunk.length, " items)"));
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: chunk,
                    })];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                console.error("Error processing batch ".concat(i + 1, " of ").concat(requestChunks.length, ":"), JSON.stringify(error_2));
                throw new Error("Failed to update insurance statuses in batch ".concat(i + 1, " of ").concat(requestChunks.length));
            case 5:
                i++;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/, {
                    message: "Successfully updated ".concat(insuranceIds.length, " insurance(s) status to ").concat(active ? 'active' : 'inactive', "."),
                    updatedCount: insuranceIds.length,
                }];
        }
    });
}); };
exports.performEffect = performEffect;
