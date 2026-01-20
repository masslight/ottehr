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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('get-label-pdf', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, contextRelatedReference, searchParams, secrets, oystehr, labelDocRefs, labelPdfs_1, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), contextRelatedReference = _a.contextRelatedReference, searchParams = _a.searchParams, secrets = _a.secrets;
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                console.log('token', m2mToken);
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DocumentReference',
                        params: __spreadArray([{ name: 'related', value: contextRelatedReference.reference }], searchParams, true),
                    })];
            case 2:
                labelDocRefs = (_b.sent()).unbundle();
                if (!labelDocRefs.length) {
                    throw Error("Found no DocumentReferences matching contextRelatedREference ".concat(JSON.stringify(contextRelatedReference), " and params ").concat(JSON.stringify(searchParams)));
                }
                labelPdfs_1 = [];
                return [4 /*yield*/, Promise.allSettled(labelDocRefs.map(function (labelDocRef) { return __awaiter(void 0, void 0, void 0, function () {
                        var url, presignedURL;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    url = (_a = labelDocRef.content.find(function (content) { return content.attachment.contentType === utils_1.MIME_TYPES.PDF; })) === null || _a === void 0 ? void 0 : _a.attachment.url;
                                    if (!url) {
                                        throw new Error('No url found matching an application/pdf');
                                    }
                                    return [4 /*yield*/, (0, utils_1.getPresignedURL)(url, m2mToken)];
                                case 1:
                                    presignedURL = _b.sent();
                                    if (!presignedURL) {
                                        throw new Error("Failed to get presigned URL for ".concat(url));
                                    }
                                    return [2 /*return*/, {
                                            type: utils_1.LabDocumentType.label,
                                            documentReference: labelDocRef,
                                            presignedURL: presignedURL,
                                        }];
                            }
                        });
                    }); })).then(function (results) {
                        results.forEach(function (result) {
                            if (result.status === 'fulfilled') {
                                labelPdfs_1.push(result.value);
                            }
                        });
                    })];
            case 3:
                _b.sent();
                return [2 /*return*/, {
                        body: JSON.stringify(labelPdfs_1),
                        statusCode: 200,
                    }];
            case 4:
                error_1 = _b.sent();
                console.log(error_1);
                console.log('get label pdf error:', JSON.stringify(error_1));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-get-label-pdf', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
