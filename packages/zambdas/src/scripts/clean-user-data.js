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
var utils_1 = require("utils");
var helpers_1 = require("./helpers");
var cleanUserData = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, phone, resources, _i, resources_1, person;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.argv[2] === 'production') {
                    throw Error('This script is forbidden in production mode');
                }
                return [4 /*yield*/, (0, helpers_1.createOystehrClientFromConfig)(config)];
            case 1:
                oystehr = _a.sent();
                phone = process.argv[3];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Person',
                        params: [{ name: 'telecom', value: phone }],
                    })];
            case 2:
                resources = (_a.sent()).unbundle();
                _i = 0, resources_1 = resources;
                _a.label = 3;
            case 3:
                if (!(_i < resources_1.length)) return [3 /*break*/, 6];
                person = resources_1[_i];
                if (!person.id) {
                    return [3 /*break*/, 6];
                }
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: [
                            (0, utils_1.getPatchBinary)({
                                resourceId: person.id,
                                resourceType: 'Person',
                                patchOperations: [{ op: 'remove', path: '/link' }],
                            }),
                        ],
                    })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 3];
            case 6:
                console.log('User data clear');
                return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(cleanUserData)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
// tsx ./scripts/clean-user-data.ts <env> <phone>
