import { invoke } from "@tauri-apps/api/core";
import type { ForegroundAppInfo } from "../settings/types";

export interface QuickNoteRules {
  suppressQuickNoteInFullscreen: boolean;
  appBlacklist: string[];
  appWhitelist: string[];
}

export function getQuickNoteRules(): Promise<QuickNoteRules> {
  return invoke("quick_note_rules_get");
}

export function saveQuickNoteRules(rules: QuickNoteRules): Promise<QuickNoteRules> {
  return invoke("quick_note_rules_save", { rules });
}

export function getForegroundAppInfo(): Promise<ForegroundAppInfo | null> {
  return invoke("foreground_app_info_get");
}

export function addAppToWhitelist(rules: QuickNoteRules, exeName: string): QuickNoteRules {
  const normalized = normalizeExeName(exeName);
  if (!normalized) {
    return rules;
  }

  return {
    ...rules,
    appBlacklist: removeApp(rules.appBlacklist, normalized),
    appWhitelist: addApp(rules.appWhitelist, normalized),
  };
}

export function addAppToBlacklist(rules: QuickNoteRules, exeName: string): QuickNoteRules {
  const normalized = normalizeExeName(exeName);
  if (!normalized) {
    return rules;
  }

  return {
    ...rules,
    appBlacklist: addApp(rules.appBlacklist, normalized),
    appWhitelist: removeApp(rules.appWhitelist, normalized),
  };
}

export function removeAppFromRules(rules: QuickNoteRules, exeName: string): QuickNoteRules {
  const normalized = normalizeExeName(exeName);
  if (!normalized) {
    return rules;
  }

  return {
    ...rules,
    appBlacklist: removeApp(rules.appBlacklist, normalized),
    appWhitelist: removeApp(rules.appWhitelist, normalized),
  };
}

function addApp(list: string[], exeName: string): string[] {
  if (list.some((item) => item.toLowerCase() === exeName)) {
    return list;
  }
  return [...list, exeName];
}

function removeApp(list: string[], exeName: string): string[] {
  return list.filter((item) => item.toLowerCase() !== exeName);
}

function normalizeExeName(value: string): string | null {
  const normalized = value.trim().split(/[\\/]/).pop()?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}
