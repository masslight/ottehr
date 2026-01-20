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
var sdk_1 = require("@oystehr/sdk");
var fs_1 = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, secrets, project_url, token, oystehr, zambdasList, cancelTelemedAppointmentsZambda, resourceBundle, appointments;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    env = process.argv[2];
                    secrets = JSON.parse(fs_1.default.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    project_url = secrets.PROJECT_API;
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _b.sent();
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                        projectApiUrl: (0, helpers_1.projectApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, oystehr.zambda.list()];
                case 2:
                    zambdasList = _b.sent();
                    cancelTelemedAppointmentsZambda = zambdasList.find(function (zambda) { return zambda.name === 'telemed-cancel-appointment'; });
                    if (!cancelTelemedAppointmentsZambda) {
                        console.error('Cancel telemed appointment zambda not found');
                    }
                    console.error("Cancel telemed appointment zambda id: ".concat(cancelTelemedAppointmentsZambda === null || cancelTelemedAppointmentsZambda === void 0 ? void 0 : cancelTelemedAppointmentsZambda.id));
                    if (!token) {
                        throw new Error('Failed to fetch auth token.');
                    }
                    return [4 /*yield*/, oystehr.fhir
                            .search({
                            resourceType: 'Appointment',
                            params: [
                                {
                                    name: '_tag',
                                    value: utils_1.OTTEHR_MODULE.TM,
                                },
                                {
                                    name: 'status',
                                    value: 'arrived',
                                },
                            ],
                        })
                            .catch(function (error) {
                            console.log(error, JSON.stringify(error));
                        })];
                case 3:
                    resourceBundle = (_a = (_b.sent())) === null || _a === void 0 ? void 0 : _a.unbundle();
                    console.log('Got Appointment related resources');
                    appointments = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.filter(function (resource) {
                        return resource.resourceType === 'Appointment' &&
                            resource.participant.find(function (x) { var _a; return ((_a = x.actor) === null || _a === void 0 ? void 0 : _a.reference) === 'Location/9259b680-0cef-4d2f-805f-2b044f872b41'; });
                    });
                    console.log(JSON.stringify(appointments), appointments.length);
                    appointments.forEach(function (appt) { return __awaiter(_this, void 0, void 0, function () {
                        var resp;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("Cancelling appointment ".concat(appt.id));
                                    return [4 /*yield*/, fetch("".concat(project_url, "/v1/zambda/").concat(cancelTelemedAppointmentsZambda === null || cancelTelemedAppointmentsZambda === void 0 ? void 0 : cancelTelemedAppointmentsZambda.id, "/execute"), {
                                            method: 'POST',
                                            headers: { accept: 'application/json', 'content-type': 'application/json', Authorization: "Bearer ".concat(token) },
                                            body: JSON.stringify({
                                                appointmentID: appt.id,
                                                cancellationReason: 'Patient improved',
                                            }),
                                        }).catch(function (err) { return console.log(err, JSON.stringify(err)); })];
                                case 1:
                                    resp = _a.sent();
                                    console.log("Response ".concat(JSON.stringify(resp)));
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('Completed processing practitioners'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
