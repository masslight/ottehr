import { useAuth0 } from '@auth0/auth0-react';
import mixpanel from 'mixpanel-browser';
import React, { useCallback } from 'react';
import { ContainerProps, CustomContainer } from 'ui-components';
import { ottehrLogo as logo } from '../theme/ottehr';
import { useClearStores } from '../features';
import { useIntakeCommonStore } from '../features/common';
import Footer from './Footer';
import { PROJECT_NAME, PROJECT_WEBSITE } from '../helpers/constants';

type PageContainerProps = Omit<ContainerProps, 'logo' | 'showLanguagePicker' | 'footer' | 'logoutHandler' | 'alt'>;

export const PageContainer: React.FC<PageContainerProps> = (props) => {
  const lastUsedLocationPath = useIntakeCommonStore((state) => state.lastUsedLocationPath);
  const { logout } = useAuth0();

  const clearStore = useClearStores();

  const logoutHandler = useCallback(async () => {
    clearStore(lastUsedLocationPath);
    mixpanel.reset();
    // for some reason this is necessary to get auth0 to clear out its local state
    void logout({ logoutParams: { returnTo: PROJECT_WEBSITE } });
    void logout({ logoutParams: { localOnly: true } });
  }, [clearStore, lastUsedLocationPath, logout]);
  const passThroughProps = {
    ...props,
    logoutHandler,
    footer: <Footer />,
    logo,
    alt: `${PROJECT_NAME} In Person`,
  };
  return <CustomContainer showLanguagePicker={true} {...passThroughProps} />;
};
