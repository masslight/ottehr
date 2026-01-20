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
var helpers_1 = require("../../shared/presigned-file-urls/helpers");
var z3Utils_1 = require("../../shared/z3Utils");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'upload-audio-recording';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedInput, secrets, visitID, fileZ3Url, presignedFileUploadUrl, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("handler() start.");
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, 5, 6]);
                validatedInput = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedInput.secrets, visitID = validatedInput.visitID;
                console.log("validatedInput => ");
                console.log(JSON.stringify(validatedInput));
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                console.log("Got m2mToken");
                fileZ3Url = (0, helpers_1.makeZ3UrlForVisitAudio)({ secrets: secrets, bucketName: 'audio-recordings', fileName: "".concat(visitID, ".webm") });
                return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(m2mToken, fileZ3Url, 'upload')];
            case 3:
                presignedFileUploadUrl = _a.sent();
                console.log("created fileZ3Url: [".concat(fileZ3Url, "] :: presignedFileUploadUrl: [").concat(presignedFileUploadUrl, "]"));
                response = {
                    z3URL: fileZ3Url,
                    presignedUploadUrl: presignedFileUploadUrl,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('upload-audio-recording', error_1, ENVIRONMENT)];
            case 5:
                console.log("handler() end");
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
