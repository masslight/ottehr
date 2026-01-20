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
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("utils");
var integration_test_seed_data_setup_1 = require("../helpers/integration-test-seed-data-setup");
describe('radiology integration tests', function () {
    var oystehrTestUserM2M;
    var oystehrAdmin;
    var encounter;
    var resourcesToCleanup = [];
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var setup, patient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, integration_test_seed_data_setup_1.setupIntegrationTest)('integration/radiology.test.ts', utils_1.M2MClientMockType.provider)];
                case 1:
                    setup = _a.sent();
                    oystehrTestUserM2M = setup.oystehrTestUserM2M;
                    oystehrAdmin = setup.oystehr;
                    return [4 /*yield*/, oystehrAdmin.fhir.create({
                            resourceType: 'Patient',
                            name: [{ given: ['Test'], family: 'Patient' }],
                            birthDate: '2000-01-01',
                            gender: 'female',
                        })];
                case 2:
                    patient = _a.sent();
                    resourcesToCleanup.push(patient);
                    return [4 /*yield*/, oystehrAdmin.fhir.create({
                            resourceType: 'Encounter',
                            status: 'in-progress',
                            class: { code: 'AMB' },
                            subject: { reference: "Patient/".concat(patient.id) },
                        })];
                case 3:
                    encounter = _a.sent();
                    resourcesToCleanup.push(encounter);
                    expect(encounter).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); }, 60000);
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehrAdmin) {
                        throw new Error('oystehr is null! could not clean up!');
                    }
                    return [4 /*yield*/, cleanupResources(oystehrAdmin)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    var cleanupResources = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
        var _i, resourcesToCleanup_1, resource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, resourcesToCleanup_1 = resourcesToCleanup;
                    _a.label = 1;
                case 1:
                    if (!(_i < resourcesToCleanup_1.length)) return [3 /*break*/, 4];
                    resource = resourcesToCleanup_1[_i];
                    return [4 /*yield*/, oystehr.fhir.delete({
                            resourceType: resource.resourceType,
                            id: resource.id,
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    describe('create order', function () {
        it('should create a radiology order -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var createOrderInput, orderOutput, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        createOrderInput = {
                            encounterId: encounter.id,
                            diagnosisCode: 'W21.89XA',
                            cptCode: '73562',
                            stat: true,
                            clinicalHistory: 'Took an arrow to the knee',
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrTestUserM2M.zambda.execute(__assign({ id: 'RADIOLOGY-CREATE-ORDER' }, createOrderInput))];
                    case 2:
                        orderOutput = (_a.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error executing zambda:', error_1);
                        orderOutput = error_1;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(orderOutput).toBeDefined();
                        expect(orderOutput).toHaveProperty('output');
                        expect(orderOutput.output).toHaveProperty('serviceRequestId');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
