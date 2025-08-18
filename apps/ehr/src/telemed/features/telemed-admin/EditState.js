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
exports.default = EditStatePage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var App_1 = require("../../../App");
var CustomBreadcrumbs_1 = require("../../../components/CustomBreadcrumbs");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var useAppClients_1 = require("../../../hooks/useAppClients");
var PageContainer_1 = require("../../../layout/PageContainer");
function EditStatePage() {
    var _this = this;
    var _a;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(false), isOperateInStateChecked = _b[0], setIsOperateInStateChecked = _b[1];
    var state = (0, react_router_dom_1.useParams)().state;
    var fullLabel = "".concat(state, " - ").concat((_a = utils_1.AllStatesToVirtualLocationsData[state]) === null || _a === void 0 ? void 0 : _a.name);
    if (!oystehr || !state) {
        throw new Error('oystehr or state is not initialized.');
    }
    var _c = (0, react_query_1.useQuery)(['state-location-data'], function () { return getStateLocation(oystehr, state); }, {
        onSuccess: function (location) {
            setIsOperateInStateChecked(Boolean(location && location.status === 'active'));
        },
    }), location = _c.data, isFetching = _c.isFetching;
    var mutation = (0, react_query_1.useMutation)(function (_a) {
        var location = _a.location, newStatus = _a.newStatus;
        return updateStateLocationStatus(oystehr, location, newStatus);
    });
    var onSwitchChange = function (value) {
        setIsOperateInStateChecked(value);
    };
    var onSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var newStatus;
        return __generator(this, function (_a) {
            event.preventDefault();
            newStatus = isOperateInStateChecked ? 'active' : 'suspended';
            if (!location) {
                (0, notistack_1.enqueueSnackbar)('Location was not loaded.', {
                    variant: 'error',
                });
                throw new Error('Location was not loaded.');
            }
            mutation.mutate({ newStatus: newStatus, location: location }, {
                onSuccess: function (data) {
                    console.log("".concat(data));
                    (0, notistack_1.enqueueSnackbar)("State was updated successfully", {
                        variant: 'success',
                    });
                },
                onError: function (error) {
                    console.log("error while updating state: ".concat(error));
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while updating state. Please try again.', {
                        variant: 'error',
                    });
                },
            });
            return [2 /*return*/];
        });
    }); };
    return (<PageContainer_1.default tabTitle={'Edit State'}>
      <form onSubmit={onSubmit}>
        <material_1.Grid container direction="row" alignItems="center" justifyContent="center">
          <material_1.Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs_1.default chain={[
            { link: App_1.STATES_URL, children: 'States' },
            { link: '#', children: fullLabel || <material_1.Skeleton width={150}/> },
        ]}/>

            {/* Page Title */}
            <material_1.Typography data-testid={data_test_ids_1.dataTestIds.editState.stateNameTitle} variant="h3" color="primary.dark" marginTop={2} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}>
              {fullLabel || <material_1.Skeleton width={250}/>}
            </material_1.Typography>

            {/* Page Content */}
            <material_1.Paper sx={{ padding: 3 }}>
              <material_1.FormLabel sx={__assign(__assign({}, theme.typography.h4), { color: theme.palette.primary.dark, mb: 1, fontWeight: '600 !important' })}>
                State information
              </material_1.FormLabel>

              <material_1.Box sx={{ marginTop: '10px' }}>
                <material_1.TextField data-testid={data_test_ids_1.dataTestIds.editState.stateNameField} id="outlined-read-only-input" label="State name" value={fullLabel} sx={{ marginBottom: 2 }} margin="dense" InputProps={{
            readOnly: true,
        }}/>
              </material_1.Box>
              <material_1.Box>
                {isFetching ? (<material_1.Skeleton width={140} height={38}/>) : (<material_1.FormControlLabel control={<material_1.Switch data-testid={data_test_ids_1.dataTestIds.editState.operateInStateToggle} checked={isOperateInStateChecked} onChange={function (event) { return onSwitchChange(event.target.checked); }}/>} label="Operate in state"/>)}
              </material_1.Box>

              {/* Update State and Cancel Buttons */}
              <material_1.Grid>
                <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.editState.saveChangesButton} variant="contained" color="primary" sx={{
            textTransform: 'none',
            borderRadius: 28,
            marginTop: 3,
            fontWeight: 'bold',
            marginRight: 1,
        }} type="submit" loading={isFetching || mutation.isLoading} disabled={false}>
                  Save changes
                </lab_1.LoadingButton>

                <react_router_dom_1.Link to={App_1.STATES_URL}>
                  <material_1.Button data-testid={data_test_ids_1.dataTestIds.editState.cancelButton} variant="text" color="primary" sx={{
            textTransform: 'none',
            borderRadius: 28,
            marginTop: 3,
            fontWeight: 'bold',
        }}>
                    Cancel
                  </material_1.Button>
                </react_router_dom_1.Link>
              </material_1.Grid>
            </material_1.Paper>
          </material_1.Grid>
        </material_1.Grid>
      </form>
    </PageContainer_1.default>);
}
function getStateLocation(oystehr, state) {
    return __awaiter(this, void 0, void 0, function () {
        var resources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Location',
                        params: [
                            {
                                name: 'address-state',
                                value: state,
                            },
                        ],
                    })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    return [2 /*return*/, resources.find(utils_1.isLocationVirtual)];
            }
        });
    });
}
function updateStateLocationStatus(oystehr, location, status) {
    return __awaiter(this, void 0, void 0, function () {
        var updatedLocation;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Location',
                        id: (_a = location.id) !== null && _a !== void 0 ? _a : '',
                        operations: [
                            {
                                op: location.status ? 'replace' : 'add',
                                path: '/status',
                                value: status,
                            },
                        ],
                    })];
                case 1:
                    updatedLocation = _b.sent();
                    return [2 /*return*/, updatedLocation];
            }
        });
    });
}
//# sourceMappingURL=EditState.js.map