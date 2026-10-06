//! Explicit, revocable read-only grants for the external Node companion.
//! Roots originate in native app state; tokens are returned once and only
//! their SHA-256 hashes are persisted. A missing manifest grants no access.

use base64::Engine;
use fs2::FileExt;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

const VERSION: u8 = 1;
const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
const MAX_GRANTS: usize = 128;
const MAX_DOCUMENT_IDS: usize = 1000;
const MAX_DOCUMENT_ID_BYTES: usize = 4096;
const MAX_ANNOTATION_BYTES: usize = 16 * 1024 * 1024;
const MAX_ANNOTATIONS: usize = 2000;
const DOCUMENTS_SCOPE: &str = "documents:read";
const ANNOTATIONS_SCOPE: &str = "annotations:read";

pub struct AgentAccess {
    directory: PathBuf,
    lock: Mutex<()>,
}

impl AgentAccess {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            lock: Mutex::new(()),
        }
    }

    fn paths(&self) -> Result<AccessPaths, String> {
        let directory = ensure_directory(&self.directory)?;
        let managed_root = ensure_directory(&directory.join("content-v1"))?;
        Ok(AccessPaths {
            manifest: directory.join("agent-access-v1.json"),
            lock: directory.join("agent-access-v1.lock"),
            managed_root,
        })
    }

    fn with_manifest<T>(
        &self,
        operation: impl FnOnce(&AccessPaths, AccessManifest) -> Result<T, String>,
    ) -> Result<T, String> {
        self.with_paths(|paths| operation(paths, read_manifest(paths)?))
    }

    fn with_paths<T>(
        &self,
        operation: impl FnOnce(&AccessPaths) -> Result<T, String>,
    ) -> Result<T, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Agent access is unavailable.")?;
        let paths = self.paths()?;
        let _file_lock = lock_manifest(&paths.lock)?;
        operation(&paths)
    }
}

