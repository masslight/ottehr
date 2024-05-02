import { IntakeFlowPageRoute } from '../App';

// Where user is redirected after logging in for a prebook or walk-in visit
export function getAuthedLandingPage(): string {
  return IntakeFlowPageRoute.WelcomeBack.path;
}
