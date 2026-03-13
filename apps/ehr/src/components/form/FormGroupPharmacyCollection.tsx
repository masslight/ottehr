import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { PharmacyDisplay, PharmacySearch } from 'ui-components';
import {
  PHARMACY_COLLECTION_LINK_IDS,
  PharmacyCollectionAnswerSetInput,
  SearchPlacesInput,
  SearchPlacesOutput,
} from 'utils';

export const FormGroupPharmacyCollection: FC = () => {
  const { setValue, watch } = useFormContext();
  const apiClient = useOystehrAPIClient();

  const values = watch([
    PHARMACY_COLLECTION_LINK_IDS.placesName,
    PHARMACY_COLLECTION_LINK_IDS.placesAddress,
    PHARMACY_COLLECTION_LINK_IDS.placesId,
  ]);

  const [placesName, placesAddress, placesId] = values;

  const hasSelectedPlace = !!placesName && !!placesAddress && !!placesId;

  const handleSearchPlaces = async (input: SearchPlacesInput): Promise<SearchPlacesOutput> => {
    if (!apiClient) throw new Error('error searching, api client is undefined');
    return await apiClient.searchPlaces(input);
  };

  const clearPharmacyData = (): void => {
    setValue(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesAddress, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesId, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesName, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, false, { shouldDirty: true });
  };

  const handlePlacesPharmacySelection = (input: PharmacyCollectionAnswerSetInput): void => {
    setValue(PHARMACY_COLLECTION_LINK_IDS.manualPharmacyName, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.manualPharmacyAddress, undefined, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, input.erxPharmacyId, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesAddress, input.placesAddress, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesId, input.placesId, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesName, input.placesName, { shouldDirty: true });
    setValue(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, true, { shouldDirty: true });
  };

  return hasSelectedPlace ? (
    <PharmacyDisplay
      selectedPlace={{ name: placesName!, address: placesAddress!, placesId: placesId! }}
      clearPharmacyData={clearPharmacyData}
      dataTestIds={dataTestIds.patientInformationPage.pharmacySearchDisplay}
    ></PharmacyDisplay>
  ) : (
    <PharmacySearch
      handlePharmacySelection={handlePlacesPharmacySelection}
      searchPlaces={handleSearchPlaces}
      dataTestId={dataTestIds.patientInformationPage.pharmacySearch}
    ></PharmacySearch>
  );
};
