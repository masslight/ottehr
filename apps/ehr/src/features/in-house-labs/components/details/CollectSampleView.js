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
exports.CollectSampleView = void 0;
var KeyboardArrowDown_1 = require("@mui/icons-material/KeyboardArrowDown");
var KeyboardArrowUp_1 = require("@mui/icons-material/KeyboardArrowUp");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var api_1 = require("src/api/api");
var useEvolveUser_1 = require("src/hooks/useEvolveUser");
var utils_1 = require("utils");
var useAppClients_1 = require("../../../../hooks/useAppClients");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var appointment_store_1 = require("../../../../telemed/state/appointment/appointment.store");
var InHouseLabsDetailsCard_1 = require("./InHouseLabsDetailsCard");
var CollectSampleView = function (_a) {
    var testDetails = _a.testDetails, onBack = _a.onBack, onSubmit = _a.onSubmit;
    var _b = (0, react_1.useState)(true), showSampleCollection = _b[0], setShowSampleCollection = _b[1];
    var _c = (0, react_1.useState)(''), sourceType = _c[0], setSourceType = _c[1];
    var _d = (0, react_1.useState)(''), collectedById = _d[0], setCollectedById = _d[1];
    var initialDateTime = luxon_1.DateTime.now().setZone(testDetails.timezone);
    var _e = (0, react_1.useState)(initialDateTime), date = _e[0], setDate = _e[1];
    var timeValue = date.toFormat('HH:mm');
    var _f = (0, react_1.useState)(false), showDetails = _f[0], setShowDetails = _f[1];
    var _g = (0, react_1.useState)(false), labelButtonLoading = _g[0], setLabelButtonLoading = _g[1];
    var _h = (0, react_1.useState)(''), error = _h[0], setError = _h[1];
    var theme = (0, material_1.useTheme)();
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var encounter = (0, getSelectors_1.getSelectors)(appointment_store_1.useAppointmentStore, ['encounter']).encounter;
    var currentUser = (0, useEvolveUser_1.default)();
    // set default collected by to current user if no choice made
    (0, react_1.useEffect)(function () {
        var _a;
        var id = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.profileResource) === null || _a === void 0 ? void 0 : _a.id;
        if (!collectedById && id) {
            setCollectedById(id);
        }
    }, [collectedById, currentUser]);
    var providers = testDetails.currentUserId !== testDetails.orderingPhysicianId
        ? [
            { name: testDetails.currentUserFullName, id: testDetails.currentUserId },
            { name: testDetails.orderingPhysicianFullName, id: testDetails.orderingPhysicianId },
        ]
        : [{ name: testDetails.currentUserFullName, id: testDetails.currentUserId }];
    var handleToggleSampleCollection = function () {
        setShowSampleCollection(!showSampleCollection);
    };
    var handleMarkAsCollected = function () {
        var _a;
        var isoDate = date.toISO();
        if (!isoDate) {
            setError('Issue parsing date');
            return;
        }
        onSubmit({
            specimen: {
                source: sourceType,
                collectedBy: { id: collectedById, name: ((_a = providers.find(function (p) { return p.id === collectedById; })) === null || _a === void 0 ? void 0 : _a.name) || '' },
                collectionDate: isoDate,
            },
        });
    };
    var handleReprintLabel = function () { return __awaiter(void 0, void 0, void 0, function () {
        var labelPdfs, labelPdf;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(encounter.id && oystehrZambda)) return [3 /*break*/, 2];
                    setLabelButtonLoading(true);
                    console.log('Fetching visit label for encounter ', encounter.id);
                    return [4 /*yield*/, (0, api_1.getOrCreateVisitLabel)(oystehrZambda, { encounterId: encounter.id })];
                case 1:
                    labelPdfs = _a.sent();
                    if (labelPdfs.length !== 1) {
                        setError('Expected 1 label pdf, received unexpected number');
                        return [2 /*return*/];
                    }
                    labelPdf = labelPdfs[0];
                    window.open(labelPdf.presignedURL, '_blank');
                    setLabelButtonLoading(false);
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    var handleDateChange = function (e) {
        var newValue = e.target.value;
        if (newValue && newValue.length === 10) {
            var newDate = luxon_1.DateTime.fromFormat(newValue, 'yyyy-MM-dd').set({
                hour: date.hour,
                minute: date.minute,
            });
            if (newDate.isValid) {
                setDate(newDate);
            }
        }
    };
    var handleTimeChange = function (e) {
        var newValue = e.target.value;
        if (newValue && newValue.length === 5) {
            var _a = newValue.split(':').map(Number), hour = _a[0], minute = _a[1];
            var newDate = date.set({ hour: hour, minute: minute });
            if (newDate.isValid) {
                setDate(newDate);
            }
        }
    };
    return (<material_1.Box sx={{ backgroundColor: '#FAFAFA', minHeight: '100vh' }}>
      <material_1.Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <material_1.Typography variant="h4" sx={{ mb: 1, fontWeight: 600, fontSize: '2rem', color: 'primary.dark' }}>
          Collect Sample
        </material_1.Typography>

        <material_1.Typography variant="body1" sx={{ mb: 4, fontSize: '1rem', color: '#5F6368' }}>
          {(0, utils_1.getFormattedDiagnoses)(testDetails.diagnosesDTO)}
        </material_1.Typography>

        <material_1.Paper sx={{
            mb: 3,
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgb(225, 225, 225)',
            boxShadow: 'none',
        }}>
          <material_1.Box sx={{ p: 3 }}>
            <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <material_1.Typography variant="h5" sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'primary.dark',
        }}>
                {testDetails.testItemName}
              </material_1.Typography>
              <material_1.Box sx={{
            bgcolor: '#E8EAED',
            color: '#5F6368',
            fontWeight: 600,
            px: 2,
            py: 0.5,
            borderRadius: '4px',
            fontSize: '0.75rem',
            letterSpacing: '0.5px',
        }}>
                {testDetails.status.toUpperCase()}
              </material_1.Box>
            </material_1.Box>

            <material_1.Box sx={{ backgroundColor: '#F8F9FA', mx: -3, p: 3, margin: 0, padding: '4px 24px' }}>
              <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            mb: 2,
            margin: 0,
        }} onClick={handleToggleSampleCollection}>
                <material_1.Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>Sample collection</material_1.Typography>
                <material_1.IconButton size="small">
                  {showSampleCollection ? <KeyboardArrowUp_1.default /> : <KeyboardArrowDown_1.default />}
                </material_1.IconButton>
              </material_1.Box>

              <material_1.Collapse in={showSampleCollection}>
                <material_1.Box>
                  <material_1.Grid container spacing={2} sx={{ padding: '4px 0 20px 0' }}>
                    <material_1.Grid item xs={12}>
                      <material_1.TextField fullWidth label="Source" value={sourceType} onChange={function (e) { return setSourceType(e.target.value); }} placeholder="Enter source" variant="outlined" sx={{
            '& .MuiInputLabel-root': {
                color: '#5F6368',
                fontSize: '0.875rem',
                lineHeight: '0.8rem',
                '&.Mui-focused': {
                    color: '#5F6368',
                },
            },
            '& .MuiOutlinedInput-root': {
                backgroundColor: '#FFFFFF',
                '& fieldset': {
                    borderColor: '#DADCE0',
                },
                '&:hover fieldset': {
                    borderColor: '#DADCE0',
                },
                '&.Mui-focused fieldset': {
                    borderColor: '#DADCE0',
                    borderWidth: '1px',
                },
                '& .MuiInputBase-input': {
                    py: 1.5,
                    fontSize: '0.875rem',
                },
            },
            '& .MuiInputLabel-shrink': {
                backgroundColor: '#F8F9FA',
                px: 1,
                fontSize: '0.75rem',
            },
        }}/>
                    </material_1.Grid>

                    <material_1.Grid item xs={12}>
                      <material_1.TextField fullWidth select label="Collected by" value={collectedById} onChange={function (e) { return setCollectedById(e.target.value); }} variant="outlined" SelectProps={{
            IconComponent: KeyboardArrowDown_1.default,
        }} sx={{
            '& .MuiInputLabel-root': {
                color: '#5F6368',
                fontSize: '0.875rem',
                lineHeight: '1rem',
                '&.Mui-focused': {
                    color: '#5F6368',
                },
            },
            '& .MuiOutlinedInput-root': {
                backgroundColor: '#FFFFFF',
                '& fieldset': {
                    borderColor: '#DADCE0',
                },
                '&:hover fieldset': {
                    borderColor: '#DADCE0',
                },
                '&.Mui-focused fieldset': {
                    borderColor: '#DADCE0',
                    borderWidth: '1px',
                },
                '& .MuiInputBase-input': {
                    py: 1.5,
                    fontSize: '0.875rem',
                },
            },
            '& .MuiInputLabel-shrink': {
                backgroundColor: '#F8F9FA',
                px: 1,
                fontSize: '0.75rem',
            },
        }}>
                        {!collectedById && <material_1.MenuItem value="">Select</material_1.MenuItem>}
                        {providers.map(function (provider) { return (<material_1.MenuItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </material_1.MenuItem>); })}
                      </material_1.TextField>
                    </material_1.Grid>

                    <material_1.Grid item xs={6}>
                      <material_1.TextField fullWidth label="Collection date" type="date" value={date.toFormat('yyyy-MM-dd')} onChange={handleDateChange} variant="outlined" InputLabelProps={{
            shrink: true,
        }} sx={{
            '& .MuiInputLabel-root': {
                color: '#5F6368',
                fontSize: '0.875rem',
                '&.Mui-focused': {
                    color: '#5F6368',
                },
            },
            '& .MuiOutlinedInput-root': {
                backgroundColor: '#FFFFFF',
                '& fieldset': {
                    borderColor: '#DADCE0',
                },
                '&:hover fieldset': {
                    borderColor: '#DADCE0',
                },
                '&.Mui-focused fieldset': {
                    borderColor: '#DADCE0',
                    borderWidth: '1px',
                },
                '& .MuiInputBase-input': {
                    py: 1.5,
                    fontSize: '0.85rem',
                },
            },
            '& .MuiInputLabel-shrink': {
                backgroundColor: '#F8F9FA',
                px: 1,
                fontSize: '0.85rem',
            },
        }}/>
                    </material_1.Grid>

                    <material_1.Grid item xs={6}>
                      <material_1.FormControl fullWidth>
                        <material_1.TextField label="Collection time" type="time" value={timeValue} onChange={function (e) { return handleTimeChange(e); }} sx={{
            '& .MuiInputLabel-root': {
                color: '#5F6368',
                fontSize: '0.875rem',
                '&.Mui-focused': {
                    color: '#5F6368',
                },
            },
            '& .MuiOutlinedInput-root': {
                backgroundColor: '#FFFFFF',
                '& fieldset': {
                    borderColor: '#DADCE0',
                },
                '&:hover fieldset': {
                    borderColor: '#DADCE0',
                },
                '&.Mui-focused fieldset': {
                    borderColor: '#DADCE0',
                    borderWidth: '1px',
                },
                '& .MuiInputBase-input': {
                    py: 1.5,
                    fontSize: '0.85rem',
                },
            },
            '& .MuiInputLabel-shrink': {
                backgroundColor: '#F8F9FA',
                px: 1,
                fontSize: '0.85rem',
            },
        }}/>
                      </material_1.FormControl>
                    </material_1.Grid>
                  </material_1.Grid>
                </material_1.Box>
              </material_1.Collapse>
            </material_1.Box>

            <InHouseLabsDetailsCard_1.InHouseLabsDetailsCard testDetails={testDetails} page={utils_1.PageName.collectSample} showDetails={showDetails} setShowDetails={setShowDetails}/>

            <material_1.Stack direction="row" spacing={2} justifyContent="space-between" mt={4}>
              <material_1.Button variant="outlined" onClick={handleReprintLabel} disabled={labelButtonLoading} sx={{
            borderRadius: '20px',
            px: 3,
            py: 0.75,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderColor: '#1A73E8',
            color: '#1A73E8',
            '&:hover': {
                borderColor: '#1A73E8',
                backgroundColor: 'rgba(26, 115, 232, 0.04)',
            },
        }}>
                Re-Print Label
              </material_1.Button>

              <material_1.Button variant="contained" onClick={handleMarkAsCollected} disabled={!sourceType || !collectedById || !date.isValid} sx={{
            borderRadius: '20px',
            px: 3,
            py: 0.75,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            backgroundColor: '#1A73E8',
            boxShadow: 'none',
            '&:hover': {
                backgroundColor: '#1557B0',
                boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
            },
            '&:disabled': {
                backgroundColor: '#E8EAED',
                color: '#9AA0A6',
            },
        }}>
                Mark as Collected
              </material_1.Button>
            </material_1.Stack>

            {!!error && (<material_1.Box mt={2}>
                <material_1.Typography sx={{ color: theme.palette.error.main, fontSize: '0.875rem' }}>{error}</material_1.Typography>
              </material_1.Box>)}
          </material_1.Box>
        </material_1.Paper>

        <material_1.Button variant="outlined" onClick={onBack} sx={{
            borderRadius: '20px',
            px: 3,
            py: 0.75,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderColor: '#DADCE0',
        }}>
          Back
        </material_1.Button>
      </material_1.Box>
    </material_1.Box>);
};
exports.CollectSampleView = CollectSampleView;
//# sourceMappingURL=CollectSampleView.js.map