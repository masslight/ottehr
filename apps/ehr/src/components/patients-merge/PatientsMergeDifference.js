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
exports.PatientsMergeDifference = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var telemed_1 = require("../../telemed");
var RoundedButton_1 = require("../RoundedButton");
var queries_1 = require("./queries");
var mapPatientResourceToFormValues = function (patient) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46;
    var officialName = (_a = patient.name) === null || _a === void 0 ? void 0 : _a.find(function (name) { return name.use !== 'nickname'; }); // name.use === 'official'
    var preferredName = (_b = patient.name) === null || _b === void 0 ? void 0 : _b.find(function (name) { return name.use === 'nickname'; });
    var address = (_c = patient.address) === null || _c === void 0 ? void 0 : _c[0];
    var responsibleParty = (_d = patient.contact) === null || _d === void 0 ? void 0 : _d[0];
    return {
        id: patient.id,
        photo: (_f = (_e = patient.photo) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.url,
        firstName: (_g = officialName === null || officialName === void 0 ? void 0 : officialName.given) === null || _g === void 0 ? void 0 : _g[0],
        middleName: (_h = officialName === null || officialName === void 0 ? void 0 : officialName.given) === null || _h === void 0 ? void 0 : _h[1],
        lastName: officialName === null || officialName === void 0 ? void 0 : officialName.family,
        preferredName: (_j = preferredName === null || preferredName === void 0 ? void 0 : preferredName.given) === null || _j === void 0 ? void 0 : _j[0],
        birthGender: patient.gender,
        genderIdentity: (_l = (_k = patient.extension) === null || _k === void 0 ? void 0 : _k.find(function (extension) { return extension.url === 'http://hl7.org/fhir/StructureDefinition/individual-genderIdentity'; })) === null || _l === void 0 ? void 0 : _l.valueString,
        pronouns: (_o = (_m = patient.extension) === null || _m === void 0 ? void 0 : _m.find(function (extension) { return extension.url === 'http://hl7.org/fhir/StructureDefinition/individual-pronouns'; })) === null || _o === void 0 ? void 0 : _o.valueString,
        dob: patient.birthDate,
        streetLine1: (_p = address === null || address === void 0 ? void 0 : address.line) === null || _p === void 0 ? void 0 : _p[0],
        streetLine2: (_q = address === null || address === void 0 ? void 0 : address.line) === null || _q === void 0 ? void 0 : _q[1],
        city: address === null || address === void 0 ? void 0 : address.city,
        state: address === null || address === void 0 ? void 0 : address.state,
        zip: address === null || address === void 0 ? void 0 : address.postalCode,
        fillingOutAs: (_s = (_r = patient.extension) === null || _r === void 0 ? void 0 : _r.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/filling-out-as'; })) === null || _s === void 0 ? void 0 : _s.valueString,
        email: (_u = (_t = patient.telecom) === null || _t === void 0 ? void 0 : _t.find(function (telecom) { return telecom.system === 'email'; })) === null || _u === void 0 ? void 0 : _u.value,
        phone: (_w = (_v = patient.telecom) === null || _v === void 0 ? void 0 : _v.find(function (telecom) { return telecom.system === 'phone'; })) === null || _w === void 0 ? void 0 : _w.value,
        responsiblePartyFirstName: (_y = (_x = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.name) === null || _x === void 0 ? void 0 : _x.given) === null || _y === void 0 ? void 0 : _y[0],
        responsiblePartyLastName: (_z = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.name) === null || _z === void 0 ? void 0 : _z.family,
        responsiblePartyDob: (_1 = (_0 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.extension) === null || _0 === void 0 ? void 0 : _0.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/birth-date'; })) === null || _1 === void 0 ? void 0 : _1.valueString,
        responsiblePartyBirthSex: responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.gender,
        responsiblePartyPhone: (_3 = (_2 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.telecom) === null || _2 === void 0 ? void 0 : _2.find(function (telecom) { return telecom.system === 'phone' && telecom.use === 'mobile'; })) === null || _3 === void 0 ? void 0 : _3.value,
        responsiblePartyRelationship: (_7 = (_6 = (_5 = (_4 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.relationship) === null || _4 === void 0 ? void 0 : _4.find(function (relationship) {
            var _a;
            return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && coding.code === 'BP'; });
        })) === null || _5 === void 0 ? void 0 : _5.coding) === null || _6 === void 0 ? void 0 : _6.find(function (coding) { return coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && coding.code === 'BP'; })) === null || _7 === void 0 ? void 0 : _7.display,
        parentGuardianEmail: (_9 = (_8 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.telecom) === null || _8 === void 0 ? void 0 : _8.find(function (telecom) { return telecom.system === 'email'; })) === null || _9 === void 0 ? void 0 : _9.value,
        parentGuardianPhone: (_11 = (_10 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.telecom) === null || _10 === void 0 ? void 0 : _10.find(function (telecom) { return telecom.system === 'phone'; })) === null || _11 === void 0 ? void 0 : _11.value,
        parentGuardianRelationship: (_15 = (_14 = (_13 = (_12 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.relationship) === null || _12 === void 0 ? void 0 : _12.find(function (relationship) {
            var _a;
            return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) {
                return coding.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' &&
                    coding.code === 'Parent/Guardian';
            });
        })) === null || _13 === void 0 ? void 0 : _13.coding) === null || _14 === void 0 ? void 0 : _14.find(function (coding) {
            return coding.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' &&
                coding.code === 'Parent/Guardian';
        })) === null || _15 === void 0 ? void 0 : _15.display,
        ethnicity: (_20 = (_19 = (_18 = (_17 = (_16 = patient.extension) === null || _16 === void 0 ? void 0 : _16.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity'; })) === null || _17 === void 0 ? void 0 : _17.valueCodeableConcept) === null || _18 === void 0 ? void 0 : _18.coding) === null || _19 === void 0 ? void 0 : _19.find(function (coding) { return coding.system === 'http://hl7.org/fhir/v3/Ethnicity'; })) === null || _20 === void 0 ? void 0 : _20.display,
        race: (_25 = (_24 = (_23 = (_22 = (_21 = patient.extension) === null || _21 === void 0 ? void 0 : _21.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/race'; })) === null || _22 === void 0 ? void 0 : _22.valueCodeableConcept) === null || _23 === void 0 ? void 0 : _23.coding) === null || _24 === void 0 ? void 0 : _24.find(function (coding) { return coding.system === 'http://hl7.org/fhir/v3/Race'; })) === null || _25 === void 0 ? void 0 : _25.display,
        sexualOrientation: (_27 = (_26 = patient.extension) === null || _26 === void 0 ? void 0 : _26.find(function (extension) { return extension.url === 'http://hl7.org/fhir/us/cdmh/StructureDefinition/cdmh-patient-sexualOrientation'; })) === null || _27 === void 0 ? void 0 : _27.valueString,
        pcp: (_29 = (_28 = patient.contained) === null || _28 === void 0 ? void 0 : _28[0]) === null || _29 === void 0 ? void 0 : _29.id, // TODO: change to name
        pointOfDiscovery: (_31 = (_30 = patient.extension) === null || _30 === void 0 ? void 0 : _30.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery'; })) === null || _31 === void 0 ? void 0 : _31.valueString,
        sendMarketingMessages: (_33 = (_32 = patient.extension) === null || _32 === void 0 ? void 0 : _32.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/send-marketing'; })) === null || _33 === void 0 ? void 0 : _33.valueBoolean,
        hearingImpairedRelayService: (_35 = (_34 = patient.extension) === null || _34 === void 0 ? void 0 : _34.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/hearing-impaired-relay-service'; })) === null || _35 === void 0 ? void 0 : _35.valueBoolean,
        commonWellConsent: (_37 = (_36 = patient.extension) === null || _36 === void 0 ? void 0 : _36.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/common-well-consent'; })) === null || _37 === void 0 ? void 0 : _37.valueBoolean,
        language: (_42 = (_41 = (_40 = (_39 = (_38 = patient.communication) === null || _38 === void 0 ? void 0 : _38.find(function (communication) { return communication.preferred; })) === null || _39 === void 0 ? void 0 : _39.language) === null || _40 === void 0 ? void 0 : _40.coding) === null || _41 === void 0 ? void 0 : _41[0]) === null || _42 === void 0 ? void 0 : _42.display,
        active: patient.active,
        sendStatements: (_44 = (_43 = patient.extension) === null || _43 === void 0 ? void 0 : _43.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/send-statements'; })) === null || _44 === void 0 ? void 0 : _44.valueString,
        excludeFromCollections: (_46 = (_45 = patient.extension) === null || _45 === void 0 ? void 0 : _45.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/exclude-from-collections'; })) === null || _46 === void 0 ? void 0 : _46.valueBoolean,
        deceased: patient.deceasedBoolean,
    };
};
var rows = [
    {
        title: 'Photo',
        field: 'photo',
        render: function (patient) { return patient.photo || '-'; },
    },
    {
        title: 'Patient first name',
        field: 'firstName',
        render: function (patient) { return patient.firstName || '-'; },
    },
    {
        title: 'Patient middle name',
        field: 'middleName',
        render: function (patient) { return patient.middleName || '-'; },
    },
    {
        title: 'Patient last name',
        field: 'lastName',
        render: function (patient) { return patient.lastName || '-'; },
    },
    {
        title: 'Patient preferred name',
        field: 'preferredName',
        render: function (patient) { return patient.preferredName || '-'; },
    },
    {
        title: 'Birth gender',
        field: 'birthGender',
        render: function (patient) { return patient.birthGender || '-'; },
    },
    {
        title: 'Gender identity',
        field: 'genderIdentity',
        render: function (patient) { return patient.genderIdentity || '-'; },
    },
    {
        title: 'Pronouns',
        field: 'pronouns',
        render: function (patient) { return patient.pronouns || '-'; },
    },
    {
        title: 'Date of Birth',
        field: 'dob',
        render: function (patient) { return patient.dob || '-'; },
    },
    {
        title: 'Street Address',
        field: 'streetLine1',
        render: function (patient) { return patient.streetLine1 || '-'; },
    },
    {
        title: 'Street Address line 2',
        field: 'streetLine2',
        render: function (patient) { return patient.streetLine2 || '-'; },
    },
    {
        title: 'City',
        field: 'city',
        render: function (patient) { return patient.city || '-'; },
    },
    {
        title: 'State',
        field: 'state',
        render: function (patient) { return patient.state || '-'; },
    },
    {
        title: 'ZIP',
        field: 'zip',
        render: function (patient) { return patient.zip || '-'; },
    },
    {
        title: 'Filling Out Information (Self/Guardian)',
        field: 'fillingOutAs',
        render: function (patient) { return patient.fillingOutAs || '-'; },
    },
    {
        title: 'Patient Email',
        field: 'email',
        render: function (patient) { return patient.email || '-'; },
    },
    {
        title: 'Patient Mobile',
        field: 'phone',
        render: function (patient) { return patient.phone || '-'; },
    },
    {
        title: 'Responsible party first name',
        field: 'responsiblePartyFirstName',
        render: function (patient) { return patient.responsiblePartyFirstName || '-'; },
    },
    {
        title: 'Responsible party last name',
        field: 'responsiblePartyLastName',
        render: function (patient) { return patient.responsiblePartyLastName || '-'; },
    },
    {
        title: 'Responsible party Date of Birth',
        field: 'responsiblePartyDob',
        render: function (patient) { return patient.responsiblePartyDob || '-'; },
    },
    {
        title: 'Responsible party Birth sex',
        field: 'responsiblePartyBirthSex',
        render: function (patient) { return patient.responsiblePartyBirthSex || '-'; },
    },
    {
        title: 'Responsible party number',
        field: 'responsiblePartyPhone',
        render: function (patient) { return patient.responsiblePartyPhone || '-'; },
    },
    {
        title: 'Responsible party relationship',
        field: 'responsiblePartyRelationship',
        render: function (patient) { return patient.responsiblePartyRelationship || '-'; },
    },
    {
        title: 'Parent/Guardian Email',
        field: 'parentGuardianEmail',
        render: function (patient) { return patient.parentGuardianEmail || '-'; },
    },
    {
        title: 'Parent/Guardian Mobile',
        field: 'parentGuardianPhone',
        render: function (patient) { return patient.parentGuardianPhone || '-'; },
    },
    {
        title: 'Parent/Guardian relationship',
        field: 'parentGuardianRelationship',
        render: function (patient) { return patient.parentGuardianRelationship || '-'; },
    },
    {
        title: 'Ethnicity',
        field: 'ethnicity',
        render: function (patient) { return patient.ethnicity || '-'; },
    },
    {
        title: 'Race',
        field: 'race',
        render: function (patient) { return patient.race || '-'; },
    },
    {
        title: 'Sexual orientation',
        field: 'sexualOrientation',
        render: function (patient) { return patient.sexualOrientation || '-'; },
    },
    {
        title: 'Primary Care Physician',
        field: 'pcp',
        render: function (patient) { return patient.pcp || '-'; },
    },
    {
        title: "How did patient heard about ".concat(utils_1.PROJECT_NAME),
        field: 'pointOfDiscovery',
        render: function (patient) { return patient.pointOfDiscovery || '-'; },
    },
    {
        title: 'Send marketing messages',
        field: 'sendMarketingMessages',
        render: function (patient) {
            return typeof patient.sendMarketingMessages === 'boolean' ? (patient.sendMarketingMessages ? 'Yes' : 'No') : '-';
        },
    },
    {
        title: 'Hearing impaired relay service',
        field: 'hearingImpairedRelayService',
        render: function (patient) {
            return typeof patient.hearingImpairedRelayService === 'boolean'
                ? patient.hearingImpairedRelayService
                    ? 'Yes'
                    : 'No'
                : '-';
        },
    },
    {
        title: 'CommonWell consent',
        field: 'commonWellConsent',
        render: function (patient) {
            return typeof patient.commonWellConsent === 'boolean' ? (patient.commonWellConsent ? 'Yes' : 'No') : '-';
        },
    },
    {
        title: 'Language',
        field: 'language',
        render: function (patient) { return patient.language || '-'; },
    },
    {
        title: 'Active',
        field: 'active',
        render: function (patient) { return (typeof patient.active === 'boolean' ? (patient.active ? 'Yes' : 'No') : '-'); },
    },
    {
        title: 'Send statements',
        field: 'sendStatements',
        render: function (patient) { return patient.sendStatements || '-'; },
    },
    {
        title: 'Exclude from collections',
        field: 'excludeFromCollections',
        render: function (patient) {
            return typeof patient.excludeFromCollections === 'boolean' ? (patient.excludeFromCollections ? 'Yes' : 'No') : '-';
        },
    },
    {
        title: 'Deceased',
        field: 'deceased',
        render: function (patient) { return (typeof patient.deceased === 'boolean' ? (patient.deceased ? 'Yes' : 'No') : '-'); },
    },
];
var PatientsMergeDifference = function (props) {
    var open = props.open, close = props.close, back = props.back, patientIds = props.patientIds;
    var isLoading = (0, queries_1.useGetPatientsForMerge)({ patientIds: patientIds }, function (data) {
        var patients = data;
        var parsedPatients = patients.map(function (patient) { return mapPatientResourceToFormValues(patient); });
        var mainPatient = patients[0];
        setPatients(patients);
        setParsedPatients(parsedPatients);
        setParsedRows(rows.map(function (row) { return (__assign(__assign({}, row), { different: !parsedPatients.every(function (patient) { return patient[row.field] === parsedPatients[0][row.field]; }) })); }));
        setMainPatient(mainPatient === null || mainPatient === void 0 ? void 0 : mainPatient.id);
        reset(rows.reduce(function (previousValue, currentValue) {
            previousValue[currentValue.field] = mainPatient === null || mainPatient === void 0 ? void 0 : mainPatient.id;
            return previousValue;
        }, {}));
    }).isLoading;
    var _a = (0, react_1.useState)([]), patients = _a[0], setPatients = _a[1];
    var _b = (0, react_1.useState)([]), parsedPatients = _b[0], setParsedPatients = _b[1];
    var _c = (0, react_1.useState)([]), parsedRows = _c[0], setParsedRows = _c[1];
    var _d = (0, react_1.useState)(undefined), mainPatient = _d[0], setMainPatient = _d[1];
    var _e = (0, react_1.useState)('different'), showVariant = _e[0], setShowVariant = _e[1];
    var theme = (0, material_1.useTheme)();
    var methods = (0, react_hook_form_1.useForm)();
    var control = methods.control, handleSubmit = methods.handleSubmit, reset = methods.reset, getValues = methods.getValues;
    var lightBackground = "".concat(theme.palette.primary.main, "0A");
    var onSave = function (values) {
        console.log(values);
        close();
    };
    var changeMainPatient = function (id) {
        setMainPatient(id);
        reset(rows.reduce(function (previousValue, currentValue) {
            previousValue[currentValue.field] = id;
            return previousValue;
        }, {}));
    };
    var removePatient = function (id) {
        var newPatients = patients.filter(function (patient) { return patient.id !== id; });
        var newParsedPatients = newPatients.map(function (patient) { return mapPatientResourceToFormValues(patient); });
        var newMainPatient = (mainPatient === id ? newPatients[0].id : mainPatient);
        if (mainPatient === id) {
            setMainPatient(newPatients[0].id);
        }
        setPatients(newPatients);
        setParsedPatients(newParsedPatients);
        setParsedRows(rows.map(function (row) { return (__assign(__assign({}, row), { different: !newParsedPatients.every(function (patient) { return patient[row.field] === newParsedPatients[0][row.field]; }) })); }));
        var values = getValues();
        rows.forEach(function (row) {
            if (values[row.field] === id) {
                values[row.field] = newMainPatient;
            }
        });
        reset(values);
    };
    return (<react_hook_form_1.FormProvider {...methods}>
      <material_1.Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
        <material_1.IconButton size="small" onClick={close} sx={{ position: 'absolute', right: 16, top: 16 }}>
          <Close_1.default fontSize="small"/>
        </material_1.IconButton>

        <material_1.Stack spacing={2} sx={{ p: 3 }}>
          <material_1.Stack spacing={1}>
            <material_1.Typography variant="h4" color="primary.dark">
              Merge Patients
            </material_1.Typography>
            <material_1.Typography>
              Please select which information should carry over to the Main Patient record after merge. All other
              patient records will be removed.
            </material_1.Typography>
          </material_1.Stack>

          <material_1.ToggleButtonGroup size="small" exclusive value={showVariant} onChange={function (_, newValue) { return newValue && setShowVariant(newValue); }}>
            <telemed_1.ContainedPrimaryToggleButton value="different">Only Different Info</telemed_1.ContainedPrimaryToggleButton>
            <telemed_1.ContainedPrimaryToggleButton value="all">All Info</telemed_1.ContainedPrimaryToggleButton>
          </material_1.ToggleButtonGroup>

          <material_1.TableContainer sx={{ maxHeight: '60vh' }}>
            <material_1.Table size="small">
              <material_1.TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                <material_1.TableCell variant="head">Parameter</material_1.TableCell>
                {parsedPatients.map(function (patient) { return (<material_1.TableCell variant="head" key={patient.id} sx={{
                backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
            }}>
                    PID: {patient.id}
                  </material_1.TableCell>); })}
              </material_1.TableRow>
              <material_1.TableRow>
                <material_1.TableCell>Main Patient Record</material_1.TableCell>
                {parsedPatients.map(function (patient) { return (<material_1.TableCell key={patient.id} sx={{
                backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
            }}>
                    <material_1.RadioGroup row value={mainPatient} onChange={function (e) { return changeMainPatient(e.target.value); }}>
                      <material_1.FormControlLabel value={patient.id} control={<material_1.Radio />} label=""/>
                    </material_1.RadioGroup>
                  </material_1.TableCell>); })}
              </material_1.TableRow>
              {parsedRows
            .filter(function (row) { return (showVariant === 'all' ? true : row.different); })
            .map(function (row) { return (<material_1.TableRow key={row.title}>
                    <material_1.TableCell>{row.title}</material_1.TableCell>
                    {parsedPatients.map(function (patient) { return (<material_1.TableCell key={patient.id} sx={{
                    backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
                }}>
                        <react_hook_form_1.Controller render={function (_a) {
                    var _b = _a.field, onChange = _b.onChange, value = _b.value;
                    return (<material_1.RadioGroup row value={value} onChange={onChange}>
                              <material_1.FormControlLabel value={patient.id} control={<material_1.Radio />} label={row.render(patient)}/>
                            </material_1.RadioGroup>);
                }} name={row.field} control={control}/>
                      </material_1.TableCell>); })}
                  </material_1.TableRow>); })}
              <material_1.TableRow>
                <material_1.TableCell>Remove from merge</material_1.TableCell>
                {parsedPatients.map(function (patient) { return (<material_1.TableCell key={patient.id} sx={{
                backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
            }}>
                    <RoundedButton_1.RoundedButton disabled={patients.length < 3} variant="text" color="error" onClick={function () { return removePatient(patient.id); }}>
                      Remove
                    </RoundedButton_1.RoundedButton>
                  </material_1.TableCell>); })}
              </material_1.TableRow>
            </material_1.Table>
          </material_1.TableContainer>

          <material_1.Stack direction="row" spacing={2} justifyContent="space-between">
            <RoundedButton_1.RoundedButton onClick={back}>Cancel</RoundedButton_1.RoundedButton>
            <telemed_1.ConfirmationDialog title="Merge Patients" description={<material_1.Stack spacing={2}>
                  <material_1.Typography>
                    Are you sure you want to merge patient records? Merged records will be deactivated.
                  </material_1.Typography>
                  <material_1.Stack>
                    <material_1.Typography fontWeight={600}>Merged patient record PIDs:</material_1.Typography>
                    {patients
                .filter(function (patient) { return patient.id !== mainPatient; })
                .map(function (patient) { return (<material_1.Typography key={patient.id}>{patient.id}</material_1.Typography>); })}
                  </material_1.Stack>
                  <material_1.Stack>
                    <material_1.Typography fontWeight={600}>Main patient record PID:</material_1.Typography>
                    <material_1.Typography>{mainPatient}</material_1.Typography>
                  </material_1.Stack>
                </material_1.Stack>} response={handleSubmit(onSave)} actionButtons={{
            proceed: {
                text: 'Confirm Merge',
            },
            back: {
                text: 'Back',
            },
            reverse: true,
        }}>
              {function (showDialog) { return (<RoundedButton_1.RoundedButton variant="contained" onClick={showDialog} disabled={isLoading}>
                  Merge Patients
                </RoundedButton_1.RoundedButton>); }}
            </telemed_1.ConfirmationDialog>
          </material_1.Stack>
        </material_1.Stack>
      </material_1.Dialog>
    </react_hook_form_1.FormProvider>);
};
exports.PatientsMergeDifference = PatientsMergeDifference;
//# sourceMappingURL=PatientsMergeDifference.js.map