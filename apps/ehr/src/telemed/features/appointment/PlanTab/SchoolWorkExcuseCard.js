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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchoolWorkExcuseCard = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var parser_1 = require("../../../../features/css-module/parser");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var components_2 = require("./components");
var SchoolWorkExcuseCard = function () {
    var _a = (0, react_1.useState)(false), collapsed = _a[0], setCollapsed = _a[1];
    var _b = (0, react_1.useState)(false), generateWorkTemplateOpen = _b[0], setGenerateWorkTemplateOpen = _b[1];
    var _c = (0, react_1.useState)(false), generateWorkFreeOpen = _c[0], setGenerateWorkFreeOpen = _c[1];
    var _d = (0, react_1.useState)(false), generateSchoolTemplateOpen = _d[0], setGenerateSchoolTemplateOpen = _d[1];
    var _e = (0, react_1.useState)(false), generateSchoolFreeOpen = _e[0], setGenerateSchoolFreeOpen = _e[1];
    var _f = (0, state_1.useSaveChartData)(), saveChartData = _f.mutate, isSaveLoading = _f.isLoading;
    var _g = (0, state_1.useDeleteChartData)(), deleteChartData = _g.mutate, isDeleteLoading = _g.isLoading;
    var isLoading = isSaveLoading || isDeleteLoading;
    var _h = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'chartData',
        'questionnaireResponse',
        'setPartialChartData',
    ]), chartData = _h.chartData, questionnaireResponse = _h.questionnaireResponse, setPartialChartData = _h.setPartialChartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var presignedFiles = (0, hooks_1.useExcusePresignedFiles)(chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes);
    var _j = (0, hooks_1.usePatientProvidedExcusePresignedFiles)(), patientSchoolPresignedUrl = _j.patientSchoolPresignedUrl, patientWorkPresignedUrl = _j.patientWorkPresignedUrl;
    var workExcuse = presignedFiles.find(function (file) { return file.type === 'work'; });
    var schoolExcuse = presignedFiles.find(function (file) { return file.type === 'school'; });
    var onDelete = function (id) {
        var schoolWorkNotes = (chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes) || [];
        var note = schoolWorkNotes.find(function (note) { return note.id === id; });
        deleteChartData({
            schoolWorkNotes: [note],
        }, {
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting excuse. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({
                    schoolWorkNotes: schoolWorkNotes,
                });
            },
        });
        setPartialChartData({
            schoolWorkNotes: schoolWorkNotes.filter(function (note) { return note.id !== id; }),
        });
    };
    var onPublish = function (id) {
        var schoolWorkNotes = (chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes) || [];
        var note = schoolWorkNotes.find(function (note) { return note.id === id; });
        saveChartData({
            schoolWorkNotes: [{ id: note.id, published: true }],
        }, {
            onSuccess: function () {
                setPartialChartData({
                    schoolWorkNotes: schoolWorkNotes.map(function (note) { return (note.id === id ? __assign(__assign({}, note), { published: true }) : note); }),
                });
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while publishing excuse. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    var schoolWorkNoteChoice = (0, parser_1.getStringAnswer)(questionnaireResponse, "".concat(utils_1.SCHOOL_WORK_NOTE, "-choice"));
    var title = '';
    switch (schoolWorkNoteChoice) {
        case 'School only':
            title = 'School';
            break;
        case 'Work only':
            title = 'Work';
            break;
        case 'Both school and work notes':
            title = 'School & Work';
            break;
        default:
            // case 'Neither'
            title = 'Neither';
            break;
    }
    var numTemplatesUploaded = +Boolean(patientSchoolPresignedUrl) + +Boolean(patientWorkPresignedUrl);
    return (<>
      <components_1.AccordionCard label="School / Work Excuse" collapsed={collapsed} onSwitch={function () { return setCollapsed(function (prevState) { return !prevState; }); }}>
        <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <material_1.Box>
            <material_1.Typography display="inline">Patient requested excuse from:</material_1.Typography>&nbsp;
            <material_1.Typography display="inline" fontWeight={500}>
              {title}
            </material_1.Typography>
          </material_1.Box>
          {numTemplatesUploaded !== 0 && (<>
              <material_1.Typography>{"Attached template".concat(numTemplatesUploaded === 2 ? 's' : '', ":")}</material_1.Typography>
              <material_1.Grid container columnSpacing={3} sx={{ position: 'relative' }}>
                {patientSchoolPresignedUrl && (<material_1.Grid item xs={6}>
                    {/* TODO extension should match extension uploaded */}
                    <components_2.ExcuseLink label={"School excuse note template".concat('.pdf')} to={patientSchoolPresignedUrl}/>
                  </material_1.Grid>)}
                {patientWorkPresignedUrl && (<material_1.Grid item xs={6}>
                    {/* TODO extension should match extension uploaded */}
                    <components_2.ExcuseLink label={"Work excuse note template".concat('.pdf')} to={patientWorkPresignedUrl}/>
                  </material_1.Grid>)}
              </material_1.Grid>
            </>)}
        </material_1.Box>

        <material_1.Divider />

        <components_1.DoubleColumnContainer leftColumn={<components_2.ExcuseCard label="School excuse" excuse={schoolExcuse} onDelete={onDelete} onPublish={onPublish} isLoading={isLoading || isReadOnly} generateTemplateOpen={setGenerateSchoolTemplateOpen} generateFreeOpen={setGenerateSchoolFreeOpen} disabled={isReadOnly}/>} rightColumn={<components_2.ExcuseCard label="Work excuse" excuse={workExcuse} onDelete={onDelete} onPublish={onPublish} isLoading={isLoading} generateTemplateOpen={setGenerateWorkTemplateOpen} generateFreeOpen={setGenerateWorkFreeOpen} disabled={isReadOnly}/>} divider padding/>
      </components_1.AccordionCard>

      {generateWorkTemplateOpen && (<components_2.GenerateExcuseDialog type="workTemplate" open={generateWorkTemplateOpen} onClose={function () { return setGenerateWorkTemplateOpen(false); }} generate={saveChartData}/>)}
      {generateWorkFreeOpen && (<components_2.GenerateExcuseDialog type="workFree" open={generateWorkFreeOpen} onClose={function () { return setGenerateWorkFreeOpen(false); }} generate={saveChartData}/>)}
      {generateSchoolTemplateOpen && (<components_2.GenerateExcuseDialog type="schoolTemplate" open={generateSchoolTemplateOpen} onClose={function () { return setGenerateSchoolTemplateOpen(false); }} generate={saveChartData}/>)}
      {generateSchoolFreeOpen && (<components_2.GenerateExcuseDialog type="schoolFree" open={generateSchoolFreeOpen} onClose={function () { return setGenerateSchoolFreeOpen(false); }} generate={saveChartData}/>)}
    </>);
};
exports.SchoolWorkExcuseCard = SchoolWorkExcuseCard;
//# sourceMappingURL=SchoolWorkExcuseCard.js.map