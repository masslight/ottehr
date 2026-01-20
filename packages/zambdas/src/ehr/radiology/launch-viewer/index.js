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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var validation_1 = require("./validation");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'radiology-launch-viewer';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (unsafeInput) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, validatedInput, result, error_1;
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
                return [4 /*yield*/, performEffect(validatedInput, secrets)];
            case 3:
                result = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(result),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, unsafeInput.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (validatedInput, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var serviceRequest, advapacsClientId, advapacsClientSecret, advapacsViewerUsername, advapacsAuthString, accessionNumber, patientId, advapacsLaunchBody, response, _a, _b, _c, _d, _e, responseJSON, error_2;
    var _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                serviceRequest = validatedInput.serviceRequest;
                _j.label = 1;
            case 1:
                _j.trys.push([1, 6, , 7]);
                advapacsClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
                advapacsClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
                advapacsViewerUsername = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_VIEWER_USERNAME, secrets);
                advapacsAuthString = "ID=".concat(advapacsClientId, ",Secret=").concat(advapacsClientSecret);
                accessionNumber = (_g = (_f = serviceRequest.identifier) === null || _f === void 0 ? void 0 : _f.find(function (identifier) { return identifier.system === shared_2.ACCESSION_NUMBER_CODE_SYSTEM; })) === null || _g === void 0 ? void 0 : _g.value;
                if (!accessionNumber) {
                    throw new Error('No accession number found in oystehr service request.');
                }
                patientId = (_h = serviceRequest.subject.reference) === null || _h === void 0 ? void 0 : _h.split('/')[1];
                if (!patientId) {
                    throw new Error('No patient ID found in oystehr service request.');
                }
                advapacsLaunchBody = {
                    // cSpell:disable-next meddream
                    viewer: 'meddream',
                    patientId: patientId,
                    accessionNumber: [accessionNumber],
                    username: advapacsViewerUsername,
                };
                console.log("Launching AdvaPacs viewer with body: ".concat(JSON.stringify(advapacsLaunchBody)));
                return [4 /*yield*/, fetch(shared_2.ADVAPACS_VIEWER_LAUNCH_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: advapacsAuthString,
                        },
                        body: JSON.stringify(advapacsLaunchBody),
                    })];
            case 2:
                response = _j.sent();
                if (!!response.ok) return [3 /*break*/, 4];
                _a = Error.bind;
                _c = (_b = "advapacs request errored out with statusCode ".concat(response.status, ", status text ").concat(response.statusText, ", and body ")).concat;
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, response.json()];
            case 3: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_e.apply(_d, [_j.sent(), null, 2])])]))();
            case 4: return [4 /*yield*/, response.json()];
            case 5:
                responseJSON = _j.sent();
                if (responseJSON == null || responseJSON.url == null) {
                    throw new Error("Expected response to include url to return to launch viewer.");
                }
                return [2 /*return*/, {
                        url: responseJSON.url,
                    }];
            case 6:
                error_2 = _j.sent();
                console.error('Error launching viewer:', error_2);
                throw new Error('Failed to launch viewer');
            case 7: return [2 /*return*/];
        }
    });
}); };
