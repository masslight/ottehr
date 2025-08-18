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
exports.ResourceHandlerAbstract = void 0;
var sdk_1 = require("@oystehr/sdk");
var getAuth0Token_1 = require("../auth/getAuth0Token");
var ResourceHandlerAbstract = /** @class */ (function () {
    function ResourceHandlerAbstract() {
        this.createdResourcesDeleteParams = [];
    }
    ResourceHandlerAbstract.prototype.initApi = function () {
        return __awaiter(this, void 0, void 0, function () {
            var accessToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, getAuth0Token_1.getAuth0Token)()];
                    case 1:
                        accessToken = _a.sent();
                        this.accessToken = accessToken;
                        this.apiClient = new sdk_1.default({
                            accessToken: accessToken,
                            fhirApiUrl: process.env.FHIR_API,
                            projectApiUrl: process.env.AUTH0_AUDIENCE,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandlerAbstract.prototype.createResource = function (resource) {
        return __awaiter(this, void 0, void 0, function () {
            var created, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.apiClient.fhir.create(resource)];
                    case 1:
                        created = _a.sent();
                        if (created.id) {
                            console.log("\uD83D\uDC4F ".concat(resource['resourceType'], " created"), created.id);
                            this.createdResourcesDeleteParams.push({ id: created.id, resourceType: created['resourceType'] });
                            return [2 /*return*/, created];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error("\u274C ".concat(resource['resourceType'], " not created"), error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, undefined];
                }
            });
        });
    };
    ResourceHandlerAbstract.prototype.deleteResource = function (fhirDeleteParams) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.apiClient.fhir.delete(fhirDeleteParams)];
                    case 1:
                        _a.sent();
                        console.log("\u2705 ".concat(fhirDeleteParams.resourceType, " deleted ").concat(fhirDeleteParams.id));
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        console.error("\u274C ".concat(fhirDeleteParams.resourceType, " not deleted: ").concat(e_1));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandlerAbstract.prototype.cleanupResources = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, argsToDelete;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this.createdResourcesDeleteParams;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        argsToDelete = _a[_i];
                        return [4 /*yield*/, this.deleteResource(argsToDelete)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return ResourceHandlerAbstract;
}());
exports.ResourceHandlerAbstract = ResourceHandlerAbstract;
//# sourceMappingURL=resource-handler-abstract.js.map