use std::collections::{HashMap, VecDeque};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use std::time::{Duration, Instant};

use axum::body::{Body, to_bytes};
use axum::extract::connect_info::IntoMakeServiceWithConnectInfo;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, FromRequestParts, State};
use axum::http::header::{
    ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN,
    CONNECTION, CONTENT_TYPE, SEC_WEBSOCKET_KEY, UPGRADE,
};
use axum::http::{Method, Request, Response, StatusCode};
use axum::Router;
use chrono::Utc;
use regex::{Captures, Regex};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::model::{HttpMethod, MockRouteRecord, RequestRecord};

/// Max inbound body bytes buffered in memory per request.
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
/// Request log ring-buffer size.
pub const MAX_LOG_ENTRIES: usize = 500;

/* -------------------------------------------------------------------------- */
/* Shared runtime state                                                       */
/* -------------------------------------------------------------------------- */

pub struct SharedState {
    pub app: AppHandle,
    pub routes: RwLock<Vec<MockRouteRecord>>,
    pub logs: Mutex<VecDeque<RequestRecord>>,
    pub seq: AtomicU64,
}

impl SharedState {
    pub fn new(app: AppHandle, routes: Vec<MockRouteRecord>) -> Arc<Self> {
        Arc::new(Self {
            app,
            routes: RwLock::new(routes),
            logs: Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES)),
            seq: AtomicU64::new(1),
        })
    }

    pub fn next_seq(&self) -> u64 {
        self.seq.fetch_add(1, Ordering::Relaxed)
    }

    /// Buffer a request record in the ring log and fan it out to the frontend.
    pub async fn push_log(&self, record: RequestRecord) {
        let mut logs = self.logs.lock().await;
        if logs.len() >= MAX_LOG_ENTRIES {
            logs.pop_front();
        }
        logs.push_back(record.clone());
        let _ = self.app.emit("mock://request", &record);
    }
}

/// Build an axum router (a single catch-all fallback) so dynamic route tables
/// can be swapped at runtime without rebuilding the server.
pub fn build_make_service(
    shared: Arc<SharedState>,
) -> IntoMakeServiceWithConnectInfo<Router, SocketAddr> {
    Router::new()
        .fallback(mock_handler)
        .with_state(shared)
        .into_make_service_with_connect_info::<SocketAddr>()
}

/* -------------------------------------------------------------------------- */
/* Fallback handler                                                           */
/* -------------------------------------------------------------------------- */

