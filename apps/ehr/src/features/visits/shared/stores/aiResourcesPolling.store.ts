import { create } from 'zustand';

interface AiResourcesPollingState {
  isPolling: boolean;
  hasPendingAiSource: boolean;
  pollingExhausted: boolean;
}

// Written by the single, persistently-mounted useAiResourcesPolling instance in InPersonLayout (alive for
// the whole visit, not just one tab), so OttehrAi can read polling status without running its own
// competing poll loop.
export const useAiResourcesPollingStore = create<AiResourcesPollingState>()(() => ({
  isPolling: false,
  hasPendingAiSource: false,
  pollingExhausted: false,
}));
