"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispositionCard = void 0;
var ErrorOutline_1 = require("@mui/icons-material/ErrorOutline");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useChartData_1 = require("../../../../features/css-module/hooks/useChartData");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var useDispositionMultipleNotes_1 = require("./useDispositionMultipleNotes");
var ERROR_TEXT = 'Disposition data update was unsuccessful, please change some disposition field data to try again.';
var DispositionCard = function () {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter', 'setPartialChartData']), encounter = _b.encounter, setPartialChartData = _b.setPartialChartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var isResetting = (0, react_1.useRef)(false);
    var latestRequestId = (0, react_1.useRef)(0);
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: utils_2.DEFAULT_DISPOSITION_VALUES,
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, watch = methods.watch, getValues = methods.getValues, setValue = methods.setValue, reset = methods.reset, isDirty = methods.formState.isDirty;
    var _c = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: { disposition: {} },
        onSuccess: function (data) {
            var _a, _b;
            setPartialChartData({ disposition: data === null || data === void 0 ? void 0 : data.disposition });
            isResetting.current = true;
            reset((data === null || data === void 0 ? void 0 : data.disposition) ? (0, utils_2.mapDispositionToForm)(data.disposition) : utils_2.DEFAULT_DISPOSITION_VALUES);
            setCurrentType(((_a = data === null || data === void 0 ? void 0 : data.disposition) === null || _a === void 0 ? void 0 : _a.type) || utils_2.DEFAULT_DISPOSITION_VALUES.type);
            if ((_b = data === null || data === void 0 ? void 0 : data.disposition) === null || _b === void 0 ? void 0 : _b.note) {
                setNoteCache(data.disposition.note);
            }
            isResetting.current = false;
        },
    }), chartData = _c.chartData, isChartDataLoading = _c.isFetching;
    var _d = (0, useDispositionMultipleNotes_1.useDispositionMultipleNotes)({ methods: methods, savedDisposition: chartData === null || chartData === void 0 ? void 0 : chartData.disposition }), setNoteCache = _d.setNoteCache, withNote = _d.withNote;
    var labServiceValue = (0, react_hook_form_1.useWatch)({ control: methods.control, name: 'labService' });
    var showVirusTest = (_a = labServiceValue === null || labServiceValue === void 0 ? void 0 : labServiceValue.includes) === null || _a === void 0 ? void 0 : _a.call(labServiceValue, utils_2.SEND_OUT_VIRUS_TEST_LABEL);
    var debounce = (0, hooks_1.useDebounce)(1500).debounce;
    var _f = (0, state_1.useSaveChartData)(), mutate = _f.mutate, isLoading = _f.isLoading;
    var _g = (0, react_1.useState)(getValues('type')), currentType = _g[0], setCurrentType = _g[1];
    var _h = (0, react_1.useState)(false), isError = _h[0], setIsError = _h[1];
    var onSubmit = (0, react_1.useCallback)(function (values) {
        setIsError(false);
        var requestId = ++latestRequestId.current;
        debounce(function () {
            mutate({ disposition: withNote(values) }, {
                onSuccess: function (data) {
                    var _a;
                    if (requestId === latestRequestId.current) {
                        var disposition = (_a = data.chartData) === null || _a === void 0 ? void 0 : _a.disposition;
                        if (disposition) {
                            setPartialChartData({ disposition: disposition });
                            isResetting.current = true;
                            reset((0, utils_2.mapDispositionToForm)(disposition));
                            isResetting.current = false;
                        }
                    }
                },
                onError: function () {
                    if (requestId === latestRequestId.current) {
                        (0, notistack_1.enqueueSnackbar)(ERROR_TEXT, {
                            variant: 'error',
                        });
                        setIsError(true);
                    }
                },
            });
        });
    }, [debounce, mutate, setPartialChartData, withNote, reset]);
    (0, react_1.useEffect)(function () {
        var subscription = watch(function (data, _a) {
            var type = _a.type;
            if (!isResetting.current && type === 'change') {
                void handleSubmit(onSubmit)();
            }
        });
        return function () { return subscription.unsubscribe(); };
    }, [handleSubmit, onSubmit, watch]);
    var fields = utils_2.dispositionFieldsPerType[currentType];
    var tabs = ['pcp-no-type', 'another', 'ed', 'specialty'];
    if (isChartDataLoading || !(chartData === null || chartData === void 0 ? void 0 : chartData.disposition)) {
        return (<components_1.AccordionCard label="Disposition">
        <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <material_1.Skeleton variant="rounded" height={36}/>
          <material_1.Skeleton variant="rounded" height={36}/>
          <material_1.Skeleton variant="rounded" height={36}/>
        </material_1.Box>
      </components_1.AccordionCard>);
    }
    return (<components_1.AccordionCard label="Disposition" headerItem={isLoading || isDirty ? (<material_1.CircularProgress size="20px"/>) : isError ? (<material_1.Tooltip title={ERROR_TEXT}>
            <ErrorOutline_1.default color="error"/>
          </material_1.Tooltip>) : undefined}>
      <react_hook_form_1.FormProvider {...methods}>
        <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionContainer}>
          <react_hook_form_1.Controller name="type" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.ToggleButtonGroup size="small" fullWidth exclusive disabled={isReadOnly} value={value} onChange={function (_, newValue) {
                    if (newValue) {
                        setCurrentType(newValue);
                        onChange(newValue);
                    }
                }}>
                {tabs.map(function (tab) { return (<components_1.ContainedPrimaryToggleButton key={tab} value={tab} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionToggleButton(tab)}>
                    {utils_1.mapDispositionTypeToLabel[tab]}
                  </components_1.ContainedPrimaryToggleButton>); })}
              </material_1.ToggleButtonGroup>);
        }}/>

          {fields.includes('labService') && (<material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                '& .MuiAutocomplete-root': {
                    maxWidth: '50%',
                },
            }}>
              <react_hook_form_1.Controller name="labService" control={control} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.Autocomplete fullWidth multiple disabled={isReadOnly} options={utils_2.labServiceOptions.map(function (option) { return option.label; })} renderInput={function (params) { return (<material_1.TextField {...params} size="small" label="Lab services" placeholder="Type or select"/>); }} onChange={function (_e, data) {
                        onChange(data);
                        var selectedNotes = data
                            .map(function (selectedLabel) { var _a; return (_a = utils_2.labServiceOptions.find(function (option) { return option.label === selectedLabel; })) === null || _a === void 0 ? void 0 : _a.note; })
                            .filter(Boolean);
                        var noteText = (0, utils_1.getDefaultNote)('ip-lab');
                        if (selectedNotes.length > 0) {
                            noteText += '\n\n' + selectedNotes.join('\n\n');
                        }
                        setValue('note', noteText);
                        setNoteCache(noteText);
                        // clear value of virusTest, if SEND_OUT_VIRUS_TEST_LABEL is not selected
                        if (!data.includes(utils_2.SEND_OUT_VIRUS_TEST_LABEL)) {
                            setValue('virusTest', []);
                        }
                    }} value={Array.isArray(value) ? value : []}/>);
            }}/>

              {showVirusTest && (<react_hook_form_1.Controller name="virusTest" control={control} render={function (_a) {
                    var _b = _a.field, onChange = _b.onChange, value = _b.value;
                    return (<material_1.Autocomplete fullWidth multiple disabled={isReadOnly} options={utils_2.virusTestsOptions} renderInput={function (params) { return (<material_1.TextField {...params} size="small" label="Virus tests" placeholder="Type or select"/>); }} onChange={function (_e, data) { return onChange(data); }} value={Array.isArray(value) ? value : []}/>);
                }}/>)}
            </material_1.Box>)}

          {fields.includes('followUpIn') && (<react_hook_form_1.Controller name="followUpIn" control={control} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.TextField select disabled={isReadOnly} label="Follow up visit in" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown} size="small" sx={{ minWidth: '200px', width: 'fit-content' }} value={value} onChange={onChange}>
                  <material_1.MenuItem value={''}>
                    <em>None</em>
                  </material_1.MenuItem>
                  {utils_2.followUpInOptions.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </material_1.MenuItem>); })}
                </material_1.TextField>);
            }}/>)}

          {fields.includes('reason') && (<react_hook_form_1.Controller name="reason" control={control} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.TextField select disabled={isReadOnly} label="Reason for transfer" placeholder="Select" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown} size="small" sx={{ minWidth: '200px', width: '50%' }} value={value} onChange={onChange}>
                  <material_1.MenuItem value={''}>
                    <em>None</em>
                  </material_1.MenuItem>
                  {utils_2.reasonsForTransferOptions.map(function (option) { return (<material_1.MenuItem key={option} value={option}>
                      {option}
                    </material_1.MenuItem>); })}
                </material_1.TextField>);
            }}/>)}

          {isReadOnly ? (getValues('note') ? (<material_1.Typography>{getValues('note')}</material_1.Typography>) : (<material_1.Typography color="secondary.light">Note not provided</material_1.Typography>)) : (<react_hook_form_1.Controller name="note" control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.TextField label="Note" multiline fullWidth size="small" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote} value={value} onChange={function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        setNoteCache(args[0].target.value);
                        onChange.apply(void 0, args);
                    }}/>);
            }}/>)}

          {fields.includes(utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD) && (<material_1.FormControlLabel label={utils_1.NOTHING_TO_EAT_OR_DRINK_LABEL} control={<react_hook_form_1.Controller name={utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD} control={control} render={function (_a) {
                    var _b = _a.field, value = _b.value, onChange = _b.onChange;
                    return (<material_1.Checkbox name={utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD} disabled={isReadOnly} checked={value} onChange={onChange}/>);
                }}/>}/>)}

          {fields.includes('bookVisit') && (<RoundedButton_1.RoundedButton disabled={isReadOnly} to="/visits/add" target="_blank" variant="contained">
              Book a visit
            </RoundedButton_1.RoundedButton>)}

          {fields.includes('followUpType') && (<>
              <material_1.Divider />

              <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <components_1.UppercaseCaptionTypography>Subspecialty Follow Up (optional)</components_1.UppercaseCaptionTypography>

                <material_1.Box sx={{ display: 'flex', gap: 3 }}>
                  {utils_1.dispositionCheckboxOptions.map(function (option) { return (<react_1.default.Fragment key={option.name}>
                      {option.name !== 'other' && (<material_1.FormControlLabel control={<react_hook_form_1.Controller name={option.name} control={control} render={function (_a) {
                            var field = _a.field;
                            return (<material_1.Checkbox {...field} disabled={isReadOnly} checked={field.value} onChange={function (e) {
                                    var newValue = e.target.checked;
                                    field.onChange(newValue);
                                }}/>);
                        }}/>} label={option.label}/>)}

                      {option.name === 'other' && (<material_1.Box display="flex" alignItems="center" gap={1}>
                          <material_1.Typography component="label" htmlFor="other-input">
                            Other
                          </material_1.Typography>
                          <react_hook_form_1.Controller name="otherNote" control={control} render={function (_a) {
                        var _b = _a.field, value = _b.value, onChange = _b.onChange;
                        return (<material_1.TextField disabled={isReadOnly} label="Please specify" size="small" value={value} onChange={onChange}/>);
                    }}/>
                        </material_1.Box>)}
                    </react_1.default.Fragment>); })}
                </material_1.Box>
              </material_1.Box>
            </>)}
        </material_1.Box>
      </react_hook_form_1.FormProvider>
    </components_1.AccordionCard>);
};
exports.DispositionCard = DispositionCard;
//# sourceMappingURL=DispositionCard.js.map