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
var baseResources;
describe('chart-data integration tests', function () {
    var oystehrLocalZambdas;
    var cleanup;
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var setup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, integration_test_seed_data_setup_1.setupIntegrationTest)('chart-data.test.ts', utils_1.M2MClientMockType.provider)];
                case 1:
                    setup = _a.sent();
                    oystehrLocalZambdas = setup.oystehrTestUserM2M;
                    return [4 /*yield*/, (0, integration_test_seed_data_setup_1.insertInPersonAppointmentBase)(setup.oystehr, setup.processId)];
                case 2:
                    baseResources = _a.sent();
                    cleanup = setup.cleanup;
                    return [2 /*return*/];
            }
        });
    }); }, 60000);
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cleanup()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('get-chart-data happy paths', function () {
        it('should get chart data with no params on base chart-- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getChartDataInput, getChartDataOutput, error_1, typedGetChartDataOutput;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return __generator(this, function (_u) {
                switch (_u.label) {
                    case 0:
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _u.label = 1;
                    case 1:
                        _u.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 2:
                        getChartDataOutput = (_u.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _u.sent();
                        console.error('Error executing zambda:', error_1);
                        getChartDataOutput = error_1;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toBeDefined();
                        expect(typedGetChartDataOutput).toHaveProperty('patientId');
                        expect(typedGetChartDataOutput.patientId).toEqual(baseResources.patient.id);
                        expect(typedGetChartDataOutput).toHaveProperty('conditions');
                        expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
                        expect((_a = typedGetChartDataOutput.conditions) === null || _a === void 0 ? void 0 : _a.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('medications');
                        expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.medications) === null || _b === void 0 ? void 0 : _b.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('allergies');
                        expect(typedGetChartDataOutput.allergies).toBeInstanceOf(Array);
                        expect((_c = typedGetChartDataOutput.allergies) === null || _c === void 0 ? void 0 : _c.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('surgicalHistory');
                        expect(typedGetChartDataOutput.surgicalHistory).toBeInstanceOf(Array);
                        expect((_d = typedGetChartDataOutput.surgicalHistory) === null || _d === void 0 ? void 0 : _d.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('examObservations');
                        expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
                        expect((_e = typedGetChartDataOutput.examObservations) === null || _e === void 0 ? void 0 : _e.length).toBeGreaterThan(1);
                        expect(typedGetChartDataOutput).toHaveProperty('cptCodes');
                        expect(typedGetChartDataOutput.cptCodes).toBeInstanceOf(Array);
                        expect((_f = typedGetChartDataOutput.cptCodes) === null || _f === void 0 ? void 0 : _f.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('instructions');
                        expect(typedGetChartDataOutput.instructions).toBeInstanceOf(Array);
                        expect((_g = typedGetChartDataOutput.instructions) === null || _g === void 0 ? void 0 : _g.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('diagnosis');
                        expect(typedGetChartDataOutput.diagnosis).toBeInstanceOf(Array);
                        expect((_h = typedGetChartDataOutput.diagnosis) === null || _h === void 0 ? void 0 : _h.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('schoolWorkNotes');
                        expect(typedGetChartDataOutput.schoolWorkNotes).toBeInstanceOf(Array);
                        expect((_j = typedGetChartDataOutput.schoolWorkNotes) === null || _j === void 0 ? void 0 : _j.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('observations');
                        expect(typedGetChartDataOutput.observations).toBeInstanceOf(Array);
                        expect((_k = typedGetChartDataOutput.observations) === null || _k === void 0 ? void 0 : _k.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('practitioners');
                        expect(typedGetChartDataOutput.practitioners).toBeInstanceOf(Array);
                        expect((_l = typedGetChartDataOutput.practitioners) === null || _l === void 0 ? void 0 : _l.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
                        expect(typedGetChartDataOutput.aiPotentialDiagnosis).toBeInstanceOf(Array);
                        expect((_m = typedGetChartDataOutput.aiPotentialDiagnosis) === null || _m === void 0 ? void 0 : _m.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('aiChat');
                        expect(typedGetChartDataOutput.aiChat).toBeInstanceOf(Object);
                        expect((_o = typedGetChartDataOutput.aiChat) === null || _o === void 0 ? void 0 : _o.documents).toBeInstanceOf(Array);
                        expect((_q = (_p = typedGetChartDataOutput.aiChat) === null || _p === void 0 ? void 0 : _p.documents) === null || _q === void 0 ? void 0 : _q.length).toEqual(0);
                        expect((_r = typedGetChartDataOutput.aiChat) === null || _r === void 0 ? void 0 : _r.providers).toBeInstanceOf(Array);
                        expect((_t = (_s = typedGetChartDataOutput.aiChat) === null || _s === void 0 ? void 0 : _s.providers) === null || _t === void 0 ? void 0 : _t.length).toEqual(0);
                        expect(typedGetChartDataOutput).toHaveProperty('patientInfoConfirmed');
                        expect(typedGetChartDataOutput.patientInfoConfirmed).toEqual({
                            value: true,
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('should get chart data with aiPotentialDiagnosis requestedField -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getChartDataInput, getChartDataOutput, error_2, typedGetChartDataOutput;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                            requestedFields: { aiPotentialDiagnosis: {} },
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 2:
                        getChartDataOutput = (_b.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        console.error('Error executing zambda:', error_2);
                        getChartDataOutput = error_2;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toBeDefined();
                        expect(typedGetChartDataOutput).toHaveProperty('patientId');
                        expect(typedGetChartDataOutput.patientId).toEqual(baseResources.patient.id);
                        expect(typedGetChartDataOutput).not.toHaveProperty('conditions');
                        expect(typedGetChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
                        expect(typedGetChartDataOutput.aiPotentialDiagnosis).toBeInstanceOf(Array);
                        expect((_a = typedGetChartDataOutput.aiPotentialDiagnosis) === null || _a === void 0 ? void 0 : _a.length).toEqual(0);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate shape of examObservations -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getChartDataInput, getChartDataOutput, error_3, typedGetChartDataOutput;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 2:
                        getChartDataOutput = (_b.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _b.sent();
                        console.error('Error executing zambda:', error_3);
                        getChartDataOutput = error_3;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('examObservations');
                        expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
                        expect((_a = typedGetChartDataOutput.examObservations) === null || _a === void 0 ? void 0 : _a[0]).toMatchObject({
                            resourceId: expect.any(String),
                            field: expect.any(String),
                            value: expect.any(Boolean),
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('chart-data save / get cycle happy paths', function () {
        it('should validate save + get cycle for conditions -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var conditionDTO, saveChartInput, saveChartOutput, error_4, typedSaveChartOutput, newCondition, getChartDataInput, getChartDataOutput, error_5, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        conditionDTO = {
                            code: 'H54.8',
                            display: 'Legal blindness, as defined in USA',
                            current: true,
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            conditions: [conditionDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _c.sent();
                        console.error('Error executing zambda:', error_4);
                        saveChartOutput = error_4;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newCondition = (_a = typedSaveChartOutput.chartData.conditions) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newCondition).toMatchObject(__assign({ resourceId: expect.any(String) }, conditionDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_5 = _c.sent();
                        console.error('Error executing zambda:', error_5);
                        getChartDataOutput = error_5;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('conditions');
                        expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.conditions) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newCondition);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for medications -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var medicationDTO, saveChartInput, saveChartOutput, error_6, typedSaveChartOutput, newMedication, getChartDataInput, getChartDataOutput, error_7, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        medicationDTO = {
                            name: 'Azithromycin Oral Suspension Reconstituted (200 MG/5ML)',
                            id: '5675',
                            type: 'scheduled',
                            intakeInfo: { date: '2025-10-16T11:00:00.000Z', dose: '2 l' },
                            status: 'active',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            medications: [medicationDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _c.sent();
                        console.error('Error executing zambda:', error_6);
                        saveChartOutput = error_6;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newMedication = (_a = typedSaveChartOutput.chartData.medications) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newMedication).toMatchObject(__assign({ resourceId: expect.any(String) }, medicationDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_7 = _c.sent();
                        console.error('Error executing zambda:', error_7);
                        getChartDataOutput = error_7;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('medications');
                        expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.medications) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newMedication);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for allergies -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var allergyDTO, saveChartInput, saveChartOutput, error_8, typedSaveChartOutput, newAllergy, getChartDataInput, getChartDataOutput, error_9, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        allergyDTO = {
                            name: 'Penicillin',
                            id: '12345',
                            note: 'Causes severe rash',
                            current: true,
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            allergies: [allergyDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _c.sent();
                        console.error('Error executing zambda:', error_8);
                        saveChartOutput = error_8;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newAllergy = (_a = typedSaveChartOutput.chartData.allergies) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newAllergy).toMatchObject(__assign({ resourceId: expect.any(String) }, allergyDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_9 = _c.sent();
                        console.error('Error executing zambda:', error_9);
                        getChartDataOutput = error_9;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('allergies');
                        expect(typedGetChartDataOutput.allergies).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.allergies) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newAllergy);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for surgicalHistory -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var surgicalHistoryDTO, saveChartInput, saveChartOutput, error_10, typedSaveChartOutput, newSurgicalHistory, getChartDataInput, getChartDataOutput, error_11, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        surgicalHistoryDTO = {
                            code: '44950',
                            display: 'Appendectomy',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            surgicalHistory: [surgicalHistoryDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_10 = _c.sent();
                        console.error('Error executing zambda:', error_10);
                        saveChartOutput = error_10;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newSurgicalHistory = (_a = typedSaveChartOutput.chartData.surgicalHistory) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newSurgicalHistory).toMatchObject(__assign({ resourceId: expect.any(String) }, surgicalHistoryDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_11 = _c.sent();
                        console.error('Error executing zambda:', error_11);
                        getChartDataOutput = error_11;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('surgicalHistory');
                        expect(typedGetChartDataOutput.surgicalHistory).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.surgicalHistory) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newSurgicalHistory);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for examObservations -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var examObservationDTO, saveChartInput, saveChartOutput, error_12, typedSaveChartOutput, newExamObservation, getChartDataInput, getChartDataOutput, error_13, typedGetChartDataOutput, savedExamObservation;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        examObservationDTO = {
                            field: 'alert',
                            value: true,
                            note: 'this is the note',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            examObservations: [examObservationDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_12 = _c.sent();
                        console.error('Error executing zambda:', error_12);
                        saveChartOutput = error_12;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newExamObservation = (_a = typedSaveChartOutput.chartData.examObservations) === null || _a === void 0 ? void 0 : _a.find(function (obs) { return obs.field === examObservationDTO.field; });
                        expect(newExamObservation).toMatchObject(__assign({ resourceId: expect.any(String) }, examObservationDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_13 = _c.sent();
                        console.error('Error executing zambda:', error_13);
                        getChartDataOutput = error_13;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('examObservations');
                        expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
                        savedExamObservation = (_b = typedGetChartDataOutput.examObservations) === null || _b === void 0 ? void 0 : _b.find(function (obs) { return obs.field === examObservationDTO.field; });
                        expect(savedExamObservation).toMatchObject({
                            resourceId: expect.any(String),
                            field: examObservationDTO.field,
                            value: examObservationDTO.value,
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for instructions -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instructionDTO, saveChartInput, saveChartOutput, error_14, typedSaveChartOutput, newInstruction, getChartDataInput, getChartDataOutput, error_15, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        instructionDTO = {
                            text: 'Take medication with food twice daily',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            instructions: [instructionDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_14 = _c.sent();
                        console.error('Error executing zambda:', error_14);
                        saveChartOutput = error_14;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newInstruction = (_a = typedSaveChartOutput.chartData.instructions) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newInstruction).toMatchObject(__assign({ resourceId: expect.any(String) }, instructionDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_15 = _c.sent();
                        console.error('Error executing zambda:', error_15);
                        getChartDataOutput = error_15;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('instructions');
                        expect(typedGetChartDataOutput.instructions).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.instructions) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newInstruction);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for diagnosis -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var diagnosisDTO, saveChartInput, saveChartOutput, error_16, typedSaveChartOutput, newDiagnosis, getChartDataInput, getChartDataOutput, error_17, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        diagnosisDTO = {
                            code: 'J06.9',
                            display: 'Acute upper respiratory infection, unspecified',
                            isPrimary: true,
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            diagnosis: [diagnosisDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_16 = _c.sent();
                        console.error('Error executing zambda:', error_16);
                        saveChartOutput = error_16;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newDiagnosis = (_a = typedSaveChartOutput.chartData.diagnosis) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newDiagnosis).toMatchObject(__assign({ resourceId: expect.any(String) }, diagnosisDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_17 = _c.sent();
                        console.error('Error executing zambda:', error_17);
                        getChartDataOutput = error_17;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('diagnosis');
                        expect(typedGetChartDataOutput.diagnosis).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.diagnosis) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newDiagnosis);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should validate save + get cycle for cptCodes -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var cptCodeDTO, saveChartInput, saveChartOutput, error_18, typedSaveChartOutput, newCptCode, getChartDataInput, getChartDataOutput, error_19, typedGetChartDataOutput;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cptCodeDTO = {
                            code: '99213',
                            display: 'Office or other outpatient visit, established patient, 20-29 minutes',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            cptCodes: [cptCodeDTO],
                        };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_c.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_18 = _c.sent();
                        console.error('Error executing zambda:', error_18);
                        saveChartOutput = error_18;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newCptCode = (_a = typedSaveChartOutput.chartData.cptCodes) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newCptCode).toMatchObject(__assign({ resourceId: expect.any(String) }, cptCodeDTO));
                        getChartDataInput = {
                            encounterId: baseResources.encounter.id,
                        };
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'GET-CHART-DATA' }, getChartDataInput))];
                    case 6:
                        getChartDataOutput = (_c.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_19 = _c.sent();
                        console.error('Error executing zambda:', error_19);
                        getChartDataOutput = error_19;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(getChartDataOutput instanceof Error).toBe(false);
                        typedGetChartDataOutput = getChartDataOutput;
                        expect(typedGetChartDataOutput).toHaveProperty('cptCodes');
                        expect(typedGetChartDataOutput.cptCodes).toBeInstanceOf(Array);
                        expect((_b = typedGetChartDataOutput.cptCodes) === null || _b === void 0 ? void 0 : _b[0]).toEqual(newCptCode);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('chart-data delete happy paths', function () {
        it('should validate delete for schoolWorkNotes -- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var schoolWorkNoteDTO, saveChartInput, saveChartOutput, error_20, typedSaveChartOutput, newSchoolWorkNote, deleteChartInput, deleteChartOutput, error_21, getChartOutput, error_22, typedGetChartOutput;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        schoolWorkNoteDTO = {
                            documentHeader: 'School Work Note',
                            providerDetails: {
                                name: 'Dr. John Doe, MD',
                                credentials: 'MD',
                            },
                            footerNote: 'This note is valid for 30 days from the date issued.',
                            headerNote: 'Please accommodate the following requests.',
                            bulletItems: [{ text: 'Extra time for assignments' }, { text: 'Permission to leave class early' }],
                            parentGuardianName: 'Jane Doe',
                            type: 'school',
                        };
                        saveChartInput = {
                            encounterId: baseResources.encounter.id,
                            newSchoolWorkNote: schoolWorkNoteDTO,
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'SAVE-CHART-DATA' }, saveChartInput))];
                    case 2:
                        saveChartOutput = (_b.sent()).output;
                        return [3 /*break*/, 4];
                    case 3:
                        error_20 = _b.sent();
                        console.error('Error executing zambda:', error_20);
                        saveChartOutput = error_20;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(saveChartOutput instanceof Error).toBe(false);
                        typedSaveChartOutput = saveChartOutput;
                        newSchoolWorkNote = (_a = typedSaveChartOutput.chartData.schoolWorkNotes) === null || _a === void 0 ? void 0 : _a[0];
                        expect(newSchoolWorkNote).toMatchObject({
                            id: expect.any(String),
                            name: expect.any(String),
                            date: expect.any(String),
                            published: false,
                            type: 'school',
                            url: expect.any(String),
                        });
                        deleteChartInput = {
                            encounterId: baseResources.encounter.id,
                            schoolWorkNotes: [newSchoolWorkNote],
                        };
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute(__assign({ id: 'DELETE-CHART-DATA' }, deleteChartInput))];
                    case 6:
                        deleteChartOutput = (_b.sent()).output;
                        return [3 /*break*/, 8];
                    case 7:
                        error_21 = _b.sent();
                        console.error('Error executing zambda:', error_21);
                        deleteChartOutput = error_21;
                        return [3 /*break*/, 8];
                    case 8:
                        expect(deleteChartOutput instanceof Error).toBe(false);
                        _b.label = 9;
                    case 9:
                        _b.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, oystehrLocalZambdas.zambda.execute({
                                id: 'GET-CHART-DATA',
                                encounterId: baseResources.encounter.id,
                            })];
                    case 10:
                        getChartOutput = (_b.sent()).output;
                        return [3 /*break*/, 12];
                    case 11:
                        error_22 = _b.sent();
                        console.error('Error executing zambda:', error_22);
                        getChartOutput = error_22;
                        return [3 /*break*/, 12];
                    case 12:
                        expect(getChartOutput instanceof Error).toBe(false);
                        typedGetChartOutput = getChartOutput;
                        expect(typedGetChartOutput.schoolWorkNotes).toBeInstanceOf(Array);
                        expect(typedGetChartOutput.schoolWorkNotes).toStrictEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
