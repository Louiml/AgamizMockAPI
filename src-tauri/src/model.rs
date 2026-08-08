use serde::{Deserialize, Serialize};

/// HTTP methods the mock engine understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    #[default]
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

impl HttpMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
            HttpMethod::Put => "PUT",
            HttpMethod::Patch => "PATCH",
            HttpMethod::Delete => "DELETE",
        }
    }
}

/// MyCircular vector stored as headers of the response.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub id: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsConfig {
    pub enabled: bool,
    pub interval_ms: u64,
}

impl Default for WsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_ms: 1000,
        }
    }
}

/// A single frontend-configured mock route.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MockRouteRecord {
    pub id: String,
    pub name: String,
    pub group: String,
    #[serde(default = "default_method")]
    pub method: HttpMethod,
    pub path: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_status")]
    pub status_code: u16,
    #[serde(default)]
    pub latency_ms: u64,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    pub body: String,
    #[serde(default)]
    pub ws: WsConfig,
}

/// A captured inbound request — mirrored field-for-field by `RequestLog`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestRecord {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub latency_ms: u128,
    pub ip: String,
    pub request_headers: std::collections::HashMap<String, String>,
    pub request_body: String,
    pub response_body: String,
    pub matched_route_id: Option<String>,
    pub error: Option<String>,
}

/// Snapshot of the running engine, surfaced to the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub ws_url: Option<String>,
    /// Reachable URLs from the local network, e.g. `http://192.168.1.5:8080`.
    pub lan_urls: Vec<String>,
    /// Host the engine is bound to ("0.0.0.0" = all interfaces, "127.0.0.1" = localhost only).
    pub bind: String,
    pub error: Option<String>,
}

fn default_method() -> HttpMethod {
    HttpMethod::Get
}
fn default_true() -> bool {
    true
}
fn default_status() -> u16 {
    200
}