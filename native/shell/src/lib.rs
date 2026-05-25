//! Native shell module — real in-process bash via brush-shell.
//! Provides persistent shell sessions without spawning external processes.
//! Adapted from oh-my-pi's pi-shell crate.

use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::io::{self, Read as _};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::fs;
use tokio::sync::Mutex as TokioMutex;
use tokio::runtime::Runtime;
use brush_core::{
    ExecutionControlFlow, ExecutionExitCode, ExecutionResult,
    ProcessGroupPolicy, ProfileLoadBehavior, RcLoadBehavior,
    Shell as BrushShell, ShellValue, ShellVariable, SourceInfo,
    builtins,
    env::EnvironmentScope,
    openfiles::{self, OpenFile, OpenFiles},
};
use brush_builtins::{BuiltinSet, default_builtins};

static NEXT_SESSION_ID: AtomicU32 = AtomicU32::new(1);

lazy_static::lazy_static! {
    static ref SESSIONS: TokioMutex<HashMap<u32, ShellSession>> =
        TokioMutex::new(HashMap::new());
    static ref RT: Runtime = Runtime::new().expect("Failed to create tokio runtime");
}

struct ShellSession {
    shell: BrushShell,
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
    pub timed_out: bool,
}

/// Environment variables that brush manages internally — never inherit from host.
fn should_skip_env_var(key: &str) -> bool {
    if key.starts_with("BASH_FUNC_") && key.ends_with("%%") {
        return true;
    }
    matches!(
        key,
        "BASH_ENV" | "ENV" | "HISTFILE" | "HISTCMD"
            | "PS0" | "PS1" | "PS2" | "PS4"
            | "READLINE_LINE" | "READLINE_POINT"
            | "BRUSH_VERSION" | "BASH" | "BASHOPTS"
            | "BASH_ALIASES" | "BASH_ARGV0" | "BASH_CMDS"
            | "BASH_SOURCE" | "BASH_SUBSHELL" | "BASH_VERSINFO"
            | "BASH_VERSION" | "SHELLOPTS" | "SHLVL" | "SHELL"
            | "COMP_WORDBREAKS" | "DIRSTACK" | "EPOCHREALTIME"
            | "EPOCHSECONDS" | "FUNCNAME" | "GROUPS" | "IFS"
            | "LINENO" | "MACHTYPE" | "OSTYPE" | "OPTERR"
            | "OPTIND" | "PIPESTATUS" | "PPID" | "PWD"
            | "OLDPWD" | "RANDOM" | "SRANDOM" | "SECONDS"
            | "UID" | "EUID" | "HOSTNAME" | "HOSTTYPE"
    )
}

/// Create a brush shell instance with inherited (filtered) environment.
async fn build_shell(cwd: Option<&str>, env: Option<&HashMap<String, String>>) -> anyhow::Result<BrushShell> {
    let mut shell = BrushShell::builder()
        .do_not_inherit_env(true)
        .profile(ProfileLoadBehavior::Skip)
        .rc(RcLoadBehavior::Skip)
        .builtins(default_builtins(BuiltinSet::BashMode))
        .build()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to init shell: {e}"))?;

    // Disable dangerous builtins
    if let Some(b) = shell.builtin_mut("exec") { b.disabled = true; }
    if let Some(b) = shell.builtin_mut("suspend") { b.disabled = true; }

    // Inherit filtered host environment
    for (key, value) in std::env::vars() {
        if should_skip_env_var(&key) { continue; }
        let mut var = ShellVariable::new(ShellValue::String(value));
        var.export();
        let _ = shell.env_mut().set_global(&key, var);
    }

    // Apply caller-provided env overrides
    if let Some(env) = env {
        for (key, value) in env {
            if should_skip_env_var(key) { continue; }
            let mut var = ShellVariable::new(ShellValue::String(value.clone()));
            var.export();
            let _ = shell.env_mut().set_global(key, var);
        }
    }

    // Set working directory
    if let Some(cwd) = cwd {
        shell.set_working_dir(cwd)
            .map_err(|e| anyhow::anyhow!("Failed to set cwd: {e}"))?;
    }

    Ok(shell)
}

/// Create an OS pipe pair as std::fs::File handles.
fn pipe_pair(label: &str) -> anyhow::Result<(fs::File, fs::File)> {
    let (reader, writer) = os_pipe::pipe()
        .map_err(|e| anyhow::anyhow!("Failed to create {label} pipe: {e}"))?;
    Ok((reader.into(), writer.into()))
}

