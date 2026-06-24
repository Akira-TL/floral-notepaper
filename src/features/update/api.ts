import { invoke } from "@tauri-apps/api/core";
import type {
  DownloadSourceUsed,
  UpdateChannel,
  UpdateCheckResult,
  UpdateDownloadResult,
  UpdateInstallPrepareReportStatus,
  UpdateInstallResult,
  UpdateSettings,
  UpdateState,
} from "./types";

const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoCheck: true,
  autoDownload: false,
  checkIntervalHours: 24,
  checkSourcePreference: "mirrorChyanFirst",
  downloadSourcePreference: "mirrorChyanFirst",
  channel: "stable",
  allowPrerelease: false,
  lastAutoCheckAt: null,
  hasMirrorChyanCdk: false,
  mirrorChyanCdkLength: null,
};

function isUpdateChannel(value: unknown): value is UpdateChannel {
  return value === "stable" || value === "beta";
}

function isSourcePreference(value: unknown): value is "mirrorChyanFirst" | "githubFirst" {
  return value === "mirrorChyanFirst" || value === "githubFirst";
}

function normalizeUpdateSettings(
  value: Partial<UpdateSettings> | null | undefined,
): UpdateSettings {
  const interval = Number(value?.checkIntervalHours ?? DEFAULT_UPDATE_SETTINGS.checkIntervalHours);

  return {
    autoCheck: Boolean(value?.autoCheck ?? DEFAULT_UPDATE_SETTINGS.autoCheck),
    autoDownload: Boolean(value?.autoDownload ?? DEFAULT_UPDATE_SETTINGS.autoDownload),
    checkIntervalHours: Number.isFinite(interval) && interval > 0 ? interval : 24,
    checkSourcePreference: isSourcePreference(value?.checkSourcePreference)
      ? value.checkSourcePreference
      : DEFAULT_UPDATE_SETTINGS.checkSourcePreference,
    downloadSourcePreference: isSourcePreference(value?.downloadSourcePreference)
      ? value.downloadSourcePreference
      : isSourcePreference(value?.checkSourcePreference)
        ? value.checkSourcePreference
        : DEFAULT_UPDATE_SETTINGS.downloadSourcePreference,
    channel: isUpdateChannel(value?.channel) ? value.channel : DEFAULT_UPDATE_SETTINGS.channel,
    allowPrerelease: Boolean(value?.allowPrerelease ?? DEFAULT_UPDATE_SETTINGS.allowPrerelease),
    lastAutoCheckAt: value?.lastAutoCheckAt ?? null,
    hasMirrorChyanCdk: Boolean(value?.hasMirrorChyanCdk),
    mirrorChyanCdkLength: value?.mirrorChyanCdkLength ?? null,
  };
}

export function checkForUpdates(manual: boolean): Promise<UpdateCheckResult> {
  return invoke("update_check", { manual });
}

export function downloadUpdate(source?: DownloadSourceUsed): Promise<UpdateDownloadResult> {
  return invoke("update_download", { source });
}

export function installUpdate(): Promise<UpdateInstallResult> {
  return invoke("update_install");
}

export function reportInstallPreparation(
  requestId: string,
  windowLabel: string,
  status: UpdateInstallPrepareReportStatus,
  message?: string,
): Promise<void> {
  return invoke("update_install_prepare_report", {
    requestId,
    windowLabel,
    status,
    message,
  });
}

export function cancelUpdate(): Promise<void> {
  return invoke("update_cancel");
}

export function getUpdateStatus(): Promise<UpdateState> {
  return invoke("update_status");
}

export async function getUpdateSettings(): Promise<UpdateSettings> {
  return normalizeUpdateSettings(await invoke<UpdateSettings>("update_settings_get"));
}

export async function saveUpdateSettings(settings: UpdateSettings): Promise<UpdateSettings> {
  const normalizedSettings = normalizeUpdateSettings(settings);
  const payload = {
    autoCheck: normalizedSettings.autoCheck,
    autoDownload: normalizedSettings.autoDownload,
    checkIntervalHours: normalizedSettings.checkIntervalHours,
    checkSourcePreference: normalizedSettings.checkSourcePreference,
    downloadSourcePreference: normalizedSettings.downloadSourcePreference,
    channel: normalizedSettings.channel,
    allowPrerelease: normalizedSettings.allowPrerelease,
    lastAutoCheckAt: normalizedSettings.lastAutoCheckAt ?? null,
  };

  return normalizeUpdateSettings(
    await invoke<UpdateSettings>("update_settings_save", { settings: payload }),
  );
}

export function setMirrorChyanCdk(cdk: string): Promise<void> {
  return invoke("update_mirror_chyan_cdk_set", { cdk });
}

export function getMirrorChyanCdk(): Promise<string | null> {
  return invoke("update_mirror_chyan_cdk_get");
}

export function clearMirrorChyanCdk(): Promise<void> {
  return invoke("update_mirror_chyan_cdk_clear");
}
