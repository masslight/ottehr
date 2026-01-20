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
exports.extractWeightOptions = exports.index = void 0;
var utils_1 = require("utils");
var z = require("zod");
var shared_1 = require("../../../../shared");
var m2mToken;
var ZAMBDA_NAME = 'get-vitals';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId, mode, secrets, oystehr, effectInput, results, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                console.log("Validating input: ".concat(JSON.stringify(input.body)));
                _a = validateRequestParameters(input), encounterId = _a.encounterId, mode = _a.mode, secrets = _a.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log("Performing complex validation for encounterId: ".concat(encounterId, ", mode: ").concat(mode));
                return [4 /*yield*/, complexValidation({ encounterId: encounterId, mode: mode, secrets: secrets }, oystehr)];
            case 2:
                effectInput = _b.sent();
                console.log("Effect input: ".concat(JSON.stringify(effectInput)));
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                results = _b.sent();
                return [2 /*return*/, {
                        body: JSON.stringify(results),
                        statusCode: 200,
                    }];
            case 4:
                error_1 = _b.sent();
                console.log(error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounter, mode, list, map, list, map;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounter = input.encounter, mode = input.mode;
                if (!!mode.historical) return [3 /*break*/, 2];
                return [4 /*yield*/, fetchVitalsForEncounter(encounter.id, oystehr)];
            case 1:
                list = _a.sent();
                map = (0, utils_1.convertVitalsListToMap)(list);
                return [2 /*return*/, map];
            case 2: return [4 /*yield*/, fetchVitalsPriorToEncounter({ patientId: input.patientId, searchBefore: mode.searchBefore, encounterId: encounter.id }, oystehr)];
            case 3:
                list = _a.sent();
                map = (0, utils_1.convertVitalsListToMap)(list);
                return [2 /*return*/, map];
        }
    });
}); };
var fetchVitalsForEncounter = function (encounterId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var currentVitalsAndPerformers, observations, practitioners;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Observation',
                    params: [
                        { name: 'encounter._id', value: encounterId },
                        { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
                        { name: '_tag', value: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM, "|") },
                        { name: '_include', value: 'Observation:performer' },
                        { name: '_sort', value: '-date' }, // Sort by date descending
                    ],
                })];
            case 1:
                currentVitalsAndPerformers = (_a.sent()).unbundle();
                observations = currentVitalsAndPerformers.filter(function (res) { return res.resourceType === 'Observation'; });
                practitioners = currentVitalsAndPerformers.filter(function (res) { return res.resourceType === 'Practitioner'; });
                return [2 /*return*/, parseResourcesToDTOs(observations, practitioners)];
        }
    });
}); };
var fetchVitalsPriorToEncounter = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, searchBefore, encounterId, currentVitalsAndPerformers, observations, practitioners;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = input.patientId, searchBefore = input.searchBefore, encounterId = input.encounterId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Observation',
                        params: [
                            { name: 'patient._id', value: patientId },
                            { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' }, // Exclude observations that are entered in error
                            { name: 'date', value: "lt".concat(searchBefore) }, // Fetch observations before the encounter start date
                            { name: '_tag', value: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM, "|") },
                            { name: '_include', value: 'Observation:performer' },
                            { name: '_sort', value: '-date' }, // Sort by date descending
                        ],
                    })];
            case 1:
                currentVitalsAndPerformers = (_a.sent()).unbundle();
                observations = currentVitalsAndPerformers.filter(function (res) {
                    var _a, _b;
                    if (res.resourceType !== 'Observation') {
                        return false;
                    }
                    return ((_b = (_a = res.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '')) !== encounterId;
                });
                practitioners = currentVitalsAndPerformers.filter(function (res) { return res.resourceType === 'Practitioner'; });
                return [2 /*return*/, parseResourcesToDTOs(observations, practitioners)];
        }
    });
}); };
var fieldNameSchema = z.nativeEnum(utils_1.VitalFieldNames);
var parseResourcesToDTOs = function (observations, practitioners) {
    var observationPerformerMap = new Map();
    observations.forEach(function (obs) {
        var performer = practitioners.find(function (tempPractitioner) { var _a; return (_a = obs.performer) === null || _a === void 0 ? void 0 : _a.some(function (p) { var _a; return ((_a = p.reference) === null || _a === void 0 ? void 0 : _a.replace('Practitioner/', '')) === tempPractitioner.id; }); });
        if (performer && obs.id) {
            observationPerformerMap.set(obs.id, performer);
        }
    });
    // console.log('Observation to performer map:', observationPerformerMap, observations.length, practitioners.length);
    var vitalsDTOs = Array.from(observationPerformerMap.entries()).flatMap(function (_a) {
        var _b, _c, _d;
        var obsId = _a[0], performer = _a[1];
        var observation = observations.find(function (obs) { return obs.id === obsId; });
        if (!observation || !observation.id)
            return [];
        // todo: don't base this on meta tag, but on the observation code
        var fieldCode = (_d = (_c = (_b = observation === null || observation === void 0 ? void 0 : observation.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM); })) === null || _d === void 0 ? void 0 : _d.code;
        if (!fieldCode)
            return [];
        var parsedField = fieldNameSchema.safeParse(fieldCode);
        if (!parsedField.success)
            return [];
        var field = parsedField.data;
        var vitalObservation = undefined;
        if (field === utils_1.VitalFieldNames.VitalBloodPressure) {
            vitalObservation = parseBloodPressureObservation(observation, performer);
        }
        else if (field === utils_1.VitalFieldNames.VitalVision) {
            vitalObservation = parseVisionObservation(observation, performer);
        }
        else if (field === utils_1.VitalFieldNames.VitalWeight) {
            vitalObservation = parseWeightObservation(observation, performer);
        }
        else {
            vitalObservation = parseNumericValueObservation(observation, performer, field);
        }
        if (vitalObservation) {
            vitalObservation.alertCriticality = (0, utils_1.getVitalDTOCriticalityFromObservation)(observation);
            return vitalObservation;
        }
        return [];
    });
    return vitalsDTOs;
};
var parseBloodPressureObservation = function (observation, performer) {
    var _a, _b, _c, _d, _e, _f;
    // if (observation.code?.coding?.[0]?.code !== '85354-9') return undefined; interesting suggestion from AI...
    var systolicBP = (_c = (_b = (_a = observation.component) === null || _a === void 0 ? void 0 : _a.find(function (comp) {
        var _a, _b;
        return (_b = (_a = comp.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (cc) { return cc.code === utils_1.VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE && cc.system === utils_1.LOINC_SYSTEM; });
    })) === null || _b === void 0 ? void 0 : _b.valueQuantity) === null || _c === void 0 ? void 0 : _c.value;
    var diastolicBP = (_f = (_e = (_d = observation.component) === null || _d === void 0 ? void 0 : _d.find(function (comp) {
        var _a, _b;
        return (_b = (_a = comp.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (cc) { return cc.code === utils_1.VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE && cc.system === utils_1.LOINC_SYSTEM; });
    })) === null || _e === void 0 ? void 0 : _e.valueQuantity) === null || _f === void 0 ? void 0 : _f.value;
    if (systolicBP === undefined || diastolicBP === undefined)
        return undefined;
    return {
        resourceId: observation.id,
        field: utils_1.VitalFieldNames.VitalBloodPressure,
        systolicPressure: systolicBP,
        diastolicPressure: diastolicBP,
        authorId: performer.id,
        authorName: (0, utils_1.getFullName)(performer),
        observationMethod: (0, utils_1.extractBloodPressureObservationMethod)(observation),
        lastUpdated: observation.effectiveDateTime || '',
    };
};
var extractWeightOptions = function (components) {
    var allExtraWeightOptions = ['patient_refused'];
    return allExtraWeightOptions.filter(function (option) {
        var optionCode = '';
        if (option === 'patient_refused') {
            optionCode = utils_1.VITAL_WEIGHT_PATIENT_REFUSED_OPTION_SNOMED_CODE;
        }
        var optionComponent = components.find(function (cmp) {
            var _a, _b;
            return (_b = (_a = cmp.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return (coding === null || coding === void 0 ? void 0 : coding.code) === optionCode; });
        });
        return (optionComponent === null || optionComponent === void 0 ? void 0 : optionComponent.valueBoolean) === true;
    });
};
exports.extractWeightOptions = extractWeightOptions;
var parseWeightObservation = function (observation, performer) {
    var _a, _b, _c, _d;
    var fieldCode = (_c = (_b = (_a = observation === null || observation === void 0 ? void 0 : observation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM); })) === null || _c === void 0 ? void 0 : _c.code;
    if (fieldCode !== utils_1.VitalFieldNames.VitalWeight)
        return undefined;
    var value = (_d = observation.valueQuantity) === null || _d === void 0 ? void 0 : _d.value;
    var components = observation.component || [];
    var weightOptions = (0, exports.extractWeightOptions)(components);
    if (weightOptions.includes('patient_refused')) {
        return {
            resourceId: observation.id,
            field: utils_1.VitalFieldNames.VitalWeight,
            extraWeightOptions: ['patient_refused'],
            authorId: performer.id,
            authorName: (0, utils_1.getFullName)(performer),
            lastUpdated: observation.effectiveDateTime || '',
        };
    }
    if (value === undefined)
        return undefined;
    return {
        resourceId: observation.id,
        field: utils_1.VitalFieldNames.VitalWeight,
        value: value,
        extraWeightOptions: weightOptions,
        authorId: performer.id,
        authorName: (0, utils_1.getFullName)(performer),
        lastUpdated: observation.effectiveDateTime || '',
    };
};
var parseVisionObservation = function (observation, performer) {
    var _a, _b, _c;
    // Check if the observation has the correct field code
    var fieldCode = (_c = (_b = (_a = observation === null || observation === void 0 ? void 0 : observation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM); })) === null || _c === void 0 ? void 0 : _c.code;
    if (fieldCode !== utils_1.VitalFieldNames.VitalVision)
        return undefined;
    var components = observation.component || [];
    var _d = (0, utils_1.extractVisionValues)(components), leftEyeVisionText = _d.leftEyeVisText, rightEyeVisionText = _d.rightEyeVisText, visionOptions = _d.visionOptions;
    if (leftEyeVisionText === undefined || rightEyeVisionText === undefined)
        return undefined;
    return {
        resourceId: observation.id,
        field: utils_1.VitalFieldNames.VitalVision,
        leftEyeVisionText: leftEyeVisionText,
        rightEyeVisionText: rightEyeVisionText,
        authorId: performer.id,
        authorName: (0, utils_1.getFullName)(performer),
        lastUpdated: observation.effectiveDateTime || '',
        extraVisionOptions: visionOptions,
    };
};
var parseNumericValueObservation = function (observation, performer, field) {
    var _a;
    var value = (_a = observation.valueQuantity) === null || _a === void 0 ? void 0 : _a.value;
    if (value === undefined)
        return undefined;
    var baseFields = {
        resourceId: observation.id,
        field: field,
        value: value,
        authorId: performer.id,
        authorName: (0, utils_1.getFullName)(performer),
        lastUpdated: observation.effectiveDateTime || '',
    };
    if (field === utils_1.VitalFieldNames.VitalOxygenSaturation) {
        return __assign(__assign({}, baseFields), { observationMethod: (0, utils_1.extractOxySaturationObservationMethod)(observation) });
    }
    if (field === utils_1.VitalFieldNames.VitalHeartbeat) {
        return __assign(__assign({}, baseFields), { observationMethod: (0, utils_1.extractHeartbeatObservationMethod)(observation) });
    }
    if (field === utils_1.VitalFieldNames.VitalTemperature) {
        return __assign(__assign({}, baseFields), { observationMethod: (0, utils_1.extractTemperatureObservationMethod)(observation) });
    }
    return baseFields;
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw new Error('Request body is required');
    }
    var _a = JSON.parse(input.body), encounterId = _a.encounterId, mode = _a.mode;
    var secrets = input.secrets;
    var missingParams = [];
    if (!encounterId) {
        missingParams.push('encounterId');
    }
    if (!mode) {
        missingParams.push('mode');
    }
    if (missingParams.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingParams);
    }
    if (typeof encounterId !== 'string' || !(0, utils_1.isValidUUID)(encounterId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"".concat(encounterId, "\" is not a valid UUID"));
    }
    if (typeof mode !== 'string' || (mode !== 'current' && mode !== 'historical')) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Invalid mode, \"".concat(mode, "\", specified - must be \"current\" or \"historical\""));
    }
    return { encounterId: encounterId, mode: mode, secrets: secrets };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, mode, resourcesFound, maybeEncounter, patientId, maybeAppointment, encounter, start;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                encounterId = input.encounterId, mode = input.mode;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:patient',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 1:
                resourcesFound = (_b.sent()).unbundle();
                maybeEncounter = resourcesFound.find(function (res) { return res.resourceType === 'Encounter'; });
                patientId = (_a = resourcesFound.find(function (res) { return res.resourceType === 'Patient'; })) === null || _a === void 0 ? void 0 : _a.id;
                maybeAppointment = resourcesFound.find(function (res) { return res.resourceType === 'Appointment'; });
                if (!maybeEncounter) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Encounter');
                }
                if (!patientId) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)("No patient found for Encounter/".concat(encounterId));
                }
                if (!maybeEncounter.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)("No id found for Encounter/".concat(encounterId));
                }
                encounter = __assign(__assign({}, maybeEncounter), { id: maybeEncounter.id });
                if (mode === 'historical' && !maybeAppointment) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)("No appointment found for Encounter/".concat(encounterId));
                }
                start = maybeAppointment === null || maybeAppointment === void 0 ? void 0 : maybeAppointment.start;
                if (mode === 'historical' && !start) {
                    throw (0, utils_1.INVALID_INPUT_ERROR)("\"".concat(encounterId, "\" does not reference an Appointment resource with a start time, which is required for historical mode."));
                }
                else if (mode === 'historical') {
                    return [2 /*return*/, {
                            encounter: encounter,
                            mode: { historical: true, searchBefore: start || '' },
                            patientId: patientId,
                        }];
                }
                return [2 /*return*/, {
                        encounter: encounter,
                        mode: { historical: false },
                        patientId: patientId,
                    }];
        }
    });
}); };
