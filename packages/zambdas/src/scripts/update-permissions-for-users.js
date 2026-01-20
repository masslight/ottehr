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
var fs_1 = require("fs");
var node_fetch_1 = require("node-fetch");
var shared_1 = require("../shared");
var updatePermissionsFromZambdaList = function (zambdaList, config) { return __awaiter(void 0, void 0, void 0, function () {
    var auth0Token, AccessPolicy, existingRoles, rolesData, patientRole, patientRoleRes, patientRoleRes, endpoint, response, resData;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 1:
                auth0Token = _a.sent();
                if (auth0Token === null) {
                    throw new Error('could not get Auth0 token');
                }
                console.log('building access policy');
                AccessPolicy = {
                    rule: [
                        {
                            resource: zambdaList.map(function (zambda) { return "Zambda:Function:".concat(zambda); }),
                            action: ['Zambda:InvokeFunction'],
                            effect: 'Allow',
                        },
                        // fhir is implicitly denied
                    ],
                };
                console.log('searching for existing roles for the project');
                return [4 /*yield*/, (0, node_fetch_1.default)("".concat(config.PROJECT_API, "/iam/roles"), {
                        method: 'GET',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            Authorization: "Bearer ".concat(auth0Token),
                        },
                    })];
            case 2:
                existingRoles = _a.sent();
                return [4 /*yield*/, existingRoles.json()];
            case 3:
                rolesData = _a.sent();
                console.log('existingRoles: ', rolesData);
                if (rolesData.length > 0) {
                    patientRole = rolesData.find(function (role) { return role.name === 'Patient'; });
                }
                if (!patientRole) return [3 /*break*/, 6];
                console.log('patient role found: ', patientRole);
                return [4 /*yield*/, (0, node_fetch_1.default)("".concat(config.PROJECT_API, "/iam/roles/").concat(patientRole.id), {
                        method: 'PATCH',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            Authorization: "Bearer ".concat(auth0Token),
                        },
                        body: JSON.stringify({ accessPolicy: AccessPolicy }),
                    })];
            case 4:
                patientRoleRes = _a.sent();
                return [4 /*yield*/, patientRoleRes.json()];
            case 5:
                patientRole = _a.sent();
                console.log('patientRole inlineAccessPolicy patch: ', patientRole);
                return [3 /*break*/, 9];
            case 6:
                console.log('creating patient role');
                return [4 /*yield*/, (0, node_fetch_1.default)("".concat(config.PROJECT_API, "/iam/roles"), {
                        method: 'POST',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            Authorization: "Bearer ".concat(auth0Token),
                        },
                        body: JSON.stringify({ name: 'Patient', accessPolicy: AccessPolicy }),
                    })];
            case 7:
                patientRoleRes = _a.sent();
                return [4 /*yield*/, patientRoleRes.json()];
            case 8:
                patientRole = _a.sent();
                console.log('patientRole: ', patientRole);
                _a.label = 9;
            case 9:
                console.group('setting default patient role for project');
                endpoint = "".concat(config.PROJECT_API, "/project");
                console.log('sending to endpoint: ', endpoint);
                return [4 /*yield*/, (0, node_fetch_1.default)(endpoint, {
                        method: 'PATCH',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            Authorization: "Bearer ".concat(auth0Token),
                        },
                        body: JSON.stringify({ defaultPatientRoleId: patientRole.id, signupEnabled: true }),
                    })];
            case 10:
                response = _a.sent();
                return [4 /*yield*/, response.json()];
            case 11:
                resData = _a.sent();
                console.log('response json: ', resData);
                console.groupEnd();
                if (response.status === 200) {
                    console.log('successfully updated default patient role');
                }
                else {
                    throw new Error('Failed to update default patient role');
                }
                return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var env, envAuthZambdas, config;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                env = process.argv[2];
                envAuthZambdas = [];
                config = JSON.parse(fs_1.default.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                envAuthZambdas.push('create-appointment');
                envAuthZambdas.push('get-patients');
                envAuthZambdas.push('get-appointments');
                if (!envAuthZambdas || envAuthZambdas.length === 0) {
                    throw new Error('Issue getting authorized zambdas for this environment');
                }
                if (!config) {
                    throw new Error('could not set environment properly');
                }
                return [4 /*yield*/, updatePermissionsFromZambdaList(envAuthZambdas, config)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log(error);
    throw error;
});