#[allow(clippy::too_many_lines)]
async fn mock_handler(
    State(shared): State<Arc<SharedState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request<Body>,
) -> Response<Body> {
    let started = Instant::now();
    let (mut parts, body) = req.into_parts();

    let method_str = parts.method.to_string();
    let path = parts.uri.path().to_string();
    let query = parse_query(parts.uri.query().unwrap_or(""));

    let request_headers: HashMap<String, String> = parts
        .headers
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.as_str().to_string(), s.to_string())))
        .collect();

    // CORS pre-flight short-circuit — helps browser-based dev on the same machine.
    if parts.method == Method::OPTIONS {
        return Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            .header(ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type, Authorization, X-Requested-With")
            .body(Body::empty())
            .unwrap_or_default();
    }

    let matched = match_route(&shared, &method_str, &path);

    // ---- WebSocket upgrade ----
    let is_upgrade = parts
        .headers
        .get(CONNECTION)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.to_ascii_lowercase().contains("upgrade"))
        && parts.headers.contains_key(SEC_WEBSOCKET_KEY)
        && parts.headers.contains_key(UPGRADE);

    if is_upgrade {
        if let Some((route, params)) = &matched {
            if route.enabled && route.ws.enabled {
                match WebSocketUpgrade::from_request_parts(&mut parts, &shared).await {
                    Ok(upgrade) => {
                        let ws_route = route.clone();
                        let ws_params = params.clone();
                        push_ws_log(
                            &shared,
                            &method_str,
                            &path,
                            &addr,
                            started.elapsed().as_millis(),
                            &ws_route.id,
                        )
                        .await;
                        return upgrade.on_upgrade(move |socket| handle_ws(socket, ws_route, ws_params));
                    }
                    Err(_) => {
                        return json_response(StatusCode::BAD_REQUEST, r#"{"error":"WebSocket upgrade failed"}"#);
                    }
                }
            }
        }
    }

    let body_bytes = to_bytes(body, MAX_BODY_BYTES).await.unwrap_or_default();
    let request_body = String::from_utf8_lossy(&body_bytes).into_owned();

    let Some((route, params)) = matched else {
        let msg = serde_json::json!({
            "message": "No mock route matched",
            "method": method_str,
            "path": path,
        })
        .to_string();
        let status = StatusCode::NOT_FOUND;
        shared
            .push_log(RequestRecord {
                id: format!("req-{}", shared.next_seq()),
                timestamp: Utc::now().to_rfc3339(),
                method: method_str,
                path,
                status: status.as_u16(),
                latency_ms: started.elapsed().as_millis(),
                ip: addr.ip().to_string(),
                request_headers,
                request_body,
                response_body: msg.clone(),
                matched_route_id: None,
                error: Some("No matching route".into()),
            })
            .await;
        return json_response(status, &msg);
    };

    // Simulated latency before responding.
    if route.latency_ms > 0 {
        tokio::time::sleep(Duration::from_millis(route.latency_ms)).await;
    }

    let status = StatusCode::from_u16(route.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let ctx = TemplateContext {
        req_method: method_str.clone(),
        req_path: path.clone(),
        params: &params,
        query: &query,
        headers: &request_headers,
        body: &request_body,
    };
    let rendered_body = render(&route.body, &ctx);

    let mut builder = Response::builder()
        .status(status)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*");

    let has_content_type = route
        .headers
        .iter()
        .any(|h| h.key.eq_ignore_ascii_case("content-type"));
    for h in &route.headers {
        if h.key.trim().is_empty() {
            continue;
        }
        builder = builder.header(h.key.trim(), h.value.trim());
    }
    if !has_content_type {
        builder = builder.header(CONTENT_TYPE, "application/json");
    }

    let response = builder
        .body(Body::from(rendered_body.clone()))
        .unwrap_or_else(|_| {
            json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                r#"{"error":"invalid response configuration"}"#,
            )
        });

    shared
        .push_log(RequestRecord {
            id: format!("req-{}", shared.next_seq()),
            timestamp: Utc::now().to_rfc3339(),
            method: method_str,
            path,
            status: status.as_u16(),
            latency_ms: started.elapsed().as_millis(),
            ip: addr.ip().to_string(),
            request_headers,
            request_body,
            response_body: rendered_body,
            matched_route_id: Some(route.id.clone()),
            error: None,
        })
        .await;

    response
}

fn json_response(status: StatusCode, body: &str) -> Response<Body> {
    Response::builder()
        .status(status)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap_or_default()
}

async fn push_ws_log(
    shared: &Arc<SharedState>,
    method: &str,
    path: &str,
    addr: &SocketAddr,
    latency_ms: u128,
    route_id: &str,
) {
    shared
        .push_log(RequestRecord {
            id: format!("ws-{}", shared.next_seq()),
            timestamp: Utc::now().to_rfc3339(),
            method: method.to_string(),
            path: path.to_string(),
            status: 101,
            latency_ms,
            ip: addr.ip().to_string(),
            request_headers: HashMap::new(),
            request_body: String::new(),
            response_body: "WebSocket connected".into(),
            matched_route_id: Some(route_id.to_string()),
            error: None,
        })
        .await;
}

/* -------------------------------------------------------------------------- */
/* WebSocket mock loop                                                        */
/* -------------------------------------------------------------------------- */

