import { invoke } from "@tauri-apps/api/core";
import type {
  DownloadSourceUsed,
  UpdateCheckResult,
  UpdateDownloadResult,
  UpdateInstallPrepareReportStatus,
  UpdateInstallResult,
  UpdateSettings,
  UpdateState,
} from "./types";

let frontendErrorLoggingInstalled = false;

function stringifyForLog(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function installFrontendErrorLogging(): void {
  if (!import.meta.env.DEV || frontendErrorLoggingInstalled || typeof window === "undefined") {
    return;
  }
  frontendErrorLoggingInstalled = true;

  window.addEventListener("error", (event) => {
    console.error("[update:frontend:error]", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[update:frontend:unhandledrejection]", event.reason);
  });
}

function logUpdateSettings(label: string, value?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (value === undefined) {
    console.log(`[update:settings:${label}]`);
    return;
  }
  console.log(`[update:settings:${label}]`, value, stringifyForLog(value));
}

installFrontendErrorLogging();

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
  logUpdateSettings("get:start");
  try {
    const settings = await invoke<UpdateSettings>("update_settings_get");
    logUpdateSettings("get:success", settings);
    return settings;
  } catch (error) {
    console.error("[update:settings:get:error]", error);
    throw error;
  }
}

export async function saveUpdateSettings(settings: UpdateSettings): Promise<UpdateSettings> {
  const payload = {
    autoCheck: Boolean(settings.autoCheck),
    autoDownload: Boolean(settings.autoDownload),
    checkIntervalHours: Number(settings.checkIntervalHours),
    checkSourcePreference: settings.checkSourcePreference,
    downloadSourcePreference: settings.downloadSourcePreference,
    channel: settings.channel,
    allowPrerelease: Boolean(settings.allowPrerelease),
    lastAutoCheckAt: settings.lastAutoCheckAt ?? null,
  };

  logUpdateSettings("save:input", settings);
  logUpdateSettings("save:payload", payload);

  try {
    const saved = await invoke<UpdateSettings>("update_settings_save", { settings: payload });
    logUpdateSettings("save:success", saved);
    return saved;
  } catch (error) {
    console.error("[update:settings:save:error]", error);
    throw error;
  }
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
