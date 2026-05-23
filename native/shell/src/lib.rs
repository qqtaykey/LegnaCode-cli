//! Native shell module — persistent bash sessions via vendored brush-shell.
//! Provides in-process shell execution without spawning external processes.
//!
//! NOTE: brush-shell integration is planned for a future iteration.
//! Currently provides a thin wrapper around std::process::Command
//! that will be replaced with the vendored brush-shell interpreter.

use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::process::Command;
use std::time::Instant;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};

static NEXT_SESSION_ID: AtomicU32 = AtomicU32::new(1);
static SESSIONS: Mutex<Option<HashMap<u32, ShellSession>>> = Mutex::new(None);

struct ShellSession {
    cwd: String,
    env: HashMap<String, String>,
}

#[napi(object)]
pub struct ShellOptions {
    pub command: String,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub timeout_ms: Option<u32>,
}

#[napi(object)]
pub struct ShellResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u32,
    pub truncated: bool,
}

#[napi]
pub fn create_session(cwd: String) -> u32 {
    let id = NEXT_SESSION_ID.fetch_add(1, Ordering::SeqCst);
    let session = ShellSession {
        cwd,
        env: std::env::vars().collect(),
    };

    let mut sessions = SESSIONS.lock().unwrap();
    if sessions.is_none() {
        *sessions = Some(HashMap::new());
    }
    sessions.as_mut().unwrap().insert(id, session);
    id
}

#[napi]
pub fn execute_in_session(session_id: u32, command: String, timeout_ms: Option<u32>) -> Result<ShellResult> {
    let sessions = SESSIONS.lock().unwrap();
    let sessions_map = sessions.as_ref().ok_or_else(|| Error::from_reason("No sessions"))?;
    let session = sessions_map.get(&session_id)
        .ok_or_else(|| Error::from_reason(format!("Session {} not found", session_id)))?;

    let start = Instant::now();
    let output = Command::new("sh")
        .arg("-c")
        .arg(&command)
        .current_dir(&session.cwd)
        .envs(&session.env)
        .output()
        .map_err(|e| Error::from_reason(format!("Failed to execute: {}", e)))?;

    let duration = start.elapsed().as_millis() as u32;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(ShellResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout,
        stderr,
        duration_ms: duration,
        truncated: false,
    })
}

#[napi]
pub fn destroy_session(session_id: u32) {
    let mut sessions = SESSIONS.lock().unwrap();
    if let Some(ref mut map) = *sessions {
        map.remove(&session_id);
    }
}

#[napi]
pub fn execute_oneshot(options: ShellOptions) -> Result<ShellResult> {
    let start = Instant::now();
    let cwd = options.cwd.unwrap_or_else(|| ".".to_string());

    let output = Command::new("sh")
        .arg("-c")
        .arg(&options.command)
        .current_dir(&cwd)
        .output()
        .map_err(|e| Error::from_reason(format!("Failed to execute: {}", e)))?;

    let duration = start.elapsed().as_millis() as u32;

    Ok(ShellResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms: duration,
        truncated: false,
    })
}