/// Execute a command in a brush shell, capturing stdout/stderr.
async fn execute_in_shell(
    shell: &mut BrushShell,
    command: &str,
) -> anyhow::Result<(ExecutionResult, String, String)> {
    let (stdout_reader, stdout_writer) = pipe_pair("stdout")?;
    let (stderr_reader, stderr_writer) = pipe_pair("stderr")?;

    let stdout_file = OpenFile::from(stdout_writer);
    let stderr_file = OpenFile::from(stderr_writer);

    let mut params = shell.default_exec_params();
    params.set_fd(OpenFiles::STDIN_FD, OpenFile::from(
        fs::File::open("/dev/null").unwrap_or_else(|_| unsafe {
            use std::os::unix::io::FromRawFd;
            fs::File::from_raw_fd(-1)
        })
    ));
    params.set_fd(OpenFiles::STDOUT_FD, stdout_file);
    params.set_fd(OpenFiles::STDERR_FD, stderr_file);
    params.process_group_policy = ProcessGroupPolicy::NewProcessGroup;

    let source_info = SourceInfo::from("legna-shell:command");
    let result = shell.run_string(command.to_string(), &source_info, &params).await
        .map_err(|e| anyhow::anyhow!("Shell execution failed: {e}"))?;

    // Drop params to close write ends of pipes
    drop(params);

    // Read captured output
    let stdout = tokio::task::spawn_blocking(move || {
        let mut s = String::new();
        let mut r = stdout_reader;
        let _ = r.read_to_string(&mut s);
        s
    }).await.unwrap_or_default();

    let stderr = tokio::task::spawn_blocking(move || {
        let mut s = String::new();
        let mut r = stderr_reader;
        let _ = r.read_to_string(&mut s);
        s
    }).await.unwrap_or_default();

    Ok((result, stdout, stderr))
}

fn exit_code(result: &ExecutionResult) -> i32 {
    match result.exit_code {
        ExecutionExitCode::Success => 0,
        ExecutionExitCode::Failure(code) => code as i32,
        ExecutionExitCode::Signal(sig) => 128 + sig as i32,
    }
}

fn session_keepalive(result: &ExecutionResult) -> bool {
    matches!(result.next_control_flow, ExecutionControlFlow::Normal)
}

// ─── N-API Exports ───────────────────────────────────────────────────────────

#[napi]
pub fn create_session(cwd: String, env: Option<HashMap<String, String>>) -> Result<u32> {
    let id = NEXT_SESSION_ID.fetch_add(1, Ordering::SeqCst);
    RT.block_on(async {
        let shell = build_shell(Some(&cwd), env.as_ref()).await
            .map_err(|e| Error::from_reason(e.to_string()))?;
        let mut sessions = SESSIONS.lock().await;
        sessions.insert(id, ShellSession { shell });
        Ok(id)
    })
}

#[napi]
pub fn execute_in_session(session_id: u32, command: String, timeout_ms: Option<u32>) -> Result<ShellResult> {
    RT.block_on(async {
        let start = std::time::Instant::now();
        let mut sessions = SESSIONS.lock().await;
        let session = sessions.get_mut(&session_id)
            .ok_or_else(|| Error::from_reason(format!("Session {session_id} not found")))?;

        let timeout = timeout_ms.map(|ms| std::time::Duration::from_millis(ms as u64));

        let exec_future = execute_in_shell(&mut session.shell, &command);

        let result = if let Some(timeout_dur) = timeout {
            match tokio::time::timeout(timeout_dur, exec_future).await {
                Ok(r) => r.map_err(|e| Error::from_reason(e.to_string()))?,
                Err(_) => {
                    // Timed out — destroy session to avoid stale state
                    sessions.remove(&session_id);
                    return Ok(ShellResult {
                        exit_code: 124,
                        stdout: String::new(),
                        stderr: "Command timed out".to_string(),
                        duration_ms: start.elapsed().as_millis() as u32,
                        timed_out: true,
                    });
                }
            }
        } else {
            exec_future.await.map_err(|e| Error::from_reason(e.to_string()))?
        };

        let (exec_result, stdout, stderr) = result;
        let code = exit_code(&exec_result);

        // Destroy session if shell exited
        if !session_keepalive(&exec_result) {
            sessions.remove(&session_id);
        }

        Ok(ShellResult {
            exit_code: code,
            stdout,
            stderr,
            duration_ms: start.elapsed().as_millis() as u32,
            timed_out: false,
        })
    })
}

#[napi]
pub fn destroy_session(session_id: u32) {
    RT.block_on(async {
        let mut sessions = SESSIONS.lock().await;
        sessions.remove(&session_id);
    });
}

#[napi]
pub fn execute_oneshot(options: ShellOptions) -> Result<ShellResult> {
    RT.block_on(async {
        let start = std::time::Instant::now();
        let mut shell = build_shell(options.cwd.as_deref(), options.env.as_ref()).await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let timeout = options.timeout_ms.map(|ms| std::time::Duration::from_millis(ms as u64));
        let exec_future = execute_in_shell(&mut shell, &options.command);

        let result = if let Some(timeout_dur) = timeout {
            match tokio::time::timeout(timeout_dur, exec_future).await {
                Ok(r) => r.map_err(|e| Error::from_reason(e.to_string()))?,
                Err(_) => {
                    return Ok(ShellResult {
                        exit_code: 124,
                        stdout: String::new(),
                        stderr: "Command timed out".to_string(),
                        duration_ms: start.elapsed().as_millis() as u32,
                        timed_out: true,
                    });
                }
            }
        } else {
            exec_future.await.map_err(|e| Error::from_reason(e.to_string()))?
        };

        let (exec_result, stdout, stderr) = result;

        Ok(ShellResult {
            exit_code: exit_code(&exec_result),
            stdout,
            stderr,
            duration_ms: start.elapsed().as_millis() as u32,
            timed_out: false,
        })
    })
}
