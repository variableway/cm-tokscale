//! Kimi Code CLI (Moonshot AI) session parser
//!
//! Parses wire.jsonl files from ~/.kimi/sessions/<md5_hash>/<session_id>/
//!
//! Token usage is recorded in `StatusUpdate` wire messages with fields:
//!   - input_other: non-cached input tokens
//!   - output: output tokens
//!   - input_cache_read: cached input tokens
//!   - input_cache_creation: cache write tokens (Anthropic-style)
//!
//! Model name is NOT stored in session files. We extract it from context.jsonl
//! when possible, or default to "kimi-k2-5".

use super::UnifiedMessage;
use crate::TokenBreakdown;
use serde::Deserialize;
use std::path::Path;

/// Wire message wrapper
#[derive(Debug, Deserialize)]
struct WireRecord {
    timestamp: Option<f64>,
    message: Option<WireMessage>,
}

#[derive(Debug, Deserialize)]
struct WireMessage {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    payload: Option<serde_json::Value>,
}

/// Token usage from StatusUpdate payload
#[derive(Debug, Deserialize)]
struct KimiTokenUsage {
    #[serde(rename = "input_other")]
    input_other: Option<i64>,
    output: Option<i64>,
    #[serde(rename = "input_cache_read")]
    input_cache_read: Option<i64>,
    #[serde(rename = "input_cache_creation")]
    input_cache_creation: Option<i64>,
}

/// Context.jsonl record types
#[derive(Debug, Deserialize)]
struct ContextRecord {
    role: Option<String>,
    #[serde(rename = "modelName")]
    model_name: Option<String>,
}

fn get_provider_from_model(model: &str) -> &'static str {
    let model_lower = model.to_lowercase();
    if model_lower.contains("claude")
        || model_lower.contains("opus")
        || model_lower.contains("sonnet")
        || model_lower.contains("haiku")
    {
        return "anthropic";
    }
    if model_lower.contains("gpt") || model_lower.contains("o1") || model_lower.contains("o3") {
        return "openai";
    }
    if model_lower.contains("gemini") {
        return "google";
    }
    if model_lower.contains("deepseek") {
        return "deepseek";
    }
    // Default to moonshot for Kimi models
    "moonshot"
}

/// Try to extract model name from config.toml or context.jsonl
fn extract_model(wire_path: &Path) -> Option<String> {
    // Try config.toml: walk up to find the kimi share dir (parent of sessions/)
    // Path: ~/.kimi/sessions/<hash>/<session>/wire.jsonl -> ~/.kimi/config.toml
    let sessions_dir = wire_path.parent()?; // <session>/
    let hash_dir = sessions_dir.parent()?; // <hash>/
    let kimi_dir: &Path = hash_dir.parent()?; // sessions/

    let config_path = kimi_dir.join("config.toml");
    if let Ok(content) = std::fs::read_to_string(&config_path) {
        // Parse default_model = "kimi-code/kimi-for-coding"
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("default_model") {
                if let Some(eq_pos) = trimmed.find('=') {
                    let value = trimmed[eq_pos + 1..].trim().trim_matches('"');
                    if !value.is_empty() {
                        // Extract the model part after "/" if present
                        if let Some(slash_pos) = value.rfind('/') {
                            return Some(value[slash_pos + 1..].to_string());
                        }
                        return Some(value.to_string());
                    }
                }
            }
        }
    }

    // Fallback: try context.jsonl
    let context_path = sessions_dir.join("context.jsonl");
    if let Ok(content) = std::fs::read_to_string(&context_path) {
        for mut line in content.lines().map(String::from) {
            if let Ok(record) = unsafe { simd_json::from_str::<ContextRecord>(&mut line) } {
                if let Some(model) = record.model_name {
                    if !model.is_empty() {
                        return Some(model);
                    }
                }
            }
        }
    }

    None
}

