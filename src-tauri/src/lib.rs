mod model;
mod server;

use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};

use crate::model::{MockRouteRecord, RequestRecord, ServerStatus};
use crate::server::SharedState;

/// Server lifecycle state managed by Tauri and driven from the React UI.
pub struct AppState {
    pub running: AtomicBool,
    pub port: AtomicU16,
    pub handle: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub shared: Mutex<Option<Arc<SharedState>>>,
    /// Interface we bind to: "0.0.0.0" (LAN, every domain) or "127.0.0.1".
    pub bind: Mutex<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            port: AtomicU16::new(8080),
            handle: Mutex::new(None),
            shared: Mutex::new(None),
            bind: Mutex::new("0.0.0.0".into()),
        }
    }
}

fn build_status(state: &AppState) -> ServerStatus {
    let port = state.port.load(Ordering::SeqCst);
    let running = state.running.load(Ordering::SeqCst);
    let bind = state
        .bind
        .lock()
        .ok()
        .map(|guard| guard.clone())
        .unwrap_or_else(|| "0.0.0.0".into());

    let ws_url = state
        .shared
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .and_then(|shared| {
            shared
                .routes
                .read()
                .ok()
                .and_then(|routes| {
                    routes
                        .iter()
                        .find(|r| r.enabled && r.ws.enabled)
                        .map(|r| format!("ws://{bind}:{port}{}", r.path))
                })
        });

    let lan_urls = reachable_urls(&bind, port);

    ServerStatus {
        running,
        port,
        ws_url,
        lan_urls,
        bind,
        error: None,
    }
}

/// Reachable HTTP endpoints for the current bind host:
/// - `0.0.0.0`  → every non-loopback IPv4 on this machine
/// - a custom domain/hostname → that hostname (reachable if it resolves here)
/// - loopback → nothing extra (localhost only)
fn reachable_urls(bind: &str, port: u16) -> Vec<String> {
    if bind == "0.0.0.0" || bind == "::" {
        return lan_ip_urls(port);
    }
    if is_loopback_host(bind) {
        return Vec::new();
    }
    vec![format!("http://{bind}:{port}")]
}

/// Enumerate non-loopback IPv4 addresses and expose them as HTTP endpoints so
/// phones/tablets on the same network can reach the mock server.
fn lan_ip_urls(port: u16) -> Vec<String> {
    let Ok(interfaces) = local_ip_address::list_afinet_netifas() else {
        return Vec::new();
    };
    let mut urls: Vec<String> = interfaces
        .into_iter()
        .map(|(_name, ip)| ip)
        .filter(|ip| ip.is_ipv4() && !ip.is_loopback())
        .map(|ip| format!("http://{ip}:{port}"))
        .collect();
    urls.sort();
    urls.dedup();
    urls
}

/// Loopback-only bind targets (no network exposure).
fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host == "127.0.0.1"
        || host == "::1"
}

fn abort_running_server(state: &AppState) {
    if let Ok(mut guard) = state.handle.lock() {
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }
    state.running.store(false, Ordering::SeqCst);
    if let Ok(mut guard) = state.shared.lock() {
        *guard = None;
    }
}

/* -------------------------------- commands ------------------------------- */

#[tauri::command]
async fn mock_start_server(
    app: AppHandle,
    state: State<'_, AppState>,
    port: u16,
    host: String,
    routes: Vec<MockRouteRecord>,
) -> Result<ServerStatus, String> {
    if port == 0 {
        return Err("port must not be 0".into());
    }
    if state.running.load(Ordering::SeqCst) {
        abort_running_server(&state);
    }

    let shared = SharedState::new(app.clone(), routes);

    // Verify the address is actually free before handing it to axum.
    // `host` can be an IP or any resolvable hostname/domain.
    let listener = tokio::net::TcpListener::bind((host.as_str(), port))
        .await
        .map_err(|e| format!("cannot bind {host}:{port}: {e}"))?;
    let bound_port = listener.local_addr().map(|addr| addr.port()).unwrap_or(port);

    let service = server::build_make_service(shared.clone());
    let server_handle = tauri::async_runtime::spawn(async move {
        if let Err(e) = axum::serve(listener, service).await {
            eprintln!("[agamiz-mock] engine error: {e}");
        }
    });

    {
        let mut handle_guard = state.handle.lock().map_err(|_| "state lock poisoned")?;
        *handle_guard = Some(server_handle);
        let mut shared_guard = state.shared.lock().map_err(|_| "state lock poisoned")?;
        *shared_guard = Some(shared);
        if let Ok(mut bind_guard) = state.bind.lock() {
            *bind_guard = host;
        }
    }
    state.port.store(bound_port, Ordering::SeqCst);
    state.running.store(true, Ordering::SeqCst);

    let status = build_status(&state);
    let _ = app.emit("mock://status", &status);
    Ok(status)
}

#[tauri::command]
async fn mock_stop_server(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ServerStatus, String> {
    abort_running_server(&state);
    let status = build_status(&state);
    let _ = app.emit("mock://status", &status);
    Ok(status)
}

#[tauri::command]
fn mock_server_status(state: State<'_, AppState>) -> ServerStatus {
    build_status(&state)
}

#[tauri::command]
fn mock_update_routes(state: State<'_, AppState>, routes: Vec<MockRouteRecord>) {
    let Some(shared) = current_shared(&state) else {
        return;
    };
    let write_result = shared.routes.write();
    if let Ok(mut write) = write_result {
        *write = routes;
    }
}

/// `true` when the port is currently bindable for the given interface.
#[tauri::command]
fn mock_check_port(host: String, port: u16) -> bool {
    std::net::TcpListener::bind((host.as_str(), port)).is_ok()
}

#[tauri::command]
async fn mock_get_logs(state: State<'_, AppState>) -> Result<Vec<RequestRecord>, String> {
    match current_shared(&state) {
        Some(shared) => {
            let logs = shared.logs.lock().await;
            Ok(logs.iter().cloned().collect())
        }
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn mock_clear_logs(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(shared) = current_shared(&state) {
        shared.logs.lock().await.clear();
    }
    Ok(())
}

/// Grab the engine state and drop the guard immediately so no non-Send
/// std::sync::MutexGuard is held across an `.await`.
fn current_shared(state: &AppState) -> Option<Arc<SharedState>> {
    state.shared.lock().ok().and_then(|guard| guard.clone())
}

/* --------------------------------- entry -------------------------------- */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            mock_start_server,
            mock_stop_server,
            mock_server_status,
            mock_update_routes,
            mock_check_port,
            mock_get_logs,
            mock_clear_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agamiz Mock API");
}