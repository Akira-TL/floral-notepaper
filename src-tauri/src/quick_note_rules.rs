use crate::{
    desktop::{self, ShortcutKey, ShortcutSpec},
    services::notes::{default_store, AppConfig, AppError},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[cfg(desktop)]
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg(desktop)]
const SHORTCUT_GUARD_INTERVAL_MS: u64 = 250;
#[cfg(desktop)]
static SHORTCUT_GUARD_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuickNoteRules {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub suppress_quick_note_in_fullscreen: bool,
    #[serde(default)]
    pub app_blacklist: Vec<String>,
    #[serde(default)]
    pub app_whitelist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundAppInfo {
    pub exe_name: String,
    pub exe_path: String,
    pub window_title: String,
    pub is_fullscreen: bool,
}

impl Default for QuickNoteRules {
    fn default() -> Self {
        Self {
            enabled: false,
            suppress_quick_note_in_fullscreen: false,
            app_blacklist: Vec::new(),
            app_whitelist: Vec::new(),
        }
    }
}

impl QuickNoteRules {
    fn from_config(config: &AppConfig) -> Self {
        normalize_rules(Self {
            enabled: config.quick_note_rules_enabled,
            suppress_quick_note_in_fullscreen: config.suppress_quick_note_in_fullscreen,
            app_blacklist: config.quick_note_app_blacklist.clone(),
            app_whitelist: config.quick_note_app_whitelist.clone(),
        })
    }

    fn apply_to_config(&self, config: &mut AppConfig) {
        let rules = normalize_rules(self.clone());
        config.quick_note_rules_enabled = rules.enabled;
        config.suppress_quick_note_in_fullscreen = rules.suppress_quick_note_in_fullscreen;
        config.quick_note_app_blacklist = rules.app_blacklist;
        config.quick_note_app_whitelist = rules.app_whitelist;
    }
}

pub fn load_rules() -> Result<QuickNoteRules, AppError> {
    let config = default_store()?.load_config()?;
    Ok(QuickNoteRules::from_config(&config))
}

pub fn save_rules(rules: QuickNoteRules) -> Result<QuickNoteRules, AppError> {
    let store = default_store()?;
    let mut config = store.load_config()?;
    let rules = normalize_rules(rules);
    rules.apply_to_config(&mut config);
    store.save_config(config)?;
    Ok(rules)
}

pub fn current_foreground_app_info() -> Result<Option<ForegroundAppInfo>, AppError> {
    Ok(platform::foreground_app_info())
}

pub fn should_suppress_quick_note() -> bool {
    let Ok(rules) = load_rules() else {
        return false;
    };
    should_suppress_quick_note_for_rules(&rules)
}

fn should_suppress_quick_note_for_rules(rules: &QuickNoteRules) -> bool {
    if !rules.enabled {
        return false;
    }

    let Some(app) = platform::foreground_app_info() else {
        return false;
    };

    let exe_name = app.exe_name.to_ascii_lowercase();
    if exe_name.is_empty() {
        return false;
    }

    if contains_app(&rules.app_blacklist, &exe_name) {
        return true;
    }

    if contains_app(&rules.app_whitelist, &exe_name) {
        return false;
    }

    rules.suppress_quick_note_in_fullscreen && app.is_fullscreen
}

#[cfg(desktop)]
pub fn start_shortcut_guard(app: tauri::AppHandle) {
    if SHORTCUT_GUARD_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(move || loop {
        apply_shortcut_guard(&app);
        thread::sleep(Duration::from_millis(SHORTCUT_GUARD_INTERVAL_MS));
    });
}

#[cfg(not(desktop))]
pub fn start_shortcut_guard(_app: tauri::AppHandle) {}

#[cfg(desktop)]
fn apply_shortcut_guard(app: &tauri::AppHandle) {
    let Ok(config) = default_store().and_then(|store| store.load_config()) else {
        return;
    };

    let shortcut_config = config.global_shortcut.trim();
    if shortcut_config.is_empty() {
        return;
    }

    let Some(shortcut) = desktop::shortcut_from_config(shortcut_config).and_then(to_tauri_shortcut)
    else {
        return;
    };

    let manager = app.global_shortcut();
    let rules = QuickNoteRules::from_config(&config);
    let should_suppress = should_suppress_quick_note_for_rules(&rules);
    let registered = manager.is_registered(shortcut);

    if should_suppress {
        if registered {
            if let Err(error) = manager.unregister(shortcut) {
                eprintln!("failed to suppress quick note shortcut {shortcut_config}: {error}");
            }
        }
        return;
    }

    if !registered {
        if let Err(error) = manager.register(shortcut) {
            eprintln!("failed to restore quick note shortcut {shortcut_config}: {error}");
        }
    }
}

#[cfg(desktop)]
fn to_tauri_shortcut(spec: ShortcutSpec) -> Option<Shortcut> {
    let mut modifiers = Modifiers::empty();
    if spec.ctrl {
        modifiers |= Modifiers::CONTROL;
    }
    if spec.alt {
        modifiers |= Modifiers::ALT;
    }
    if spec.shift {
        modifiers |= Modifiers::SHIFT;
    }
    if spec.meta {
        modifiers |= Modifiers::META;
    }

    let code = shortcut_key_to_code(spec.key)?;
    let mod_opt = if modifiers.is_empty() {
        None
    } else {
        Some(modifiers)
    };
    Some(Shortcut::new(mod_opt, code))
}

#[cfg(desktop)]
fn shortcut_key_to_code(key: ShortcutKey) -> Option<Code> {
    Some(match key {
        ShortcutKey::Letter(c) => match c {
            'A' => Code::KeyA,
            'B' => Code::KeyB,
            'C' => Code::KeyC,
            'D' => Code::KeyD,
            'E' => Code::KeyE,
            'F' => Code::KeyF,
            'G' => Code::KeyG,
            'H' => Code::KeyH,
            'I' => Code::KeyI,
            'J' => Code::KeyJ,
            'K' => Code::KeyK,
            'L' => Code::KeyL,
            'M' => Code::KeyM,
            'N' => Code::KeyN,
            'O' => Code::KeyO,
            'P' => Code::KeyP,
            'Q' => Code::KeyQ,
            'R' => Code::KeyR,
            'S' => Code::KeyS,
            'T' => Code::KeyT,
            'U' => Code::KeyU,
            'V' => Code::KeyV,
            'W' => Code::KeyW,
            'X' => Code::KeyX,
            'Y' => Code::KeyY,
            'Z' => Code::KeyZ,
            _ => return None,
        },
        ShortcutKey::Digit(d) => match d {
            0 => Code::Digit0,
            1 => Code::Digit1,
            2 => Code::Digit2,
            3 => Code::Digit3,
            4 => Code::Digit4,
            5 => Code::Digit5,
            6 => Code::Digit6,
            7 => Code::Digit7,
            8 => Code::Digit8,
            9 => Code::Digit9,
            _ => return None,
        },
        ShortcutKey::Function(n) => match n {
            1 => Code::F1,
            2 => Code::F2,
            3 => Code::F3,
            4 => Code::F4,
            5 => Code::F5,
            6 => Code::F6,
            7 => Code::F7,
            8 => Code::F8,
            9 => Code::F9,
            10 => Code::F10,
            11 => Code::F11,
            12 => Code::F12,
            _ => return None,
        },
        ShortcutKey::Punctuation(c) => match c {
            '[' => Code::BracketLeft,
            ']' => Code::BracketRight,
            ';' => Code::Semicolon,
            '\'' => Code::Quote,
            '`' => Code::Backquote,
            ',' => Code::Comma,
            '.' => Code::Period,
            '/' => Code::Slash,
            '\\' => Code::Backslash,
            '-' => Code::Minus,
            '=' => Code::Equal,
            _ => return None,
        },
        ShortcutKey::Space => Code::Space,
        ShortcutKey::Tab => Code::Tab,
        ShortcutKey::Enter => Code::Enter,
        ShortcutKey::Backspace => Code::Backspace,
        ShortcutKey::Delete => Code::Delete,
        ShortcutKey::Escape => Code::Escape,
        ShortcutKey::ArrowUp => Code::ArrowUp,
        ShortcutKey::ArrowDown => Code::ArrowDown,
        ShortcutKey::ArrowLeft => Code::ArrowLeft,
        ShortcutKey::ArrowRight => Code::ArrowRight,
        ShortcutKey::Home => Code::Home,
        ShortcutKey::End => Code::End,
        ShortcutKey::PageUp => Code::PageUp,
        ShortcutKey::PageDown => Code::PageDown,
    })
}

fn contains_app(list: &[String], exe_name: &str) -> bool {
    list.iter().any(|item| item.eq_ignore_ascii_case(exe_name))
}

fn normalize_rules(mut rules: QuickNoteRules) -> QuickNoteRules {
    rules.app_blacklist = normalize_app_list(rules.app_blacklist);
    let blacklist: BTreeSet<_> = rules
        .app_blacklist
        .iter()
        .map(|item| item.to_ascii_lowercase())
        .collect();
    rules.app_whitelist = normalize_app_list(rules.app_whitelist)
        .into_iter()
        .filter(|item| !blacklist.contains(item))
        .collect();
    rules
}

fn normalize_app_list(list: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut result = Vec::new();

    for item in list {
        let Some(exe_name) = normalize_exe_name(&item) else {
            continue;
        };
        if seen.insert(exe_name.clone()) {
            result.push(exe_name);
        }
    }

    result
}

fn normalize_exe_name(value: &str) -> Option<String> {
    let name = value
        .trim()
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::ForegroundAppInfo;
    use std::{ffi::OsString, os::windows::ffi::OsStringExt, path::Path};

    const MONITOR_DEFAULTTONEAREST: u32 = 2;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const FULLSCREEN_TOLERANCE_PX: i32 = 4;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    struct MONITORINFO {
        cb_size: u32,
        rc_monitor: RECT,
        rc_work: RECT,
        dw_flags: u32,
    }

    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowRect(hwnd: isize, lp_rect: *mut RECT) -> i32;
        fn GetWindowTextW(hwnd: isize, lp_string: *mut u16, n_max_count: i32) -> i32;
        fn MonitorFromWindow(hwnd: isize, dw_flags: u32) -> isize;
        fn GetMonitorInfoW(h_monitor: isize, lpmi: *mut MONITORINFO) -> i32;
        fn GetWindowThreadProcessId(hwnd: isize, lpdw_process_id: *mut u32) -> u32;
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> isize;
        fn QueryFullProcessImageNameW(
            h_process: isize,
            dw_flags: u32,
            lp_exe_name: *mut u16,
            lpdw_size: *mut u32,
        ) -> i32;
        fn CloseHandle(h_object: isize) -> i32;
    }

    pub fn foreground_app_info() -> Option<ForegroundAppInfo> {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd == 0 {
            return None;
        }

        let exe_path = foreground_process_path(hwnd).unwrap_or_default();
        let exe_name = Path::new(&exe_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        Some(ForegroundAppInfo {
            exe_name,
            exe_path,
            window_title: window_title(hwnd),
            is_fullscreen: window_is_fullscreen(hwnd),
        })
    }

    fn foreground_process_path(hwnd: isize) -> Option<String> {
        let mut process_id = 0u32;
        unsafe {
            GetWindowThreadProcessId(hwnd, &mut process_id);
        }
        if process_id == 0 {
            return None;
        }

        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
        if process == 0 {
            return None;
        }

        let mut buffer = vec![0u16; 32768];
        let mut size = buffer.len() as u32;
        let ok = unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size) };
        unsafe {
            CloseHandle(process);
        }

        if ok == 0 || size == 0 {
            return None;
        }

        Some(
            os_string_from_wide(&buffer[..size as usize])
                .to_string_lossy()
                .to_string(),
        )
    }

    fn window_title(hwnd: isize) -> String {
        let mut buffer = vec![0u16; 512];
        let len = unsafe { GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32) };
        if len <= 0 {
            return String::new();
        }
        os_string_from_wide(&buffer[..len as usize])
            .to_string_lossy()
            .to_string()
    }

    fn window_is_fullscreen(hwnd: isize) -> bool {
        let Some(window_rect) = window_rect(hwnd) else {
            return false;
        };
        let Some(monitor_rect) = monitor_rect(hwnd) else {
            return false;
        };

        covers_rect(window_rect, monitor_rect, FULLSCREEN_TOLERANCE_PX)
    }

    fn window_rect(hwnd: isize) -> Option<RECT> {
        let mut rect = RECT::default();
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return None;
        }
        if rect.right <= rect.left || rect.bottom <= rect.top {
            return None;
        }
        Some(rect)
    }

    fn monitor_rect(hwnd: isize) -> Option<RECT> {
        let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        if monitor == 0 {
            return None;
        }

        let mut info = MONITORINFO {
            cb_size: std::mem::size_of::<MONITORINFO>() as u32,
            rc_monitor: RECT::default(),
            rc_work: RECT::default(),
            dw_flags: 0,
        };

        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
            return None;
        }

        Some(info.rc_monitor)
    }

    fn covers_rect(outer: RECT, inner: RECT, tolerance: i32) -> bool {
        outer.left <= inner.left + tolerance
            && outer.top <= inner.top + tolerance
            && outer.right >= inner.right - tolerance
            && outer.bottom >= inner.bottom - tolerance
    }

    fn os_string_from_wide(value: &[u16]) -> OsString {
        OsString::from_wide(value)
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::ForegroundAppInfo;

    pub fn foreground_app_info() -> Option<ForegroundAppInfo> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_app_list, normalize_exe_name, normalize_rules, QuickNoteRules};

    #[test]
    fn normalizes_exe_names() {
        assert_eq!(
            normalize_exe_name("C:\\Games\\Foo.EXE"),
            Some("foo.exe".into())
        );
        assert_eq!(normalize_exe_name(" /tmp/bar "), Some("bar".into()));
        assert_eq!(normalize_exe_name("   "), None);
    }

    #[test]
    fn removes_duplicates_and_blacklist_wins() {
        let rules = normalize_rules(QuickNoteRules {
            enabled: true,
            suppress_quick_note_in_fullscreen: true,
            app_blacklist: vec!["Game.exe".into(), "game.exe".into()],
            app_whitelist: vec!["game.exe".into(), "notes.exe".into()],
        });

        assert!(rules.enabled);
        assert_eq!(rules.app_blacklist, vec!["game.exe"]);
        assert_eq!(rules.app_whitelist, vec!["notes.exe"]);
    }

    #[test]
    fn normalizes_app_lists() {
        assert_eq!(
            normalize_app_list(vec!["A.EXE".into(), "a.exe".into(), "b.exe".into()]),
            vec!["a.exe", "b.exe"]
        );
    }
}