async fn handle_ws(
    mut socket: WebSocket,
    route: MockRouteRecord,
    params: HashMap<String, String>,
) {
    let interval_ms = route.ws.interval_ms.max(100);
    let empty_q = HashMap::new();
    let empty_h = HashMap::new();
    let ctx = TemplateContext {
        req_method: "GET".into(),
        req_path: route.path.clone(),
        params: &params,
        query: &empty_q,
        headers: &empty_h,
        body: "",
    };

    let mut tick = tokio::time::interval(Duration::from_millis(interval_ms));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            _ = tick.tick() => {
                let payload = render(&route.body, &ctx);
                if socket.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    Some(Ok(_)) => { /* ignore inbound frames */ }
                }
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Dynamic route matching                                                     */
/* -------------------------------------------------------------------------- */

fn match_route(
    shared: &Arc<SharedState>,
    method: &str,
    path: &str,
) -> Option<(MockRouteRecord, HashMap<String, String>)> {
    let request_method = match method {
        "POST" => Some(HttpMethod::Post),
        "PUT" => Some(HttpMethod::Put),
        "PATCH" => Some(HttpMethod::Patch),
        "DELETE" => Some(HttpMethod::Delete),
        "GET" => Some(HttpMethod::Get),
        _ => None,
    }?;

    let target: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let guard = shared.routes.read().ok()?;

    for route in guard.iter() {
        if !route.enabled || route.method != request_method {
            continue;
        }
        let pattern: Vec<&str> = route.path.split('/').filter(|s| !s.is_empty()).collect();
        if let Some(params) = match_segments(&pattern, &target) {
            return Some((route.clone(), params));
        }
    }

    None
}

/// Segment-wise matcher. `:name` captures a single segment; `*` swallows the
/// remainder of the path.
fn match_segments(pattern: &[&str], target: &[&str]) -> Option<HashMap<String, String>> {
    let mut params = HashMap::new();

    for (i, seg) in pattern.iter().enumerate() {
        if *seg == "*" {
            let rest = target[i..].join("/");
            params.insert("_wildcard".into(), rest);
            return Some(params);
        }
        let Some(got) = target.get(i) else { return None };
        if let Some(key) = seg.strip_prefix(':') {
            params.insert(key.to_string(), got.to_string());
        } else if seg != got {
            return None;
        }
    }

    if pattern.len() == target.len() {
        Some(params)
    } else {
        None
    }
}

/* -------------------------------------------------------------------------- */
/* Query parsing                                                              */
/* -------------------------------------------------------------------------- */

fn parse_query(raw: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for pair in raw.split('&').filter(|s| !s.is_empty()) {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let val = parts.next().unwrap_or("");
        out.insert(percent_decode(key), percent_decode(val));
    }
    out
}

fn percent_decode(input: &str) -> String {
    let bytes = input.replace('+', " ");
    let mut out = Vec::with_capacity(bytes.len());
    let mut it = bytes.bytes();
    while let Some(b) = it.next() {
        if b == b'%' {
            match (it.next(), it.next()) {
                (Some(hi), Some(lo)) => match (hex_val(hi), hex_val(lo)) {
                    (Some(hb), Some(lb)) => {
                        out.push(hb * 16 + lb);
                        continue;
                    }
                    _ => out.push(b),
                },
                _ => out.push(b),
            }
        } else {
            out.push(b);
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_val(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/* -------------------------------------------------------------------------- */
/* Template rendering                                                         */
/* -------------------------------------------------------------------------- */

/// Data available to response templates: `{{random.uuid}}`, `{{req.params.id}}`…
pub struct TemplateContext<'a> {
    pub req_method: String,
    pub req_path: String,
    pub params: &'a HashMap<String, String>,
    pub query: &'a HashMap<String, String>,
    pub headers: &'a HashMap<String, String>,
    pub body: &'a str,
}

fn template_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\{\{([^{}]+)\}\}").expect("valid template regex"))
}

fn render(template: &str, ctx: &TemplateContext) -> String {
    template_regex()
        .replace_all(template, |caps: &Captures| resolve(&caps[1], ctx))
        .into_owned()
}

fn resolve(tag: &str, ctx: &TemplateContext) -> String {
    let parts: Vec<&str> = tag.split('.').collect();
    match parts[0].trim().eq_ignore_ascii_case("timestamp") {
        true => Utc::now().to_rfc3339(),
        false if parts[0].trim().eq_ignore_ascii_case("random") => {
            random_value(parts.get(1).copied().unwrap_or("name"))
        }
        false if parts[0].trim().eq_ignore_ascii_case("req") => request_value(&parts[1..], ctx),
        _ => String::new(),
    }
}

fn request_value(parts: &[&str], ctx: &TemplateContext) -> String {
    match parts.first().copied().unwrap_or("").to_ascii_lowercase().as_str() {
        "method" => ctx.req_method.clone(),
        "path" => ctx.req_path.clone(),
        "params" => params_value(&parts[1..], ctx.params),
        "query" => query_value(&parts[1..], ctx.query),
        "headers" => headers_value(parts.get(1).copied(), ctx.headers),
        "body" => {
            if parts.len() == 1 {
                ctx.body.to_string()
            } else {
                dotted_path(&parts[1..], ctx.body)
            }
        }
        _ => String::new(),
    }
}

fn params_value(parts: &[&str], params: &HashMap<String, String>) -> String {
    if parts.is_empty() {
        return serde_json::to_string(params).unwrap_or_default();
    }
    params.get(*parts.last().unwrap()).cloned().unwrap_or_default()
}

fn query_value(parts: &[&str], query: &HashMap<String, String>) -> String {
    if parts.is_empty() {
        return serde_json::to_string(query).unwrap_or_default();
    }
    query.get(*parts.last().unwrap()).cloned().unwrap_or_default()
}

fn headers_value(key: Option<&str>, headers: &HashMap<String, String>) -> String {
    match key {
        Some(k) => headers
            .iter()
            .find(|(h, _)| h.eq_ignore_ascii_case(k))
            .map(|(_, v)| v.clone())
            .unwrap_or_default(),
        None => serde_json::to_string(headers).unwrap_or_default(),
    }
}

fn dotted_path(parts: &[&str], raw_body: &str) -> String {
    match serde_json::from_str::<Value>(raw_body) {
        Ok(value) => walk_json(&value, parts),
        Err(_) => String::new(),
    }
}

fn walk_json(current: &Value, parts: &[&str]) -> String {
    if parts.is_empty() {
        return current.to_string();
    }
    match current {
        Value::Object(map) => map
            .get(parts[0])
            .map(|v| walk_json(v, &parts[1..]))
            .unwrap_or_default(),
        Value::Array(arr) => parts[0]
            .parse::<usize>()
            .ok()
            .and_then(|i| arr.get(i))
            .map(|v| walk_json(v, &parts[1..]))
            .unwrap_or_default(),
        Value::String(s) if parts.len() == 1 => s.clone(),
        _ => String::new(),
    }
}

fn random_value(kind: &str) -> String {
    const FIRST: [&str; 12] = [
        "Ava", "Leo", "Mara", "Ivan", "Nia", "Omar", "Zoe", "Kai", "Lena", "Jude", "Rhea", "Finn",
    ];
    const LAST: [&str; 12] = [
        "Stone", "Rivera", "Chen", "Novak", "Bishop", "Ortega", "Hale", "Mercer", "Keller", "Rios",
        "Vega", "Lin",
    ];
    const WORDS: [&str; 16] = [
        "bloom", "frost", "ember", "lagoon", "horizon", "quantum", "vanguard", "nebula", "cipher",
        "aurora", "citadel", "pixels", "echo", "haven", "vector", "synapse",
    ];

    match kind.to_ascii_lowercase().as_str() {
        "uuid" | "id" => uuid::Uuid::new_v4().to_string(),
        "name" => {
            let first = FIRST[fastrand::usize(..FIRST.len())];
            let last = LAST[fastrand::usize(..LAST.len())];
            format!("{first} {last}")
        }
        "email" => {
            let first = FIRST[fastrand::usize(..FIRST.len())].to_lowercase();
            let last = LAST[fastrand::usize(..LAST.len())].to_lowercase();
            format!("{first}.{last}@example.dev")
        }
        "integer" | "int" | "number" => fastrand::i64(0..=1_000_000).to_string(),
        "float" => format!("{:.2}", fastrand::f64() * 1000.0),
        "words" => {
            let count = fastrand::usize(3..=6);
            (0..count)
                .map(|_| WORDS[fastrand::usize(..WORDS.len())])
                .collect::<Vec<_>>()
                .join(" ")
        }
        "boolean" | "bool" => fastrand::bool().to_string(),
        "ip" | "address" => format!(
            "{}.{}.{}.{}",
            fastrand::u8(1..255),
            fastrand::u8(0..255),
            fastrand::u8(0..255),
            1 + fastrand::usize(0..254)
        ),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn segments_match_param_and_wildcard() {
        let sheet: Vec<&str> = vec!["api", "v1", "users", ":id"];
        let target: Vec<&str> = vec!["api", "v1", "users", "42"];
        let params = match_segments(&sheet, &target).expect("should match");
        assert_eq!(params.get("id").map(String::as_str), Some("42"));

        let wild: Vec<&str> = vec!["static", "*"];
        let deep: Vec<&str> = vec!["static", "img", "logo.png"];
        let params = match_segments(&wild, &deep).expect("wildcard should match");
        assert_eq!(params.get("_wildcard").map(String::as_str), Some("img/logo.png"));
    }

    #[test]
    fn segments_reject_mismatch() {
        let sheet: Vec<&str> = vec!["users", ":id"];
        assert!(match_segments(&sheet, &vec!["users"]).is_none());
        assert!(match_segments(&sheet, &vec!["users", "1", "extra"]).is_none());
    }

    #[test]
    fn query_parser_handles_percent_encoding() {
        let q = parse_query("q=hello%20world&x=1&flag=");
        assert_eq!(q.get("q").map(String::as_str), Some("hello world"));
        assert_eq!(q.get("x").map(String::as_str), Some("1"));
        assert_eq!(q.get("flag").map(String::as_str), Some(""));
    }

    #[test]
    fn template_binds_service_terminals() {
        let mut params = HashMap::new();
        params.insert("id".to_string(), "99".to_string());
        let mut query = HashMap::new();
        query.insert("limit".to_string(), "5".to_string());
        let mut headers = HashMap::new();
        headers.insert("user-agent".to_string(), "curl/8".to_string());
        let body = serde_json::json!({ "email": "a@b.dev", "tags": ["x"] }).to_string();

        let ctx = TemplateContext {
            req_method: "GET".into(),
            req_path: "/api/v1/users/99".into(),
            params: &params,
            query: &query,
            headers: &headers,
            body: &body,
        };

        let rendered = render(
            r#"{"id":"{{req.params.id}}","limit":{{req.query.limit}},"ua":"{{req.headers.user-agent}}","at":"{{timestamp}}","rand":"{{random.uuid}}"}"#,
            &ctx,
        );
        let parsed: Value = serde_json::from_str(&rendered).expect("rendered JSON stays valid");
        assert_eq!(parsed["id"], "99");
        assert_eq!(parsed["limit"], 5);
        assert_eq!(parsed["ua"], "curl/8");
        assert!(parsed["at"].as_str().is_some());
        assert!(parsed["rand"].as_str().is_some());
    }

    #[test]
    fn dotted_body_path_resolves_nested_json() {
        let raw = r#"{"user":{"name":"Ada","meta":{"role":"admin"}}}"#;
        assert_eq!(dotted_path(&["user", "meta", "role"], raw), "\"admin\"");
        assert_eq!(dotted_path(&["user", "name"], raw), "\"Ada\"");
        assert_eq!(dotted_path(&["missing"], raw), "");
    }
}