/// Extract session ID from the file path
/// Path structure: ~/.kimi/sessions/<workdir_hash>/<session_id>/wire.jsonl
fn extract_session_id(path: &Path) -> String {
    path.parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

/// Parse a Kimi wire.jsonl file
pub fn parse_kimi_file(path: &Path) -> Vec<UnifiedMessage> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let session_id = extract_session_id(path);
    let model_name =
        extract_model(path).unwrap_or_else(|| "kimi-2.6".to_string());
    let provider = get_provider_from_model(&model_name);

    let mut messages = Vec::new();

    for line in content.lines() {
        let mut line_owned = line.to_string();
        let record: WireRecord = match unsafe { simd_json::from_str(&mut line_owned) } {
            Ok(r) => r,
            Err(_) => continue,
        };

        let message = match record.message {
            Some(m) => m,
            None => continue,
        };

        if message.msg_type.as_deref() != Some("StatusUpdate") {
            continue;
        }

        let payload = match message.payload {
            Some(p) => p,
            None => continue,
        };

        let token_usage_value = match payload.get("token_usage") {
            Some(v) => v,
            None => continue,
        };

        let usage: KimiTokenUsage = match serde_json::from_value(token_usage_value.clone()) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let input_other = usage.input_other.unwrap_or(0).max(0);
        let output = usage.output.unwrap_or(0).max(0);
        let cache_read = usage.input_cache_read.unwrap_or(0).max(0);
        let cache_write = usage.input_cache_creation.unwrap_or(0).max(0);

        // Skip records with no tokens
        if input_other == 0 && output == 0 && cache_read == 0 && cache_write == 0 {
            continue;
        }

        let timestamp_secs = record.timestamp.unwrap_or(0.0);
        let timestamp_ms = (timestamp_secs * 1000.0) as i64;

        // Use message_id from payload for dedup if available
        let message_id = payload
            .get("message_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let dedup_key = message_id.map(|id| format!("kimi:{}:{}", session_id, id));

        messages.push(UnifiedMessage::new_with_dedup(
            "kimi",
            &model_name,
            provider,
            &session_id,
            timestamp_ms,
            TokenBreakdown {
                input: input_other,
                output,
                cache_read,
                cache_write,
                reasoning: 0,
            },
            0.0, // Cost calculated by pricing service later
            dedup_key,
        ));
    }

    // Deduplicate by message_id
    let mut seen = std::collections::HashSet::new();
    messages.retain(|msg| {
        if let Some(ref key) = msg.dedup_key {
            seen.insert(key.clone())
        } else {
            true
        }
    });

    messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_wire_file(dir: &std::path::Path, records: &[&str]) -> std::path::PathBuf {
        let wire_path = dir.join("wire.jsonl");
        fs::write(&wire_path, records.join("\n")).unwrap();
        wire_path
    }

    #[test]
    fn test_parse_kimi_file_basic() {
        let dir = TempDir::new().unwrap();
        let session_dir = dir.path().join("abc123").join("session-001");
        fs::create_dir_all(&session_dir).unwrap();

        let records = vec![
            r#"{"timestamp":1701388800.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":5000,"output":1000,"input_cache_read":2000,"input_cache_creation":100},"message_id":"msg_001"}}}"#,
        ];

        let wire_path = create_wire_file(&session_dir, &records);
        let messages = parse_kimi_file(&wire_path);

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].source, "kimi");
        assert_eq!(messages[0].session_id, "session-001");
        assert_eq!(messages[0].model_id, "kimi-2.6");
        assert_eq!(messages[0].provider_id, "moonshot");
        assert_eq!(messages[0].tokens.input, 5000);
        assert_eq!(messages[0].tokens.output, 1000);
        assert_eq!(messages[0].tokens.cache_read, 2000);
        assert_eq!(messages[0].tokens.cache_write, 100);
    }

    #[test]
    fn test_parse_kimi_file_skips_non_status_update() {
        let dir = TempDir::new().unwrap();
        let session_dir = dir.path().join("abc123").join("session-002");
        fs::create_dir_all(&session_dir).unwrap();

        let records = vec![
            r#"{"timestamp":1701388800.0,"message":{"type":"TurnBegin","payload":{}}}"#,
            r#"{"timestamp":1701388801.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":3000,"output":500,"input_cache_read":0,"input_cache_creation":0}}}}"#,
        ];

        let wire_path = create_wire_file(&session_dir, &records);
        let messages = parse_kimi_file(&wire_path);

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].tokens.input, 3000);
    }

    #[test]
    fn test_parse_kimi_file_empty() {
        let dir = TempDir::new().unwrap();
        let session_dir = dir.path().join("abc123").join("session-003");
        fs::create_dir_all(&session_dir).unwrap();

        let wire_path = create_wire_file(&session_dir, &[]);
        let messages = parse_kimi_file(&wire_path);

        assert!(messages.is_empty());
    }

    #[test]
    fn test_parse_kimi_file_dedup() {
        let dir = TempDir::new().unwrap();
        let session_dir = dir.path().join("abc123").join("session-004");
        fs::create_dir_all(&session_dir).unwrap();

        let records = vec![
            r#"{"timestamp":1701388800.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":1000,"output":200,"input_cache_read":0,"input_cache_creation":0},"message_id":"msg_dup"}}}"#,
            r#"{"timestamp":1701388801.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":2000,"output":300,"input_cache_read":0,"input_cache_creation":0},"message_id":"msg_dup"}}}"#,
            r#"{"timestamp":1701388802.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":3000,"output":400,"input_cache_read":0,"input_cache_creation":0},"message_id":"msg_unique"}}}"#,
        ];

        let wire_path = create_wire_file(&session_dir, &records);
        let messages = parse_kimi_file(&wire_path);

        assert_eq!(messages.len(), 2);
    }

    #[test]
    fn test_parse_kimi_file_skips_zero_tokens() {
        let dir = TempDir::new().unwrap();
        let session_dir = dir.path().join("abc123").join("session-005");
        fs::create_dir_all(&session_dir).unwrap();

        let records = vec![
            r#"{"timestamp":1701388800.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":0,"output":0,"input_cache_read":0,"input_cache_creation":0}}}}"#,
            r#"{"timestamp":1701388801.0,"message":{"type":"StatusUpdate","payload":{"token_usage":{"input_other":100,"output":50,"input_cache_read":0,"input_cache_creation":0}}}}"#,
        ];

        let wire_path = create_wire_file(&session_dir, &records);
        let messages = parse_kimi_file(&wire_path);

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].tokens.input, 100);
    }

    #[test]
    fn test_get_provider_from_model() {
        assert_eq!(get_provider_from_model("kimi-k2-5"), "moonshot");
        assert_eq!(get_provider_from_model("claude-3-5-sonnet"), "anthropic");
        assert_eq!(get_provider_from_model("gpt-4o"), "openai");
        assert_eq!(get_provider_from_model("gemini-2.0-flash"), "google");
        assert_eq!(get_provider_from_model("deepseek-v3"), "deepseek");
    }

    #[test]
    fn test_extract_session_id() {
        let path = std::path::PathBuf::from("/home/.kimi/sessions/abc123/session-uuid-001/wire.jsonl");
        assert_eq!(extract_session_id(&path), "session-uuid-001");
    }
}
