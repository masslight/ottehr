"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useResetAppointmentStore = void 0;
var react_1 = require("react");
var state_1 = require("../state");
var exam_cards_store_1 = require("../state/appointment/exam-cards.store");
var useResetAppointmentStore = function () {
    (0, react_1.useEffect)(function () {
        state_1.useAppointmentStore.setState({
            appointment: undefined,
            patient: undefined,
            location: undefined,
            locationVirtual: undefined,
            encounter: {},
            questionnaireResponse: undefined,
            patientPhotoUrls: [],
            schoolWorkNoteUrls: [],
            chartData: undefined,
            currentTab: 'hpi',
        });
        state_1.useExamObservationsStore.setState(state_1.EXAM_OBSERVATIONS_INITIAL);
        state_1.useInPersonExamObservationsStore.setState(state_1.IN_PERSON_EXAM_OBSERVATIONS_INITIAL);
        state_1.useVideoCallStore.setState({ meetingData: null });
        exam_cards_store_1.useExamCardsStore.setState(exam_cards_store_1.EXAM_CARDS_INITIAL);
        exam_cards_store_1.useInPersonExamCardsStore.setState(exam_cards_store_1.IN_PERSON_EXAM_CARDS_INITIAL);
        return function () { return state_1.useAppointmentStore.setState({ patientPhotoUrls: [] }); };
    }, []);
};
exports.useResetAppointmentStore = useResetAppointmentStore;
//# sourceMappingURL=useResetAppointmentStore.js.map