import { ComponentType, ReactElement, ReactNode } from 'react';

const auth = {
  isAuthenticated: true,
  isLoading: false,
  error: undefined,
  user: { sub: 'auth0|mock-user', name: 'Gallery User', email: 'gallery.user@example.com' },
  getAccessTokenSilently: async (): Promise<string> => 'mock-token',
  getIdTokenClaims: async (): Promise<Record<string, unknown>> => ({}),
  loginWithRedirect: async (): Promise<void> => undefined,
  loginWithPopup: async (): Promise<void> => undefined,
  logout: async (): Promise<void> => undefined,
};

export const useAuth0 = (): typeof auth => auth;
export const Auth0Provider = ({ children }: { children: ReactNode }): ReactElement => <>{children}</>;
export const withAuthenticationRequired = <P extends object>(component: ComponentType<P>): ComponentType<P> =>
  component;
