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
exports.createVideoRoom = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/appointment/helpers");
var helpers_2 = require("../../shared/helpers");
var patients_1 = require("../../shared/patients");
var createVideoRoom = function (appointment, currentVideoEncounter, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, relatedPerson, updatedEncounter, videoRoomEncounterResource;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = (0, helpers_1.getPatientFromAppointment)(appointment);
                if (!patientId) {
                    throw new Error("Patient id not defined on appointment ".concat(appointment.id));
                }
                return [4 /*yield*/, (0, patients_1.getRelatedPersonForPatient)(patientId, oystehr)];
            case 1:
                relatedPerson = _a.sent();
                updatedEncounter = updateVideoRoomEncounter(currentVideoEncounter, relatedPerson);
                return [4 /*yield*/, execCreateVideoRoomRequest(secrets, updatedEncounter)];
            case 2:
                videoRoomEncounterResource = _a.sent();
                return [2 /*return*/, videoRoomEncounterResource];
        }
    });
}); };
exports.createVideoRoom = createVideoRoom;
var execCreateVideoRoomRequest = function (secrets, encounter) { return __awaiter(void 0, void 0, void 0, function () {
    var token, response, responseData;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                token = _a.sent();
                return [4 /*yield*/, fetch("".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/telemed/v2/meeting"), {
                        body: JSON.stringify({ encounter: encounter }),
                        headers: {
                            Authorization: "Bearer ".concat(token),
                        },
                        method: 'POST',
                    })];
            case 2:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Request failed to create a telemed video room: ".concat(response.statusText));
                }
                return [4 /*yield*/, response.json()];
            case 3:
                responseData = (_a.sent());
                return [2 /*return*/, responseData.encounter];
        }
    });
}); };
var updateVideoRoomEncounter = function (encounter, relatedPerson, startTime) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (startTime === void 0) { startTime = luxon_1.DateTime.now(); }
    encounter.status = 'in-progress';
    var startTimeIso = startTime.toUTC().toISO();
    (_a = encounter.statusHistory) !== null && _a !== void 0 ? _a : (encounter.statusHistory = []);
    var previousStatus = (_b = encounter.statusHistory) === null || _b === void 0 ? void 0 : _b[((_c = encounter.statusHistory) === null || _c === void 0 ? void 0 : _c.length) - 1];
    if (previousStatus) {
        previousStatus.period = __assign(__assign({}, previousStatus.period), { end: startTimeIso });
    }
    (_d = encounter.statusHistory) === null || _d === void 0 ? void 0 : _d.push({
        status: encounter.status,
        period: {
            start: startTimeIso,
        },
    });
    (_e = encounter.participant) !== null && _e !== void 0 ? _e : (encounter.participant = []);
    if (relatedPerson) {
        (_f = encounter.participant) === null || _f === void 0 ? void 0 : _f.push({
            individual: {
                reference: "RelatedPerson/".concat(relatedPerson === null || relatedPerson === void 0 ? void 0 : relatedPerson.id),
            },
        });
    }
    var videoRoomExt = (0, helpers_2.getVideoRoomResourceExtension)(encounter);
    encounter.extension = (_g = encounter.extension) === null || _g === void 0 ? void 0 : _g.filter(function (ext) { return ext !== videoRoomExt; });
    return encounter;
};
