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
var chart_data_1 = require("../../shared/chart-data");
var helpers_1 = require("../../shared/helpers");
var helpers_2 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-patient-instructions';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, type, secrets, userToken, oystehr, oystehrCurrentUser, myPractitionerId, ORGANIZATION_ID, communicationsOwnerId, communications, communicationsDTOs, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), type = _a.type, secrets = _a.secrets, userToken = _a.userToken;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, helpers_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, oystehrCurrentUser.user.me()];
            case 2:
                myPractitionerId = (_b.sent()).profile;
                ORGANIZATION_ID = (0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, secrets);
                communicationsOwnerId = type === 'organization' ? ORGANIZATION_ID : myPractitionerId;
                return [4 /*yield*/, (0, helpers_2.getCommunicationResources)(oystehr, type, communicationsOwnerId)];
            case 3:
                communications = _b.sent();
                communicationsDTOs = communications.map(function (element) { return (0, chart_data_1.makeCommunicationDTO)(element); });
                return [2 /*return*/, {
                        body: JSON.stringify(communicationsDTOs),
                        statusCode: 200,
                    }];
            case 4:
                error_1 = _b.sent();
                console.log(error_1);
                return [2 /*return*/, {
                        body: JSON.stringify({ message: 'Error getting patient instructions...' }),
                        statusCode: 500,
                    }];
            case 5: return [2 /*return*/];
        }
    });
}); });
