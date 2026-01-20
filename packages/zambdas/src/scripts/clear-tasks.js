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
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
var clearTasks = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var token, e_1, oystehr, searchResults, e_2, idsToDelete;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('getting access token');
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 2:
                token = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                console.log('error getting token', JSON.stringify(e_1));
                throw e_1;
            case 4:
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = new sdk_1.default({
                    accessToken: token,
                    fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(config.AUTH0_AUDIENCE),
                });
                searchResults = [];
                _a.label = 5;
            case 5:
                _a.trys.push([5, 7, , 8]);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Task',
                        params: [
                            {
                                name: 'status:not',
                                value: 'complete',
                            },
                            { name: 'identifier', value: 'OTTEHR_SMS_Migration|,OTTEHR_Messaging_Migration|' },
                        ],
                    })];
            case 6:
                searchResults = (_a.sent()).unbundle();
                return [3 /*break*/, 8];
            case 7:
                e_2 = _a.sent();
                console.log('error getting search results', e_2);
                return [3 /*break*/, 8];
            case 8:
                console.log("found ".concat(searchResults.length, " task to delete"));
                idsToDelete = searchResults
                    .map(function (task) {
                    return task.id;
                })
                    .filter(function (id) { return !!id; });
                return [4 /*yield*/, batchDelete(idsToDelete, oystehr)];
            case 9:
                _a.sent();
                console.log("successfully deleted ".concat(idsToDelete.length, " tasks"));
                return [2 /*return*/];
        }
    });
}); };
// So we can use await
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var env, secrets;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                env = process.argv[2];
                secrets = JSON.parse(fs_1.default.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                return [4 /*yield*/, clearTasks(secrets)];
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
var batchDelete = function (idsToDelete, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var requests, e_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                requests = idsToDelete.map(function (id) {
                    return {
                        method: 'DELETE',
                        url: "/Task/".concat(id),
                    };
                });
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                e_3 = _a.sent();
                console.log('error getting search results', JSON.stringify(e_3));
                throw e_3;
            case 3: return [2 /*return*/];
        }
    });
}); };