struct AccessPaths {
    manifest: PathBuf,
    lock: PathBuf,
    managed_root: PathBuf,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AccessManifest {
    version: u8,
    grants: Vec<StoredGrant>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredGrant {
    id: String,
    name: String,
    token_hash: String,
    managed_root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    vault_root: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    annotation_root: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    document_ids: Option<Vec<String>>,
    include_drafts: bool,
    scopes: Vec<String>,
    created_at: String,
}

/// Public grant metadata never includes the token or its stored hash.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAccessGrant {
    id: String,
    name: String,
    managed_root: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    vault_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    annotation_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    document_ids: Option<Vec<String>>,
    include_drafts: bool,
    scopes: Vec<String>,
    created_at: String,
}

impl From<StoredGrant> for AgentAccessGrant {
    fn from(grant: StoredGrant) -> Self {
        Self {
            id: grant.id,
            name: grant.name,
            managed_root: grant.managed_root,
            vault_root: grant.vault_root,
            annotation_root: grant.annotation_root,
            document_ids: grant.document_ids,
            include_drafts: grant.include_drafts,
            scopes: grant.scopes,
            created_at: grant.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateAgentAccessGrant {
    name: String,
    #[serde(default)]
    document_ids: Option<Vec<String>>,
    #[serde(default)]
    include_drafts: bool,
    #[serde(default)]
    vault_root: Option<String>,
    #[serde(default = "default_scopes")]
    scopes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAccessManifestInfo {
    manifest_path: String,
    managed_root: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    available_vault_root: Option<String>,
    server_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedAgentAccessGrant {
    grant: AgentAccessGrant,
    token: String,
    manifest_path: String,
    server_path: String,
}

#[derive(Debug, Serialize)]
pub struct RevokedAgentAccessGrant {
    revoked: bool,
}

fn default_scopes() -> Vec<String> {
    vec![DOCUMENTS_SCOPE.to_owned()]
}

fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}

fn ensure_directory(path: &Path) -> Result<PathBuf, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if is_link(&metadata) || !metadata.is_dir() => {
            return Err("Agent access directories must be real directories.".into());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(path)
                .map_err(|error| format!("Could not create agent access directory: {error}"))?;
        }
        Err(error) => return Err(format!("Could not inspect agent access directory: {error}")),
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect agent access directory: {error}"))?;
    if is_link(&metadata) || !metadata.is_dir() {
        return Err("Agent access directories must be real directories.".into());
    }
    fs::canonicalize(path)
        .map_err(|error| format!("Could not resolve agent access directory: {error}"))
}

fn lock_manifest(path: &Path) -> Result<fs::File, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if is_link(&metadata) || !metadata.is_file() || metadata.len() != 0 => {
            return Err("Agent access lock must be an empty regular file.".into());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not inspect agent access lock: {error}")),
    }
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(false).read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let file = options
        .open(path)
        .map_err(|error| format!("Could not open agent access lock: {error}"))?;
    file.lock_exclusive()
        .map_err(|error| format!("Could not lock agent access grants: {error}"))?;
    Ok(file)
}

fn validate_name(name: &str) -> Result<(), String> {
    if name.trim() != name
        || name.is_empty()
        || name.chars().count() > 120
        || name.chars().any(char::is_control)
    {
        return Err("Use a client name with 1 to 120 characters and no control characters.".into());
    }
    Ok(())
}

fn validate_scope(scopes: &[String]) -> Result<(), String> {
    let unique: HashSet<_> = scopes.iter().map(String::as_str).collect();
    if !unique.contains(DOCUMENTS_SCOPE)
        || unique.len() != scopes.len()
        || unique
            .iter()
            .any(|scope| *scope != DOCUMENTS_SCOPE && *scope != ANNOTATIONS_SCOPE)
    {
        return Err("Grants require documents:read and may also include annotations:read.".into());
    }
    Ok(())
}

fn validate_document_ids(ids: Option<&[String]>, has_vault: bool) -> Result<(), String> {
    let Some(ids) = ids else { return Ok(()) };
    if ids.is_empty() || ids.len() > MAX_DOCUMENT_IDS {
        return Err("Select 1 to 1,000 documents, or choose all saved documents.".into());
    }
    let mut seen = HashSet::new();
    for id in ids {
        let valid_prefix = id
            .strip_prefix("managed:")
            .is_some_and(|suffix| !suffix.is_empty())
            || (has_vault
                && id
                    .strip_prefix("vault:")
                    .is_some_and(|suffix| !suffix.is_empty()));
        if !valid_prefix
            || id.len() > MAX_DOCUMENT_ID_BYTES
            || id.chars().any(char::is_control)
            || !seen.insert(id)
        {
            return Err(
                "Selected documents must have unique managed or authorized vault IDs.".into(),
            );
        }
    }
    Ok(())
}

fn validate_manifest(manifest: &AccessManifest, paths: &AccessPaths) -> Result<(), String> {
    if manifest.version != VERSION || manifest.grants.len() > MAX_GRANTS {
        return Err("Agent access manifest has an unsupported version or too many grants.".into());
    }
    let managed_root = super::path_as_utf8(&paths.managed_root)?;
    let mut seen = HashSet::new();
    for grant in &manifest.grants {
        validate_name(&grant.name)?;
        validate_scope(&grant.scopes)?;
        validate_document_ids(grant.document_ids.as_deref(), grant.vault_root.is_some())?;
        if !grant.id.starts_with("client-")
            || grant.id.len() != 39
            || !grant.id[7..].bytes().all(|byte| byte.is_ascii_hexdigit())
            || !seen.insert(&grant.id)
            || grant.token_hash.len() != 64
            || !grant
                .token_hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || grant.managed_root != managed_root
            || grant
                .vault_root
                .as_ref()
                .is_some_and(|root| !Path::new(root).is_absolute())
            || grant.annotation_root.as_ref().is_some_and(|root| {
                !Path::new(root).is_absolute()
                    || !grant.scopes.iter().any(|scope| scope == ANNOTATIONS_SCOPE)
            })
            || grant.created_at.len() != 24
            || !grant.created_at.ends_with('Z')
        {
            return Err("Agent access manifest contains an invalid grant.".into());
        }
    }
    Ok(())
}

fn read_manifest(paths: &AccessPaths) -> Result<AccessManifest, String> {
    match fs::symlink_metadata(&paths.manifest) {
        Ok(metadata) if is_link(&metadata) || !metadata.is_file() => {
            return Err("Agent access manifest must be a regular file.".into());
        }
        Ok(metadata) if metadata.len() > MAX_MANIFEST_BYTES as u64 => {
            return Err("Agent access manifest exceeds the 1 MiB limit.".into());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(AccessManifest {
                version: VERSION,
                grants: Vec::new(),
            });
        }
        Err(error) => return Err(format!("Could not inspect agent access manifest: {error}")),
    }
    let file = fs::File::open(&paths.manifest)
        .map_err(|error| format!("Could not read agent access manifest: {error}"))?;
    let mut bytes = Vec::new();
    file.take((MAX_MANIFEST_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read agent access manifest: {error}"))?;
    if bytes.len() > MAX_MANIFEST_BYTES {
        return Err("Agent access manifest exceeds the 1 MiB limit.".into());
    }
    let manifest = serde_json::from_slice(&bytes)
        .map_err(|_| "Agent access manifest is malformed; no access has been granted.")?;
    validate_manifest(&manifest, paths)?;
    Ok(manifest)
}

fn persist_manifest(paths: &AccessPaths, manifest: &AccessManifest) -> Result<(), String> {
    validate_manifest(manifest, paths)?;
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not encode agent access grants: {error}"))?;
    if bytes.len() > MAX_MANIFEST_BYTES {
        return Err("Agent access manifest exceeds the 1 MiB limit.".into());
    }
    super::atomic_write(&paths.manifest, &bytes)
}

fn random_hex<const N: usize>() -> Result<String, String> {
    let mut bytes = [0; N];
    OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|_| "Secure random credentials are unavailable; no access has been granted.")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn new_credential() -> Result<(String, String), String> {
    let mut bytes = [0; 32];
    OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|_| "Secure random credentials are unavailable; no access has been granted.")?;
    let token = format!(
        "va1_{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
    );
    let hash = Sha256::digest(token.as_bytes());
    Ok((
        token,
        hash.iter().map(|byte| format!("{byte:02x}")).collect(),
    ))
}

fn now_iso() -> String {
    let now = time::OffsetDateTime::now_utc();
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        now.year(),
        now.month() as u8,
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
        now.millisecond()
    )
}

fn create_grant(
    access: &AgentAccess,
    mut input: CreateAgentAccessGrant,
    vault_root: Option<PathBuf>,
    annotation_root: Option<PathBuf>,
    server_path: String,
) -> Result<CreatedAgentAccessGrant, String> {
    input.name = input.name.trim().to_owned();
    validate_name(&input.name)?;
    validate_scope(&input.scopes)?;
    validate_document_ids(input.document_ids.as_deref(), vault_root.is_some())?;
    input.scopes.sort();
    let (token, token_hash) = new_credential()?;
    let id = format!("client-{}", random_hex::<16>()?);
    access.with_manifest(|paths, mut manifest| {
        if manifest.grants.len() >= MAX_GRANTS {
            return Err("Revoke an existing client before creating another grant.".into());
        }
        let grant = StoredGrant {
            id,
            name: input.name,
            token_hash,
            managed_root: super::path_as_utf8(&paths.managed_root)?,
            vault_root: vault_root.as_deref().map(super::path_as_utf8).transpose()?,
            annotation_root: annotation_root
                .as_deref()
                .map(super::path_as_utf8)
                .transpose()?,
            document_ids: input.document_ids,
            include_drafts: input.include_drafts,
            scopes: input.scopes,
            created_at: now_iso(),
        };
        manifest.grants.push(grant.clone());
        persist_manifest(paths, &manifest)?;
        Ok(CreatedAgentAccessGrant {
            grant: grant.into(),
            token,
            manifest_path: super::path_as_utf8(&paths.manifest)?,
            server_path,
        })
    })
}

fn revoke_grant(access: &AgentAccess, id: &str) -> Result<RevokedAgentAccessGrant, String> {
    access.with_manifest(|paths, mut manifest| {
        let count = manifest.grants.len();
        manifest.grants.retain(|grant| grant.id != id);
        let revoked = manifest.grants.len() != count;
        if revoked {
            persist_manifest(paths, &manifest)?;
        }
        Ok(RevokedAgentAccessGrant { revoked })
    })
}

fn companion_path(app: &tauri::AppHandle) -> Result<String, String> {
    let packaged = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not locate the agent companion: {error}"))?
        .join("mcp/verto-mcp.mjs");
    if packaged.is_file() {
        return super::path_as_utf8(&packaged);
    }
    if cfg!(debug_assertions) {
        return super::path_as_utf8(
            &PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/mcp/verto-mcp.mjs"),
        );
    }
    Err("The packaged agent companion is missing. Reinstall Verto before granting access.".into())
}

fn annotation_root_for(
    roots: &super::AuthorizedRoots,
    scopes: &[String],
) -> Result<Option<PathBuf>, String> {
    if !scopes.iter().any(|scope| scope == ANNOTATIONS_SCOPE) {
        return Ok(None);
    }
    let active = roots
        .inner
        .lock()
        .map_err(|_| "Local libraries are unavailable.")?
        .active
        .clone();
    active
        .map(|root| super::authorized_active_root(roots, &super::path_as_utf8(&root)?))
        .transpose()
}

#[tauri::command]
pub(super) fn get_agent_access_manifest_info(
    app: tauri::AppHandle,
    access: State<'_, AgentAccess>,
    roots: State<'_, super::AuthorizedRoots>,
) -> Result<AgentAccessManifestInfo, String> {
    let server_path = companion_path(&app)?;
    let active = roots
        .inner
        .lock()
        .map_err(|_| "Local libraries are unavailable.")?
        .active
        .clone();
    let available_vault_root = active
        .and_then(|root| super::path_as_utf8(&root).ok())
        .and_then(|root| super::authorized_active_root(&roots, &root).ok())
        .map(|root| super::path_as_utf8(&root))
        .transpose()?;
    access.with_manifest(|paths, _| {
        Ok(AgentAccessManifestInfo {
            manifest_path: super::path_as_utf8(&paths.manifest)?,
            managed_root: super::path_as_utf8(&paths.managed_root)?,
            available_vault_root,
            server_path,
        })
    })
}

#[tauri::command]
pub(super) fn list_agent_access_grants(
    access: State<'_, AgentAccess>,
) -> Result<Vec<AgentAccessGrant>, String> {
    access.with_manifest(|_, manifest| Ok(manifest.grants.into_iter().map(Into::into).collect()))
}

#[tauri::command]
pub(super) fn create_agent_access_grant(
    app: tauri::AppHandle,
    access: State<'_, AgentAccess>,
    roots: State<'_, super::AuthorizedRoots>,
    input: CreateAgentAccessGrant,
) -> Result<CreatedAgentAccessGrant, String> {
    let vault_root = input
        .vault_root
        .as_ref()
        .map(|root| super::authorized_active_root(&roots, root))
        .transpose()?;
    let annotation_root = annotation_root_for(&roots, &input.scopes)?;
    create_grant(
        &access,
        input,
        vault_root,
        annotation_root,
        companion_path(&app)?,
    )
}

#[tauri::command]
pub(super) fn revoke_agent_access_grant(
    access: State<'_, AgentAccess>,
    id: String,
) -> Result<RevokedAgentAccessGrant, String> {
    revoke_grant(&access, &id)
}

fn validate_annotations(value: &serde_json::Value) -> Result<(), String> {
    let annotations = value
        .as_object()
        .and_then(|state| state.get("annotations"))
        .and_then(serde_json::Value::as_array)
        .ok_or("Annotation state must contain an annotations array.")?;
    if annotations.len() > MAX_ANNOTATIONS {
        return Err("Annotation state exceeds the 2,000 annotation limit.".into());
    }
    let nonempty_string = |value: Option<&serde_json::Value>| {
        value
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
    };
    let mut ids = HashSet::new();
    for annotation in annotations {
        let entry = annotation
            .as_object()
            .ok_or("Annotation entries must be objects.")?;
        if !nonempty_string(entry.get("id"))
            || !nonempty_string(entry.get("docSlug"))
            || !nonempty_string(entry.get("quote"))
            || !ids.insert(entry["id"].as_str().unwrap())
        {
            return Err(
                "Annotation entries require unique IDs, document references and quotes.".into(),
            );
        }
        let anchor = entry
            .get("anchor")
            .and_then(serde_json::Value::as_object)
            .ok_or("Annotation entries require passage anchors.")?;
        if !nonempty_string(anchor.get("quote"))
            || anchor
                .get("prefix")
                .and_then(serde_json::Value::as_str)
                .is_none()
            || anchor
                .get("suffix")
                .and_then(serde_json::Value::as_str)
                .is_none()
            || anchor
                .get("start")
                .and_then(serde_json::Value::as_u64)
                .map_or(true, |start| start > 9_007_199_254_740_991)
        {
            return Err("Annotation passage anchors are invalid.".into());
        }
        if let Some(turns) = entry.get("turns") {
            let turns = turns
                .as_array()
                .ok_or("Annotation turns must be an array.")?;
            for turn in turns {
                let turn = turn
                    .as_object()
                    .ok_or("Annotation turns must be objects.")?;
                if !nonempty_string(turn.get("id"))
                    || !matches!(
                        turn.get("author").and_then(serde_json::Value::as_str),
                        Some("human" | "ai")
                    )
                    || turn
                        .get("body")
                        .and_then(serde_json::Value::as_str)
                        .is_none()
                {
                    return Err("Annotation turns require an ID, author and body.".into());
                }
            }
        } else if entry
            .get("note")
            .and_then(serde_json::Value::as_str)
            .is_none()
        {
            return Err("Annotation entries require turns or a legacy note.".into());
        }
    }
    Ok(())
}

fn read_annotations(access: &AgentAccess) -> Result<Option<serde_json::Value>, String> {
    access.with_paths(|paths| {
        let path = paths.managed_root.join("annotations.json");
        match fs::symlink_metadata(&path) {
            Ok(metadata) if is_link(&metadata) || !metadata.is_file() => {
                return Err("Annotation state must be a regular file.".into());
            }
            Ok(metadata) if metadata.len() > MAX_ANNOTATION_BYTES as u64 => {
                return Err("Annotation state exceeds the 16 MiB limit.".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("Could not inspect annotation state: {error}")),
        }
        let file = fs::File::open(&path)
            .map_err(|error| format!("Could not read annotation state: {error}"))?;
        let mut bytes = Vec::new();
        file.take((MAX_ANNOTATION_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Could not read annotation state: {error}"))?;
        if bytes.len() > MAX_ANNOTATION_BYTES {
            return Err("Annotation state exceeds the 16 MiB limit.".into());
        }
        let value = serde_json::from_slice(&bytes)
            .map_err(|_| "Annotation state is malformed; its previous contents were preserved.")?;
        validate_annotations(&value)?;
        Ok(Some(value))
    })
}

fn write_annotations(access: &AgentAccess, value: serde_json::Value) -> Result<(), String> {
    validate_annotations(&value)?;
    let bytes = serde_json::to_vec(&value)
        .map_err(|error| format!("Could not encode annotation state: {error}"))?;
    if bytes.len() > MAX_ANNOTATION_BYTES {
        return Err("Annotation state exceeds the 16 MiB limit.".into());
    }
    access.with_paths(|paths| {
        let path = paths.managed_root.join("annotations.json");
        match fs::symlink_metadata(&path) {
            Ok(metadata) if is_link(&metadata) || !metadata.is_file() => {
                return Err("Annotation state must be a regular file.".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Could not inspect annotation state: {error}")),
        }
        super::atomic_write(&path, &bytes)
    })
}

#[tauri::command]
pub(super) fn read_agent_annotations(
    access: State<'_, AgentAccess>,
) -> Result<Option<serde_json::Value>, String> {
    read_annotations(&access)
}

#[tauri::command]
pub(super) fn write_agent_annotations(
    access: State<'_, AgentAccess>,
    value: serde_json::Value,
) -> Result<(), String> {
    write_annotations(&access, value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> CreateAgentAccessGrant {
        serde_json::from_str(r#"{"name":"Local research client"}"#).unwrap()
    }

    fn create(access: &AgentAccess) -> CreatedAgentAccessGrant {
        create_grant(access, input(), None, None, "test-companion.mjs".into()).unwrap()
    }

    fn annotation() -> serde_json::Value {
        serde_json::json!({"annotations":[{
            "id":"test-note", "docSlug":"browser/test-document", "quote":"A passage",
            "anchor":{"quote":"A passage", "prefix":"", "suffix":"", "start":12},
            "turns":[{"id":"test-turn","author":"human","body":"A private note"}],
            "color":"yellow", "createdAt":"2026-10-06T12:00:00.000Z", "updatedAt":"2026-10-06T12:00:00.000Z"
        }]})
    }

    #[test]
    fn native_annotation_storage_is_fixed_atomic_and_independent_of_external_grants() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        assert!(read_annotations(&access).unwrap().is_none());
        let value = annotation();
        write_annotations(&access, value.clone()).unwrap();
        assert_eq!(read_annotations(&access).unwrap(), Some(value.clone()));
        fs::write(
            access.paths().unwrap().manifest,
            "invalid external grant file",
        )
        .unwrap();
        assert_eq!(read_annotations(&access).unwrap(), Some(value));
        write_annotations(&access, serde_json::json!({"annotations":[]})).unwrap();
        assert_eq!(
            read_annotations(&access).unwrap(),
            Some(serde_json::json!({"annotations":[]}))
        );
        assert!(directory
            .path()
            .join("content-v1/annotations.json")
            .is_file());
    }

    #[test]
    fn malformed_and_oversized_annotation_writes_preserve_previous_state() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        write_annotations(&access, annotation()).unwrap();
        for invalid in [
            serde_json::json!([]),
            serde_json::json!({"annotations":null}),
            serde_json::json!({"annotations":[{"id":"invalid"}]}),
        ] {
            assert!(write_annotations(&access, invalid).is_err());
            assert_eq!(read_annotations(&access).unwrap(), Some(annotation()));
        }
        let mut huge = annotation();
        huge["annotations"][0]["turns"][0]["body"] = "x".repeat(MAX_ANNOTATION_BYTES).into();
        assert!(write_annotations(&access, huge).is_err());
        assert_eq!(read_annotations(&access).unwrap(), Some(annotation()));
    }

    #[test]
    fn malformed_annotation_reads_fail_and_legacy_notes_remain_migratable() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let path = access
            .paths()
            .unwrap()
            .managed_root
            .join("annotations.json");
        fs::write(&path, "not JSON").unwrap();
        assert!(read_annotations(&access).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "not JSON");
        let mut legacy = annotation();
        legacy["annotations"][0]
            .as_object_mut()
            .unwrap()
            .remove("turns");
        legacy["annotations"][0]["note"] = "Legacy note".into();
        write_annotations(&access, legacy.clone()).unwrap();
        assert_eq!(read_annotations(&access).unwrap(), Some(legacy));
    }

    #[test]
    fn absent_manifest_denies_access_and_creates_only_known_managed_directory() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        access
            .with_manifest(|paths, manifest| {
                assert!(manifest.grants.is_empty());
                assert!(!paths.manifest.exists());
                assert_eq!(
                    paths.managed_root,
                    fs::canonicalize(directory.path().join("content-v1")).unwrap()
                );
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn secure_token_is_returned_once_and_only_hash_persists() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let first = create(&access);
        let second = create(&access);
        assert_ne!(first.token, second.token);
        assert_ne!(first.grant.id, second.grant.id);
        assert_eq!(first.token.len(), 47);
        assert!(first.token.starts_with("va1_"));
        assert!(!first.grant.include_drafts);
        assert_eq!(first.grant.scopes, default_scopes());
        assert!(first.grant.document_ids.is_none());
        let raw = fs::read_to_string(&first.manifest_path).unwrap();
        assert!(!raw.contains(&first.token));
        let manifest: AccessManifest = serde_json::from_str(&raw).unwrap();
        let hash: String = Sha256::digest(first.token.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(manifest.grants[0].token_hash, hash);
        let public =
            serde_json::to_value(AgentAccessGrant::from(manifest.grants[0].clone())).unwrap();
        assert!(public.get("token").is_none());
        assert!(public.get("tokenHash").is_none());
        assert!(public.get("includeDrafts").is_some());
    }

    #[test]
    fn selected_documents_drafts_and_annotations_require_explicit_options() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let mut options = input();
        options.document_ids = Some(vec!["managed:chosen-note".into()]);
        options.include_drafts = true;
        options.scopes.push(ANNOTATIONS_SCOPE.into());
        let result = create_grant(&access, options, None, None, "server.mjs".into()).unwrap();
        assert_eq!(
            result.grant.document_ids,
            Some(vec!["managed:chosen-note".into()])
        );
        assert!(result.grant.include_drafts);
        assert!(result
            .grant
            .scopes
            .iter()
            .any(|scope| scope == ANNOTATIONS_SCOPE));
        assert!(validate_scope(&["documents:write".into()]).is_err());
        assert!(validate_scope(&[DOCUMENTS_SCOPE.into(), "files:read".into()]).is_err());
        assert!(validate_scope(&[DOCUMENTS_SCOPE.into(), DOCUMENTS_SCOPE.into()]).is_err());
        assert!(validate_document_ids(Some(&[]), false).is_err());
        assert!(validate_document_ids(Some(&["/private/file.md".into()]), false).is_err());
        assert!(validate_document_ids(Some(&["vault:root:path".into()]), false).is_err());
        assert!(serde_json::from_str::<CreateAgentAccessGrant>(
            r#"{"name":"client","managedRoot":"/private"}"#
        )
        .is_err());
    }

    #[test]
    fn revoke_removes_grant_and_preserves_other_clients() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let first = create(&access);
        let second = create(&access);
        assert!(revoke_grant(&access, &first.grant.id).unwrap().revoked);
        assert!(!revoke_grant(&access, &first.grant.id).unwrap().revoked);
        access
            .with_manifest(|_, manifest| {
                assert_eq!(manifest.grants.len(), 1);
                assert_eq!(manifest.grants[0].id, second.grant.id);
                assert!(manifest
                    .grants
                    .iter()
                    .all(|grant| grant.token_hash != first.token));
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn malformed_unknown_version_and_missing_scope_manifests_fail_closed() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let paths = access.paths().unwrap();
        for raw in [
            "not JSON",
            r#"{"version":2,"grants":[]}"#,
            r#"{"version":1,"grants":[],"allowAll":true}"#,
        ] {
            fs::write(&paths.manifest, raw).unwrap();
            assert!(access
                .with_manifest(|_, manifest| Ok(manifest.grants.len()))
                .is_err());
            assert!(revoke_grant(&access, "anything").is_err());
            assert!(create_grant(&access, input(), None, None, "server.mjs".into()).is_err());
            assert_eq!(fs::read_to_string(&paths.manifest).unwrap(), raw);
        }
        fs::remove_file(&paths.manifest).unwrap();
        create(&access);
        let mut raw: serde_json::Value =
            serde_json::from_slice(&fs::read(&paths.manifest).unwrap()).unwrap();
        raw["grants"][0].as_object_mut().unwrap().remove("scopes");
        fs::write(&paths.manifest, serde_json::to_vec(&raw).unwrap()).unwrap();
        assert!(access
            .with_manifest(|_, manifest| Ok(manifest.grants.len()))
            .is_err());
    }

    #[test]
    fn oversized_manifest_and_nonregular_paths_fail_closed() {
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let paths = access.paths().unwrap();
        fs::write(&paths.manifest, vec![b' '; MAX_MANIFEST_BYTES + 1]).unwrap();
        assert!(access
            .with_manifest(|_, manifest| Ok(manifest.grants.len()))
            .is_err());
        fs::remove_file(&paths.manifest).unwrap();
        fs::create_dir(&paths.manifest).unwrap();
        assert!(access
            .with_manifest(|_, manifest| Ok(manifest.grants.len()))
            .is_err());
        fs::remove_dir(&paths.manifest).unwrap();
        fs::write(&paths.lock, "not an empty lock").unwrap();
        assert!(access
            .with_manifest(|_, manifest| Ok(manifest.grants.len()))
            .is_err());
    }

    #[test]
    fn separate_native_instances_serialize_without_lost_grants() {
        let directory = tempfile::tempdir().unwrap();
        let threads: Vec<_> = (0..8)
            .map(|_| {
                let path = directory.path().to_path_buf();
                std::thread::spawn(move || create(&AgentAccess::new(path)).grant.id)
            })
            .collect();
        let ids: HashSet<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(ids.len(), 8);
        AgentAccess::new(directory.path().to_path_buf())
            .with_manifest(|_, manifest| {
                assert_eq!(manifest.grants.len(), 8);
                assert_eq!(
                    manifest
                        .grants
                        .into_iter()
                        .map(|grant| grant.id)
                        .collect::<HashSet<_>>(),
                    ids
                );
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn vault_roots_must_be_native_authorized_and_currently_selected() {
        let directory = tempfile::tempdir().unwrap();
        let vault = directory.path().join("selected-vault");
        let other = directory.path().join("other-vault");
        fs::create_dir(&vault).unwrap();
        fs::create_dir(&other).unwrap();
        let vault = fs::canonicalize(vault).unwrap();
        let other = fs::canonicalize(other).unwrap();
        let roots = super::super::AuthorizedRoots {
            file: directory.path().join("authorized-libraries-v1.json"),
            inner: Mutex::new(super::super::AuthorizedRootsFile {
                version: 1,
                active: Some(vault.clone()),
                recent: vec![vault.clone(), other.clone()],
            }),
        };
        let selected = super::super::authorized_active_root(
            &roots,
            &super::super::path_as_utf8(&vault).unwrap(),
        )
        .unwrap();
        assert!(super::super::authorized_active_root(
            &roots,
            &super::super::path_as_utf8(&other).unwrap()
        )
        .is_err());
        let mut options = input();
        options.document_ids = Some(vec!["vault:0123456789abcdef:chosen.md".into()]);
        let grant = create_grant(
            &AgentAccess::new(directory.path().join("app-data")),
            options,
            Some(selected),
            None,
            "server.mjs".into(),
        )
        .unwrap();
        assert_eq!(
            grant.grant.vault_root,
            Some(super::super::path_as_utf8(&vault).unwrap())
        );
    }

    #[test]
    fn managed_document_annotation_consent_captures_workspace_without_granting_vault_documents() {
        let directory = tempfile::tempdir().unwrap();
        let vault = directory.path().join("current-workspace");
        fs::create_dir(&vault).unwrap();
        let vault = fs::canonicalize(vault).unwrap();
        let roots = super::super::AuthorizedRoots {
            file: directory.path().join("authorized-libraries-v1.json"),
            inner: Mutex::new(super::super::AuthorizedRootsFile {
                version: 1,
                active: Some(vault.clone()),
                recent: vec![vault.clone()],
            }),
        };
        let access = AgentAccess::new(directory.path().join("app-data"));
        let mut selected = input();
        selected.document_ids = Some(vec!["managed:chosen-note".into()]);
        selected.scopes.push(ANNOTATIONS_SCOPE.into());
        let annotation_root = annotation_root_for(&roots, &selected.scopes).unwrap();
        let created = create_grant(
            &access,
            selected,
            None,
            annotation_root,
            "server.mjs".into(),
        )
        .unwrap();
        assert!(created.grant.vault_root.is_none());
        assert_eq!(
            created.grant.annotation_root,
            Some(super::super::path_as_utf8(&vault).unwrap())
        );
        access
            .with_manifest(|_, manifest| {
                assert_eq!(
                    manifest.grants[0].annotation_root,
                    created.grant.annotation_root
                );
                assert!(manifest.grants[0].vault_root.is_none());
                Ok(())
            })
            .unwrap();
        let mut documents_only = input();
        documents_only.document_ids = Some(vec!["managed:chosen-note".into()]);
        let annotation_root = annotation_root_for(&roots, &documents_only.scopes).unwrap();
        let created = create_grant(
            &access,
            documents_only,
            None,
            annotation_root,
            "server.mjs".into(),
        )
        .unwrap();
        assert!(created.grant.annotation_root.is_none());
        assert!(serde_json::from_str::<CreateAgentAccessGrant>(
            r#"{"name":"client","annotationRoot":"/private"}"#
        )
        .is_err());
        roots.inner.lock().unwrap().active = None;
        assert!(
            annotation_root_for(&roots, &[DOCUMENTS_SCOPE.into(), ANNOTATIONS_SCOPE.into()])
                .unwrap()
                .is_none()
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlink_manifest_and_managed_root_are_rejected_and_manifest_is_private() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let directory = tempfile::tempdir().unwrap();
        let access = AgentAccess::new(directory.path().to_path_buf());
        let grant = create(&access);
        assert_eq!(
            fs::metadata(&grant.manifest_path)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        let outside = tempfile::tempdir().unwrap();
        let target = outside.path().join("private.json");
        fs::write(&target, "private content").unwrap();
        fs::remove_file(&grant.manifest_path).unwrap();
        symlink(&target, &grant.manifest_path).unwrap();
        assert!(access
            .with_manifest(|_, manifest| Ok(manifest.grants.len()))
            .is_err());
        assert_eq!(fs::read_to_string(&target).unwrap(), "private content");
        fs::remove_file(&grant.manifest_path).unwrap();
        fs::remove_dir(directory.path().join("content-v1")).unwrap();
        symlink(outside.path(), directory.path().join("content-v1")).unwrap();
        assert!(access.paths().is_err());
    }
}
