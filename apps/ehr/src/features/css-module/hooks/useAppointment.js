"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppointment = void 0;
var react_1 = require("react");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var extractors_1 = require("../parser/extractors");
var parser_1 = require("../parser/parser");
var parsedAppointment_store_1 = require("../store/parsedAppointment.store");
var emptyResult = {
    resources: {},
    mappedData: {},
    visitState: {},
    error: null,
    isLoading: true,
    refetch: (function () {
        return;
    }),
};
var useAppointment = function (appointmentId) {
    var _a = (0, parsedAppointment_store_1.useMappedVisitDataStore)(), resources = _a.resources, mappedData = _a.mappedData;
    var visitData = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'appointment',
        'patient',
        'location',
        'locationVirtual',
        'encounter',
        'questionnaireResponse',
    ]);
    var location = visitData.location, locationVirtual = visitData.locationVirtual, patient = visitData.patient, encounter = visitData.encounter, questionnaireResponse = visitData.questionnaireResponse, appointment = visitData.appointment;
    var _b = (0, telemed_1.useGetAppointment)({ appointmentId: appointmentId }, function (data) {
        var _a, _b;
        var bundleResources = (0, extractors_1.getResources)(data);
        var parsedResources = (0, parser_1.parseBundle)(data);
        // init telemed store for compatibility
        telemed_1.useAppointmentStore.setState({
            appointment: bundleResources.appointment,
            patient: bundleResources.patient,
            location: bundleResources.location,
            locationVirtual: bundleResources.locationVirtual,
            encounter: bundleResources.encounter,
            questionnaireResponse: bundleResources.questionnaireResponse,
            // the patientPhotoUrls and schoolWorkNoteUrls structures are equal with Telemed
            patientPhotoUrls: ((_a = parsedResources.mappedData) === null || _a === void 0 ? void 0 : _a.patientConditionalPhotosUrls) || [],
            schoolWorkNoteUrls: ((_b = parsedResources.mappedData) === null || _b === void 0 ? void 0 : _b.schoolWorkNoteUrls) || [],
            isAppointmentLoading: false,
        });
    }), isLoading = _b.isLoading, error = _b.error, refetch = _b.refetch;
    // update parsed appointment store on telemed data change
    (0, react_1.useEffect)(function () {
        var visitResources = Object.values([
            appointment,
            patient,
            location,
            locationVirtual,
            encounter,
            questionnaireResponse,
        ]).filter(Boolean);
        var parsedResources = (0, parser_1.parseBundle)(visitResources);
        parsedAppointment_store_1.useMappedVisitDataStore.setState(parsedResources);
    }, [appointment, patient, location, locationVirtual, encounter, questionnaireResponse]);
    if (!visitData.encounter) {
        console.warn('Encounter is not available in the visit data. Ensure the appointment ID is provided.');
        return emptyResult;
    }
    return { resources: resources, mappedData: mappedData, visitState: visitData, error: error, isLoading: isLoading, refetch: refetch };
};
exports.useAppointment = useAppointment;
//# sourceMappingURL=useAppointment.js.map