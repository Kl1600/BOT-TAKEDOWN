export function registerPanelRefreshBuilder() {}

export async function registerPanelRefresh(record) {
  return record?.key || null;
}

export async function unregisterPanelRefresh() {}

export async function refreshAllPanels() {
  return 0;
}

export async function refreshPanelsForMember() {
  return 0;
}

export async function rehydratePanelRefreshes() {
  return 0;
}

export function startPanelRefreshScheduler() {}

export function stopPanelRefreshScheduler() {}

export default {
  registerPanelRefresh,
  registerPanelRefreshBuilder,
  unregisterPanelRefresh,
  refreshAllPanels,
  refreshPanelsForMember,
  rehydratePanelRefreshes,
  startPanelRefreshScheduler,
  stopPanelRefreshScheduler
};
