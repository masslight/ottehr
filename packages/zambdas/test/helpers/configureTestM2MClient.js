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
exports.m2mClientMockType = exports.ensureM2MPractitionerProfile = void 0;
var sdk_1 = require("@oystehr/sdk");
var secrets_1 = require("../data/secrets");
var ensureM2MPractitionerProfile = function (token) { return __awaiter(void 0, void 0, void 0, function () {
    var FHIR_API, PROJECT_ID, PROJECT_API, projectApiClient, practitionerForM2M, m2mResource, _a, m2mProfileType, m2mProfileId, _b, m2mPractitioner;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_ID = secrets_1.SECRETS.PROJECT_ID, PROJECT_API = secrets_1.SECRETS.PROJECT_API;
                projectApiClient = new sdk_1.default({
                    accessToken: token,
                    fhirApiUrl: FHIR_API,
                    projectApiUrl: PROJECT_API,
                    projectId: PROJECT_ID,
                });
                return [4 /*yield*/, projectApiClient.fhir.create({
                        resourceType: 'Practitioner',
                        name: [{ given: ['M2M'], family: 'Client' }],
                        birthDate: '1978-01-01',
                        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
                    })];
            case 1:
                practitionerForM2M = _d.sent();
                return [4 /*yield*/, projectApiClient.m2m.me()];
            case 2:
                m2mResource = _d.sent();
                _a = m2mResource.profile.split('/'), m2mProfileType = _a[0], m2mProfileId = _a[1];
                if (!(m2mProfileType && m2mProfileType === 'Practitioner' && m2mProfileId)) return [3 /*break*/, 8];
                _d.label = 3;
            case 3:
                _d.trys.push([3, 5, , 7]);
                return [4 /*yield*/, projectApiClient.fhir.get({
                        id: m2mProfileId,
                        resourceType: 'Practitioner',
                    })];
            case 4:
                _d.sent();
                return [3 /*break*/, 7];
            case 5:
                _b = _d.sent();
                return [4 /*yield*/, projectApiClient.m2m.update({
                        id: m2mResource.id,
                        profile: "Practitioner/".concat(practitionerForM2M.id),
                    })];
            case 6:
                _d.sent();
                return [3 /*break*/, 7];
            case 7: return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, projectApiClient.m2m.update({
                    id: m2mResource.id,
                    profile: "Practitioner/".concat(practitionerForM2M.id),
                })];
            case 9:
                _d.sent();
                _d.label = 10;
            case 10: return [4 /*yield*/, projectApiClient.m2m.me()];
            case 11:
                _c = (_d.sent()).profile.split('/'), m2mProfileType = _c[0], m2mProfileId = _c[1];
                expect(m2mProfileType).toBe('Practitioner');
                expect(m2mProfileId).toBeDefined();
                return [4 /*yield*/, projectApiClient.fhir.get({
                        id: m2mProfileId,
                        resourceType: 'Practitioner',
                    })];
            case 12:
                m2mPractitioner = _d.sent();
                expect(m2mPractitioner).toBeDefined();
                return [2 /*return*/];
        }
    });
}); };
exports.ensureM2MPractitionerProfile = ensureM2MPractitionerProfile;
var m2mClientMockType;
(function (m2mClientMockType) {
    m2mClientMockType["mockProvider"] = "mock-provider";
    m2mClientMockType["mockPatient"] = "mock-patient";
})(m2mClientMockType || (exports.m2mClientMockType = m2mClientMockType = {}));
