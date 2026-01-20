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
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function retireADs(config) {
    return __awaiter(this, void 0, void 0, function () {
        var token, oystehr, activityDefinitions, _i, activityDefinitions_1, resource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
                case 1:
                    token = _a.sent();
                    if (!token)
                        throw new Error('Failed to fetch auth token.');
                    oystehr = new sdk_1.default({
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(config.AUTH0_AUDIENCE),
                        accessToken: token,
                    });
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'ActivityDefinition',
                            params: [
                                { name: '_count', value: '1000' },
                                { name: 'status', value: 'active' },
                            ],
                        })];
                case 2:
                    activityDefinitions = (_a.sent()).unbundle();
                    console.log("Found ".concat(activityDefinitions.length, " ActivityDefinitions."));
                    _i = 0, activityDefinitions_1 = activityDefinitions;
                    _a.label = 3;
                case 3:
                    if (!(_i < activityDefinitions_1.length)) return [3 /*break*/, 6];
                    resource = activityDefinitions_1[_i];
                    if (!(resource.url && resource.url.startsWith('https://ottehr.com/FHIR/InHouseLab/ActivityDefinition'))) return [3 /*break*/, 5];
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'ActivityDefinition',
                            id: resource.id,
                            operations: [{ op: 'replace', path: '/status', value: 'retired' }],
                        })];
                case 4:
                    _a.sent();
                    console.log("Retired FHIR ActivityDefinition: ".concat(resource.url, ", with id: ").concat(resource.id));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/];
            }
        });
    });
}
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(retireADs)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                e_1 = _a.sent();
                console.log('Catch some error while running all effects: ', e_1);
                console.log('Stringifies: ', JSON.stringify(e_1));
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
