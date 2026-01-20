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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
var USAGE_STR = "Usage: npm run sync-lab-specimen-dates [ORDER NUMBER] [".concat(VALID_ENVS.join(' | '), "]\n");
main().catch(function (error) {
    console.error('Script failed:', error);
    process.exit(1);
});
/**
 * Syncs all specimens within a bundle to the same collectedDateTime. This makes LabCorp happy. Only an issue for testing; LabCorp doesn't care in prod.
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var orderNumber, ENV, envConfig, token, oystehrClient, resources, now, requests, results, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (process.argv.length !== 4) {
                        console.error("exiting, incorrect number of arguments passed\n");
                        console.log(USAGE_STR);
                        process.exit(1);
                    }
                    orderNumber = process.argv[2];
                    if (!orderNumber) {
                        console.error('No order number passed');
                        process.exit(5);
                    }
                    ENV = process.argv[3].toLowerCase();
                    ENV = ENV === 'dev' ? 'development' : ENV;
                    if (!ENV) {
                        console.error("exiting, ENV variable must be populated");
                        console.log(USAGE_STR);
                        process.exit(2);
                    }
                    envConfig = undefined;
                    try {
                        envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                    }
                    catch (e) {
                        console.error("Unable to read env file. Error: ".concat(JSON.stringify(e)));
                        process.exit(3);
                    }
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
                case 1:
                    token = _a.sent();
                    if (!token) {
                        console.error('Failed to fetch auth token.');
                        process.exit(4);
                    }
                    oystehrClient = (0, shared_1.createOystehrClient)(token, envConfig);
                    console.log("Searching for ServiceRequests matching order number ".concat(orderNumber, " on env: ").concat(ENV));
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'ServiceRequest',
                            params: [
                                {
                                    name: 'identifier',
                                    value: "".concat(utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, "|").concat(orderNumber),
                                },
                                {
                                    name: '_include',
                                    value: 'ServiceRequest:specimen',
                                },
                            ],
                        })];
                case 2:
                    resources = (_a.sent()).unbundle();
                    console.log("Found ".concat(resources.length, " results"));
                    now = luxon_1.DateTime.now().toISO();
                    requests = [];
                    resources.forEach(function (res) {
                        var _a;
                        if (res.resourceType === 'ServiceRequest' && res.status !== 'draft') {
                            console.error("ServiceRequest/".concat(res.id, " is in status=").concat(res.status, ". Cannot update specimen"));
                            process.exit(6);
                        }
                        if (res.resourceType === 'Specimen') {
                            console.log("Setting Specimen/".concat(res.id, " collection.collectedDateTime to ").concat(now));
                            requests.push({
                                method: 'PATCH',
                                url: "Specimen/".concat(res.id),
                                operations: [
                                    {
                                        op: ((_a = res.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime) ? 'replace' : 'add',
                                        path: '/collection/collectedDateTime',
                                        value: now,
                                    },
                                ],
                            });
                        }
                    });
                    console.log("\n\nThese are the ".concat(requests.length, " requests to make: ").concat(JSON.stringify(requests), "\n"));
                    if (!requests.length) {
                        console.log('No requests to make. Exiting successfully.');
                        process.exit(0);
                    }
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: requests })];
                case 4:
                    results = _a.sent();
                    console.log("Successfully patched Specimens! Results: ".concat(JSON.stringify(results)));
                    process.exit(0);
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    console.error('Encountered error patching Specimens');
                    throw e_1;
                case 6: return [2 /*return*/];
            }
        });
    });
}
