export function registerPanelRefreshBuilder() {}

export function registerPanelRefresh(key) {
  return key;
}

export function unregisterPanelRefresh() {}

export async function refreshAllPanels() {
  return 0;
}

export async function refreshPanelsForMember() {
  return 0;
}

export async function rehydratePanelRefreshes() {}

export function startPanelRefreshScheduler() {}

export default {
  registerPanelRefresh,
  registerPanelRefreshBuilder,
  unregisterPanelRefresh,
  refreshAllPanels,
  refreshPanelsForMember,
  rehydratePanelRefreshes,
  startPanelRefreshScheduler
};
