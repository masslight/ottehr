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
exports.default = AddEmployeePage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../api/api");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
function AddEmployeePage() {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(undefined), email = _a[0], setEmail = _a[1];
    var _b = (0, react_1.useState)(undefined), firstName = _b[0], setFirstName = _b[1];
    var _c = (0, react_1.useState)(undefined), lastName = _c[0], setLastName = _c[1];
    var _d = (0, react_1.useState)(false), loading = _d[0], setLoading = _d[1];
    var applicationID = import.meta.env.VITE_APP_OYSTEHR_APPLICATION_ID;
    function createEmployee(event) {
        return __awaiter(this, void 0, void 0, function () {
            var createUserResponse, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        event.preventDefault();
                        if (!oystehrZambda || !email || !firstName || !lastName) {
                            throw new Error('oystehrZambda, email, firstName, or lastName is not set');
                        }
                        setLoading(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, api_1.createUser)(oystehrZambda, {
                                email: email,
                                firstName: firstName,
                                lastName: lastName,
                                applicationID: applicationID,
                            })];
                    case 2:
                        createUserResponse = _a.sent();
                        setLoading(false);
                        navigate("/employee/".concat(createUserResponse.userID));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        setLoading(false);
                        console.error('error creating employee', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    return (<PageContainer_1.default>
      <>
        <material_1.Box marginX={12}>
          {/* Breadcrumbs */}
          <CustomBreadcrumbs_1.default chain={[
            { link: '/employees', children: 'Employees' },
            { link: '#', children: 'Add user' },
        ]}/>
          <material_1.Paper sx={{ padding: 2 }}>
            {/* Page title */}
            <material_1.Typography variant="h3" color="primary.dark" marginBottom={1}>
              Add user
            </material_1.Typography>
            <material_1.Typography variant="body1" sx={{ marginBottom: 2 }}>
              This will immediately give the user the Staff role.
            </material_1.Typography>
            <form onSubmit={createEmployee}>
              <material_1.TextField label="Email" type="email" required value={email} onChange={function (event) { return setEmail(event.target.value); }} sx={{
            marginBottom: 3,
            width: 300,
        }}/>
              <br />
              <material_1.TextField label="First name" required value={firstName} onChange={function (event) { return setFirstName(event.target.value); }} sx={{
            marginBottom: 3,
            width: 300,
        }}/>
              <br />
              <material_1.TextField label="Last name" required value={lastName} onChange={function (event) { return setLastName(event.target.value); }} sx={{
            marginBottom: 3,
            width: 300,
        }}/>
              <br />
              <lab_1.LoadingButton type="submit" loading={loading} variant="contained" sx={{ marginTop: 2 }}>
                Save
              </lab_1.LoadingButton>
            </form>
          </material_1.Paper>
        </material_1.Box>
      </>
    </PageContainer_1.default>);
}
//# sourceMappingURL=AddEmployeePage.js.map