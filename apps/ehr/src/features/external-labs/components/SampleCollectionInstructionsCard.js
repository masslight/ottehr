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
exports.SampleCollectionInstructionsCard = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var useAppClients_1 = require("src/hooks/useAppClients");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var AccordionCard_1 = require("../../../telemed/components/AccordionCard");
var BoldedTitleText_1 = require("./BoldedTitleText");
var OrderCollection_1 = require("./OrderCollection");
var SampleCollectionInstructionsCard = function (_a) {
    var sample = _a.sample, serviceRequestId = _a.serviceRequestId, timezone = _a.timezone, setSpecimenData = _a.setSpecimenData, printLabelVisible = _a.printLabelVisible, isDateEditable = _a.isDateEditable;
    var specimen = sample.specimen, definition = sample.definition;
    var _b = (0, react_1.useState)(false), collapsed = _b[0], setCollapsed = _b[1];
    var _c = (0, react_1.useState)(false), labelLoading = _c[0], setLabelLoading = _c[1];
    var _d = (0, react_1.useState)(), error = _d[0], setError = _d[1];
    var oystehr = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var theme = (0, material_1.useTheme)();
    var _e = (0, react_1.useState)(function () {
        return specimen.collectionDate
            ? luxon_1.DateTime.fromISO(specimen.collectionDate, { zone: timezone })
            : luxon_1.DateTime.now().setZone(timezone);
    }), date = _e[0], setDate = _e[1];
    (0, react_1.useEffect)(function () {
        if (date.isValid) {
            setSpecimenData(specimen.id, date.toISO());
        }
    }, [date, setSpecimenData, specimen.id]);
    var handleDateChange = function (field, value) {
        setDate(function (prev) {
            var parts = value.split(field === 'collectionDate' ? '-' : ':').map(Number);
            var updated = field === 'collectionDate'
                ? prev.set({ year: parts[0] || prev.year, month: parts[1] || prev.month, day: parts[2] || prev.day })
                : prev.set({ hour: parts[0] || prev.hour, minute: parts[1] || prev.minute });
            return updated.isValid ? updated : prev;
        });
    };
    var printLabel = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var labelPdfs, error_1, apiError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr)
                        return [2 /*return*/, setError(['Oystehr client is undefined'])];
                    setLabelLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, api_1.getLabelPdf)(oystehr, {
                            contextRelatedReference: { reference: "ServiceRequest/".concat(serviceRequestId) },
                            searchParams: [
                                { name: 'status', value: 'current' },
                                { name: 'type', value: utils_1.EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code },
                            ],
                        })];
                case 2:
                    labelPdfs = _a.sent();
                    if ((labelPdfs === null || labelPdfs === void 0 ? void 0 : labelPdfs.length) !== 1)
                        throw new Error('Unexpected number of label pdfs');
                    return [4 /*yield*/, (0, OrderCollection_1.openPdf)(labelPdfs[0].presignedURL)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _a.sent();
                    apiError = error_1;
                    setError(["Unable to load label pdf. Error: ".concat(apiError.message)]);
                    return [3 /*break*/, 6];
                case 5:
                    setLabelLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [oystehr, serviceRequestId]);
    return (<AccordionCard_1.AccordionCard label="Sample Collection Instructions" collapsed={collapsed} withBorder={false} onSwitch={function () { return setCollapsed(function (prev) { return !prev; }); }}>
      <material_1.Paper sx={{ p: 3 }}>
        <material_1.Stack spacing={1}>
          <BoldedTitleText_1.BoldedTitleText title="Container" description={definition.container}/>
          <BoldedTitleText_1.BoldedTitleText title="Volume" description={definition.volume}/>
          <BoldedTitleText_1.BoldedTitleText title="Minimum Volume" description={definition.minimumVolume}/>
          <BoldedTitleText_1.BoldedTitleText title="Storage Requirements" description={definition.storageRequirements}/>
          <BoldedTitleText_1.BoldedTitleText title="Collection Instructions" description={definition.collectionInstructions}/>
        </material_1.Stack>

        <material_1.Grid container spacing={2} sx={{ mt: 2 }}>
          <material_1.Grid item xs={12} md={6}>
            <material_1.Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Collection date
            </material_1.Typography>
            <material_1.TextField fullWidth variant="outlined" type="date" value={date.toFormat('yyyy-MM-dd')} onChange={function (e) { return handleDateChange('collectionDate', e.target.value); }} disabled={!isDateEditable}/>
          </material_1.Grid>
          <material_1.Grid item xs={12} md={6}>
            <material_1.Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Collection time
            </material_1.Typography>
            <material_1.TextField fullWidth variant="outlined" type="time" value={date.toFormat('HH:mm')} onChange={function (e) { return handleDateChange('collectionTime', e.target.value); }} disabled={!isDateEditable}/>
          </material_1.Grid>
        </material_1.Grid>

        {printLabelVisible && (<lab_1.LoadingButton variant="outlined" type="button" sx={{ width: 170, borderRadius: '50px', textTransform: 'none', mt: 3 }} onClick={printLabel} loading={labelLoading}>
            Print label
          </lab_1.LoadingButton>)}
        {error && error.length > 0 && (<material_1.Box sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {error.map(function (msg, idx) { return (<material_1.Box sx={{ textAlign: 'left', paddingTop: 1 }} key={idx}>
                <material_1.Typography sx={{ color: theme.palette.error.main }} key={"errorMsg-".concat(idx)}>
                  {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                </material_1.Typography>
              </material_1.Box>); })}
          </material_1.Box>)}
      </material_1.Paper>
    </AccordionCard_1.AccordionCard>);
};
exports.SampleCollectionInstructionsCard = SampleCollectionInstructionsCard;
//# sourceMappingURL=SampleCollectionInstructionsCard.js.map