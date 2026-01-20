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
exports.validateSecrets = exports.validateInput = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateInput = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedBody, callerAccessToken;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, validateBody(input, oystehr)];
            case 1:
                validatedBody = _a.sent();
                callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
                if (callerAccessToken == null) {
                    throw new Error('Caller access token is required');
                }
                return [2 /*return*/, {
                        body: validatedBody,
                        callerAccessToken: callerAccessToken,
                    }];
        }
    });
}); };
exports.validateInput = validateInput;
var validateBody = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var serviceRequestId, serviceRequest, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                serviceRequestId = (0, shared_1.validateJsonBody)(input).serviceRequestId;
                if (!(0, utils_1.isValidUUID)(serviceRequestId)) {
                    throw new Error('serviceRequestId is required and must be a uuid');
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'ServiceRequest',
                        id: serviceRequestId,
                    })];
            case 2:
                serviceRequest = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                if (error_1 instanceof Error) {
                    console.log('Error fetching ServiceRequest in validate body: ', error_1.message);
                }
                throw new Error('Error fetching ServiceRequest in validate body');
            case 4:
                if ((0, utils_1.isDeletedServiceRequest)(serviceRequest)) {
                    throw new Error('Order has already been canceled and cannot be canceled again');
                }
                return [2 /*return*/, {
                        serviceRequestId: serviceRequestId,
                    }];
        }
    });
}); };
var validateSecrets = function (secrets) {
    if (!secrets) {
        throw new Error('Secrets are required');
    }
    var ADVAPACS_CLIENT_ID = secrets.ADVAPACS_CLIENT_ID, ADVAPACS_CLIENT_SECRET = secrets.ADVAPACS_CLIENT_SECRET, AUTH0_ENDPOINT = secrets.AUTH0_ENDPOINT, AUTH0_CLIENT = secrets.AUTH0_CLIENT, AUTH0_SECRET = secrets.AUTH0_SECRET, AUTH0_AUDIENCE = secrets.AUTH0_AUDIENCE, FHIR_API = secrets.FHIR_API, PROJECT_API = secrets.PROJECT_API;
    if (!ADVAPACS_CLIENT_ID ||
        !ADVAPACS_CLIENT_SECRET ||
        !AUTH0_ENDPOINT ||
        !AUTH0_CLIENT ||
        !AUTH0_SECRET ||
        !AUTH0_AUDIENCE ||
        !FHIR_API ||
        !PROJECT_API) {
        throw new Error('Missing required secrets');
    }
    return {
        ADVAPACS_CLIENT_ID: ADVAPACS_CLIENT_ID,
        ADVAPACS_CLIENT_SECRET: ADVAPACS_CLIENT_SECRET,
        AUTH0_ENDPOINT: AUTH0_ENDPOINT,
        AUTH0_CLIENT: AUTH0_CLIENT,
        AUTH0_SECRET: AUTH0_SECRET,
        AUTH0_AUDIENCE: AUTH0_AUDIENCE,
        FHIR_API: FHIR_API,
        PROJECT_API: PROJECT_API,
    };
};
exports.validateSecrets = validateSecrets;
