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
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var vitals_invalid_age_units_spec_1 = require("./data/config-files/vitals-invalid-age-units-spec");
var vitals_invalid_ages_spec_1 = require("./data/config-files/vitals-invalid-ages-spec");
var vitals_invalid_bp_shape_spec_1 = require("./data/config-files/vitals-invalid-bp-shape-spec");
var vitals_invalid_min_max_val_spec_1 = require("./data/config-files/vitals-invalid-min-max-val-spec");
var vitals_invalid_rule_type_spec_1 = require("./data/config-files/vitals-invalid-rule-type-spec");
var testScheduleUtils_1 = require("./helpers/testScheduleUtils");
describe('testing vitals config validation', function () {
    var makeTestPatientWithAge = function (patientAge) {
        var _a;
        var partialPatient = {
            id: (0, crypto_1.randomUUID)(),
        };
        if (patientAge) {
            var now = luxon_1.DateTime.now();
            var birthDate = now.minus((_a = {}, _a[patientAge.units] = patientAge.value, _a));
            partialPatient.birthDate = birthDate.toFormat(utils_1.DOB_DATE_FORMAT);
        }
        var testPatient = (0, testScheduleUtils_1.makeTestPatient)(partialPatient);
        expect(testPatient).toBeDefined();
        return testPatient;
    };
    (0, vitest_1.suite)('invalid config files are rejected by validation layer', function () {
        test.concurrent('min age greater than max age on some alert threshold causes parsing failure', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _vitals, errorObject, firstError;
            return __generator(this, function (_a) {
                try {
                    _vitals = (0, utils_1.VitalsDef)(vitals_invalid_ages_spec_1.default);
                    expect(_vitals).toBeUndefined();
                }
                catch (error) {
                    expect(error).toBeDefined();
                    errorObject = JSON.parse(error.message);
                    expect(errorObject).toBeDefined();
                    expect(typeof errorObject).toBe('object');
                    expect(Array.isArray(errorObject)).toBe(true);
                    firstError = errorObject[0];
                    expect(firstError).toBeDefined();
                    expect(typeof firstError).toBe('object');
                    expect(firstError.message).toBeDefined();
                    expect(firstError.message).toBe('minAge must be less than or equal to maxAge in an alert threshold');
                    expect(firstError.path).toBeDefined();
                    expect(firstError.path).toEqual([
                        'vital-blood-pressure',
                        'components',
                        'systolic-pressure',
                        'alertThresholds',
                        0,
                    ]);
                }
                return [2 /*return*/];
            });
        }); });
        test.concurrent('min value greater than max value on some alert threshold causes parsing failure', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _vitals, errorObject, firstError;
            return __generator(this, function (_a) {
                try {
                    _vitals = (0, utils_1.VitalsDef)(vitals_invalid_min_max_val_spec_1.default);
                    expect(_vitals).toBeUndefined();
                }
                catch (error) {
                    expect(error).toBeDefined();
                    errorObject = JSON.parse(error.message);
                    expect(errorObject).toBeDefined();
                    expect(typeof errorObject).toBe('object');
                    expect(Array.isArray(errorObject)).toBe(true);
                    firstError = errorObject[0];
                    expect(firstError).toBeDefined();
                    expect(typeof firstError).toBe('object');
                    expect(firstError.message).toBeDefined();
                    expect(firstError.message).toBe('Conflicting rules found');
                    expect(firstError.path).toBeDefined();
                    expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules']);
                }
                return [2 /*return*/];
            });
        }); });
        test.concurrent('invalid rule types in alert thresholds cause parsing failure', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _vitals, errorObject, firstError, secondError;
            return __generator(this, function (_a) {
                try {
                    _vitals = (0, utils_1.VitalsDef)(vitals_invalid_rule_type_spec_1.default);
                    expect(_vitals).toBeUndefined();
                }
                catch (error) {
                    expect(error).toBeDefined();
                    errorObject = JSON.parse(error.message);
                    expect(errorObject).toBeDefined();
                    expect(typeof errorObject).toBe('object');
                    expect(Array.isArray(errorObject)).toBe(true);
                    firstError = errorObject[0];
                    expect(firstError).toBeDefined();
                    expect(typeof firstError).toBe('object');
                    expect(firstError.message).toBeDefined();
                    expect(firstError.message).toBe('Invalid input');
                    expect(firstError.path).toBeDefined();
                    expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules', 0]);
                    secondError = errorObject[1];
                    expect(secondError).toBeDefined();
                    expect(typeof secondError).toBe('object');
                    expect(secondError.message).toBeDefined();
                    expect(secondError.message).toBe('Invalid input');
                    expect(secondError.path).toBeDefined();
                    expect(secondError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules', 1]);
                }
                return [2 /*return*/];
            });
        }); });
        test.concurrent('invalid unit supplied on min/maxAge fails to parse', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _vitals, errorObject, firstError;
            return __generator(this, function (_a) {
                try {
                    _vitals = (0, utils_1.VitalsDef)(vitals_invalid_age_units_spec_1.default);
                    expect(_vitals).toBeUndefined();
                }
                catch (error) {
                    expect(error).toBeDefined();
                    errorObject = JSON.parse(error.message);
                    expect(errorObject).toBeDefined();
                    expect(typeof errorObject).toBe('object');
                    expect(Array.isArray(errorObject)).toBe(true);
                    firstError = errorObject[0];
                    expect(firstError).toBeDefined();
                    expect(typeof firstError).toBe('object');
                    expect(firstError.message).toBeDefined();
                    expect(firstError.message).toBe("Invalid enum value. Expected 'years' | 'months' | 'days', received 'decades'");
                    expect(firstError.path).toBeDefined();
                    expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'minAge', 'unit']);
                }
                return [2 /*return*/];
            });
        }); });
        test.concurrent('alertThresholds supplied on blood pressure and not nested in components fails to parse', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _vitals, errorObject, firstError;
            return __generator(this, function (_a) {
                try {
                    _vitals = (0, utils_1.VitalsDef)(vitals_invalid_bp_shape_spec_1.default);
                    expect(_vitals).toBeUndefined();
                }
                catch (error) {
                    expect(error).toBeDefined();
                    errorObject = JSON.parse(error.message);
                    expect(errorObject).toBeDefined();
                    expect(typeof errorObject).toBe('object');
                    expect(Array.isArray(errorObject)).toBe(true);
                    firstError = errorObject[0];
                    expect(firstError).toBeDefined();
                    expect(typeof firstError).toBe('object');
                    expect(firstError.message).toBeDefined();
                    expect(firstError.message).toBe('vital-blood-pressure object may only define components');
                    expect(firstError.path).toBeDefined();
                    expect(firstError.path).toEqual(['vital-blood-pressure']);
                }
                return [2 /*return*/];
            });
        }); });
    });
    (0, vitest_1.suite)('valid config files customize various behavior per expectations', function () {
        beforeAll(function () {
            var defaultVitalsDef = (0, utils_1.VitalsDef)();
            expect(defaultVitalsDef).toBeDefined();
            (0, vitest_1.assert)(defaultVitalsDef);
        });
        test.concurrent('setting critical alert thresholds and evaluating', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updatedChart, vitals, heartbeatRules, temperatureRules, testPatient, patientDOB, alertingHighHeartbeat, highObservationCriticality, alertingLowHeartbeat, lowObservationCriticality, nonAlertingHeartbeat, nonAlertingHeartbeatCriticality, alertingHighTemperature, highTemperatureCriticality, alertingLowTemperature, lowTemperatureCriticality, nonAlertingTemperature, nonAlertingTemperatureCriticality;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                updatedChart = mutateVitals([
                    {
                        path: ['vital-heartbeat', 'alertThresholds', 0, 'rules', 0],
                        value: { criticality: 'critical', value: 80, type: 'min' },
                    },
                    {
                        path: ['vital-temperature', 'alertThresholds', 0, 'rules', 0],
                        value: { criticality: 'abnormal', value: 36.5, type: 'min' },
                    },
                    {
                        path: ['vital-heartbeat', 'alertThresholds', 0, 'minAge'],
                        value: { unit: 'years', value: 0 },
                    },
                    {
                        path: ['vital-heartbeat', 'alertThresholds', 0, 'maxAge'],
                        value: { unit: 'years', value: 1 },
                    },
                    {
                        path: ['vital-temperature', 'alertThresholds', 0, 'minAge'],
                        value: { unit: 'years', value: 0 },
                    },
                    {
                        path: ['vital-temperature', 'alertThresholds', 0, 'maxAge'],
                        value: { unit: 'years', value: 1 },
                    },
                    {
                        path: ['vital-heartbeat', 'alertThresholds', 0, 'rules', 1],
                        value: { value: 210, type: 'max', criticality: 'critical' },
                    },
                    {
                        path: ['vital-temperature', 'alertThresholds', 0, 'rules', 1],
                        value: { value: 33, type: 'min', criticality: 'abnormal' },
                    },
                    {
                        path: ['vital-temperature', 'alertThresholds', 0, 'rules', 1],
                        value: { value: 39, type: 'max', criticality: 'abnormal' },
                    },
                ], utils_1.DefaultVitalsConfig);
                vitals = (0, utils_1.VitalsDef)(updatedChart);
                expect(vitals).toBeDefined();
                heartbeatRules = (_c = (_b = (_a = vitals['vital-heartbeat']) === null || _a === void 0 ? void 0 : _a.alertThresholds) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.rules;
                expect(heartbeatRules).toBeDefined();
                heartbeatRules === null || heartbeatRules === void 0 ? void 0 : heartbeatRules.forEach(function (rule) {
                    expect(rule.criticality).toBe('critical');
                });
                temperatureRules = (_f = (_e = (_d = vitals['vital-temperature']) === null || _d === void 0 ? void 0 : _d.alertThresholds) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.rules;
                expect(temperatureRules).toBeDefined();
                temperatureRules === null || temperatureRules === void 0 ? void 0 : temperatureRules.forEach(function (rule) {
                    expect(rule.criticality).toBe('abnormal');
                });
                testPatient = makeTestPatientWithAge({ units: 'years', value: 0.5 });
                expect(testPatient).toBeDefined();
                patientDOB = testPatient.birthDate;
                expect(patientDOB).toBeDefined();
                (0, vitest_1.assert)(patientDOB);
                alertingHighHeartbeat = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                    value: 211,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                highObservationCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    patientSex: testPatient.gender,
                    vitalsObservation: alertingHighHeartbeat,
                    configOverride: updatedChart,
                });
                expect(highObservationCriticality).toBe('critical');
                alertingLowHeartbeat = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                    value: 79,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                lowObservationCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    vitalsObservation: alertingLowHeartbeat,
                    configOverride: updatedChart,
                    patientSex: testPatient.gender,
                });
                expect(lowObservationCriticality).toBe('critical');
                nonAlertingHeartbeat = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalHeartbeat,
                    value: 100,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                nonAlertingHeartbeatCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    vitalsObservation: nonAlertingHeartbeat,
                    configOverride: updatedChart,
                    patientSex: testPatient.gender,
                });
                expect(nonAlertingHeartbeatCriticality).toBeUndefined();
                alertingHighTemperature = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalTemperature,
                    value: 40,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                highTemperatureCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    vitalsObservation: alertingHighTemperature,
                    configOverride: updatedChart,
                    patientSex: testPatient.gender,
                });
                expect(highTemperatureCriticality).toBe('abnormal');
                alertingLowTemperature = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalTemperature,
                    value: 32,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                lowTemperatureCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    vitalsObservation: alertingLowTemperature,
                    configOverride: updatedChart,
                    patientSex: testPatient.gender,
                });
                expect(lowTemperatureCriticality).toBe('abnormal');
                nonAlertingTemperature = {
                    patientId: testPatient.id,
                    field: utils_1.VitalFieldNames.VitalTemperature,
                    value: 36.6,
                    resourceId: (0, crypto_1.randomUUID)(),
                };
                nonAlertingTemperatureCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                    patientDOB: patientDOB,
                    vitalsObservation: nonAlertingTemperature,
                    configOverride: updatedChart,
                    patientSex: testPatient.gender,
                });
                expect(nonAlertingTemperatureCriticality).toBeUndefined();
                return [2 /*return*/];
            });
        }); });
    });
    test.concurrent('setting critical alert thresholds and evaluating on vitals with components (blood pressure)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var updatedChart, vitals, systolicPressureRules, testPatient, patientDOB, alertingLowSystolicBloodPressure, lowBPHighCriticality, updatedChart2, vitals2, diastolicPressureRules, alertingLowDiastolicBloodPressure, lowObservationCriticality, nonAlertingBloodPressure, nonAlertingBloodPressureCriticality;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            updatedChart = mutateVitals([
                {
                    path: ['vital-blood-pressure', 'components', 'systolic-pressure', 'alertThresholds', 0],
                    value: {
                        rules: [{ criticality: 'critical', type: 'min', value: 90 }],
                        minAge: { unit: 'years', value: 2 },
                        maxAge: { unit: 'years', value: 4 },
                    },
                },
            ], utils_1.DefaultVitalsConfig);
            vitals = (0, utils_1.VitalsDef)(updatedChart);
            expect(vitals).toBeDefined();
            systolicPressureRules = (_e = (_d = (_c = (_b = (_a = vitals['vital-blood-pressure']) === null || _a === void 0 ? void 0 : _a.components) === null || _b === void 0 ? void 0 : _b['systolic-pressure']) === null || _c === void 0 ? void 0 : _c.alertThresholds) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.rules;
            expect(systolicPressureRules).toBeDefined();
            (0, vitest_1.assert)(systolicPressureRules);
            expect(systolicPressureRules[0].criticality).toBe('critical');
            testPatient = makeTestPatientWithAge({ units: 'months', value: 3 * 12 });
            expect(testPatient).toBeDefined();
            patientDOB = testPatient.birthDate;
            expect(patientDOB).toBeDefined();
            (0, vitest_1.assert)(patientDOB);
            alertingLowSystolicBloodPressure = {
                patientId: testPatient.id,
                field: utils_1.VitalFieldNames.VitalBloodPressure,
                systolicPressure: 89.8,
                diastolicPressure: 70, // this should alert as well, but the overall criticality should be determined by the systolic pressure
                resourceId: (0, crypto_1.randomUUID)(),
            };
            lowBPHighCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                patientDOB: patientDOB,
                vitalsObservation: alertingLowSystolicBloodPressure,
                configOverride: updatedChart,
                patientSex: testPatient.gender,
            });
            expect(lowBPHighCriticality).toBe('critical');
            updatedChart2 = mutateVitals([
                {
                    path: ['vital-blood-pressure', 'components', 'diastolic-pressure'],
                    value: {
                        alertThresholds: [
                            {
                                rules: [{ criticality: 'abnormal', type: 'min', value: 80 }],
                                minAge: { unit: 'years', value: 2 },
                                maxAge: { unit: 'years', value: 4 },
                            },
                        ],
                    },
                },
            ], utils_1.DefaultVitalsConfig);
            vitals2 = (0, utils_1.VitalsDef)(updatedChart2);
            expect(vitals2).toBeDefined();
            diastolicPressureRules = (_k = (_j = (_h = (_g = (_f = vitals2['vital-blood-pressure']) === null || _f === void 0 ? void 0 : _f.components) === null || _g === void 0 ? void 0 : _g['diastolic-pressure']) === null || _h === void 0 ? void 0 : _h.alertThresholds) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.rules;
            expect(diastolicPressureRules).toBeDefined();
            diastolicPressureRules === null || diastolicPressureRules === void 0 ? void 0 : diastolicPressureRules.forEach(function (rule) {
                expect(rule.criticality).toBe('abnormal');
            });
            alertingLowDiastolicBloodPressure = {
                patientId: testPatient.id,
                field: utils_1.VitalFieldNames.VitalBloodPressure,
                systolicPressure: 100,
                diastolicPressure: 79.8,
                resourceId: (0, crypto_1.randomUUID)(),
            };
            lowObservationCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                patientDOB: patientDOB,
                vitalsObservation: alertingLowDiastolicBloodPressure,
                configOverride: updatedChart2,
                patientSex: testPatient.gender,
            });
            expect(lowObservationCriticality).toBe('abnormal');
            nonAlertingBloodPressure = {
                patientId: testPatient.id,
                field: utils_1.VitalFieldNames.VitalBloodPressure,
                systolicPressure: 100,
                diastolicPressure: 80.1,
                resourceId: (0, crypto_1.randomUUID)(),
            };
            nonAlertingBloodPressureCriticality = (0, utils_1.getVitalObservationAlertLevel)({
                patientDOB: patientDOB,
                vitalsObservation: nonAlertingBloodPressure,
                configOverride: updatedChart2,
                patientSex: testPatient.gender,
            });
            expect(nonAlertingBloodPressureCriticality).toBeUndefined();
            return [2 /*return*/];
        });
    }); });
    test('applies adult heart rate thresholds based on DOB', function () {
        var teenPatient = makeTestPatientWithAge({ units: 'years', value: 16 });
        var patientDOB = teenPatient.birthDate;
        (0, vitest_1.assert)(patientDOB);
        var tachyObservation = {
            patientId: teenPatient.id,
            field: utils_1.VitalFieldNames.VitalHeartbeat,
            value: 125,
            resourceId: (0, crypto_1.randomUUID)(),
        };
        var criticality = (0, utils_1.getVitalObservationAlertLevel)({
            patientDOB: patientDOB,
            vitalsObservation: tachyObservation,
            patientSex: teenPatient.gender,
        });
        expect(criticality).toBe(utils_1.VitalAlertCriticality.Abnormal);
    });
    test('applies adult respiration thresholds for adults', function () {
        var adultPatient = makeTestPatientWithAge({ units: 'years', value: 30 });
        var patientDOB = adultPatient.birthDate;
        (0, vitest_1.assert)(patientDOB);
        var highRespObservation = {
            patientId: adultPatient.id,
            field: utils_1.VitalFieldNames.VitalRespirationRate,
            value: 22,
            resourceId: (0, crypto_1.randomUUID)(),
        };
        var criticality = (0, utils_1.getVitalObservationAlertLevel)({
            patientDOB: patientDOB,
            vitalsObservation: highRespObservation,
            patientSex: adultPatient.gender,
        });
        expect(criticality).toBe(utils_1.VitalAlertCriticality.Abnormal);
    });
    test('applies adult weight thresholds for adults', function () {
        var adultPatient = makeTestPatientWithAge({ units: 'years', value: 30 });
        var patientDOB = adultPatient.birthDate;
        (0, vitest_1.assert)(patientDOB);
        var lowWeightObservation = {
            patientId: adultPatient.id,
            field: utils_1.VitalFieldNames.VitalWeight,
            value: 40,
            resourceId: (0, crypto_1.randomUUID)(),
        };
        var criticality = (0, utils_1.getVitalObservationAlertLevel)({
            patientDOB: patientDOB,
            vitalsObservation: lowWeightObservation,
            patientSex: adultPatient.gender,
        });
        expect(criticality).toBe(utils_1.VitalAlertCriticality.Abnormal);
    });
});
var mutateVitals = function (operation, vitals) {
    var newVal = __assign({}, vitals);
    var _loop_1 = function (path, value) {
        var target = newVal;
        for (var i = 0; i < path.length - 1; i++) {
            var key = path[i];
            if (typeof key === 'number') {
                if (!Array.isArray(target[path[i - 1]])) {
                    target[path[i - 1]] = [];
                }
                target = target[key];
            }
            else {
                if (!(key in target)) {
                    target[key] = {};
                }
                target = target[key];
            }
        }
        var lastKey = path[path.length - 1];
        if (!target) {
            console.warn("Target for path ".concat(path.join('.'), ", ").concat(lastKey, " not found in chart data."));
        }
        if (Array.isArray(target[lastKey]) && typeof value === 'object' && value !== null) {
            target[lastKey] = target[lastKey].map(function (item) { return (__assign(__assign({}, item), value)); });
        }
        else {
            target[lastKey] = value;
        }
    };
    for (var _i = 0, operation_1 = operation; _i < operation_1.length; _i++) {
        var _a = operation_1[_i], path = _a.path, value = _a.value;
        _loop_1(path, value);
    }
    return newVal;
};
