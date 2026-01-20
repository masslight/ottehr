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
var shared_1 = require("../../shared");
var z3Utils_1 = require("../../shared/z3Utils");
var validateRequestParameters_1 = require("./validateRequestParameters");
var logIt = function (msg) {
    console.log("PatientProfilePhoto: ".concat(msg));
};
var PATIENT_PHOTO_ID_PREFIX = 'patient-photo';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'get-patient-profile-photo-url';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, action, token, z3PhotoUrl, patientId, bucketName, presignedDownloadUrl, resolvedPresignedUrl, resolvedZ3ImageFileUrl, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({
                                message: "Invalid request parameters. ".concat(error.message || error),
                            }),
                        }];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                secrets = validatedParameters.secrets, action = validatedParameters.action;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                logIt("Got m2mToken");
                token = m2mToken;
                z3PhotoUrl = void 0;
                if (action === 'upload') {
                    patientId = validatedParameters.patientId;
                    bucketName = "".concat(PATIENT_PHOTO_ID_PREFIX, "s");
                    z3PhotoUrl = makeZ3Url({ secrets: secrets, bucketName: bucketName, patientId: patientId });
                    logIt("Created image's z3Url=[".concat(z3PhotoUrl, "]"));
                }
                else {
                    z3PhotoUrl = validatedParameters.z3PhotoUrl;
                }
                logIt("Pre-signing this URL ...");
                return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, z3PhotoUrl, action)];
            case 3:
                presignedDownloadUrl = _a.sent();
                logIt("Signed download URL value=[".concat(presignedDownloadUrl, "]"));
                resolvedPresignedUrl = presignedDownloadUrl;
                resolvedZ3ImageFileUrl = z3PhotoUrl;
                response = {
                    z3ImageUrl: resolvedZ3ImageFileUrl,
                    presignedImageUrl: resolvedPresignedUrl,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-patient-profile-photo', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var makeZ3Url = function (input) {
    var secrets = input.secrets, bucketName = input.bucketName, patientId = input.patientId;
    var fileType = 'patient-photo';
    var fileFormat = 'image';
    var projectId = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets);
    var fileURL = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/z3/").concat(projectId, "-").concat(bucketName, "/").concat(patientId, "/").concat(Date.now(), "-").concat(fileType, ".").concat(fileFormat);
    return fileURL;
};
