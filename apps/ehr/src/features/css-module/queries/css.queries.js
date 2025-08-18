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
exports.useEditPatientProfilePhotoMutation = exports.useGetSignedPatientProfilePhotoUrlQuery = void 0;
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useGetSignedPatientProfilePhotoUrlQuery = function (z3PhotoUrl, onSuccess) {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    return (0, react_query_1.useQuery)(['Get-Signed-Patient-Profile-Photo-Url', z3PhotoUrl], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, api_1.getSignedPatientProfilePhotoUrl)(oystehrZambda, { z3PhotoUrl: z3PhotoUrl })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); }, {
        onSuccess: onSuccess,
        enabled: Boolean(oystehrZambda && z3PhotoUrl),
    });
};
exports.useGetSignedPatientProfilePhotoUrlQuery = useGetSignedPatientProfilePhotoUrlQuery;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useEditPatientProfilePhotoMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b, _c;
            var originalPatient = _a.originalPatient, newPatientData = _a.newPatientData;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            var operations = [];
            var shouldRemovePhoto = !newPatientData.photo || ((_b = newPatientData.photo) === null || _b === void 0 ? void 0 : _b.length) === 0;
            var hadPreviousPhotos = originalPatient.photo && originalPatient.photo.length !== 0;
            if (shouldRemovePhoto) {
                operations.push((0, utils_1.removeOperation)('/photo'));
            }
            else {
                operations.push((0, utils_1.addOrReplaceOperation)(hadPreviousPhotos ? hadPreviousPhotos : undefined, '/photo', newPatientData.photo));
            }
            return oystehr.fhir.patch({
                resourceType: 'Patient',
                id: (_c = newPatientData.id) !== null && _c !== void 0 ? _c : '',
                operations: operations,
            });
        },
        onError: function (err) {
            console.error('Error during updating patient profile photo information: ', err);
        },
    });
};
exports.useEditPatientProfilePhotoMutation = useEditPatientProfilePhotoMutation;
//# sourceMappingURL=css.queries.js.map