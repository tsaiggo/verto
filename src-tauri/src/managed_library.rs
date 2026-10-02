//! App-owned portable content. No renderer-supplied path is used for file access.
//! A single manifest commit makes metadata changes atomic; immutable original
//! document bytes are written before they become visible in that manifest.

use base64::Engine;
use fs2::FileExt;
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

const MANIFEST_VERSION: u8 = 1;
const MAX_MANIFEST_BYTES: usize = 64 * 1024 * 1024;
const MAX_DOCUMENT_BYTES: usize = 50 * 1024 * 1024;

pub struct ManagedLibrary {
    directory: PathBuf,
    lock: Mutex<()>,
}

impl ManagedLibrary {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            lock: Mutex::new(()),
        }
    }

    fn lock_file(&self) -> Result<fs::File, String> {
        ensure_plain_directory(&self.directory, true)?;
        let path = self.directory.join("library.lock");
        // Every process locks the same inode. This lock file is never removed.
        match fs::symlink_metadata(&path) {
            Ok(metadata)
                if metadata.file_type().is_symlink()
                    || !metadata.is_file()
                    || metadata.len() != 0 =>
            {
                return Err("Managed library lock must be an empty regular file.".into())
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Could not inspect managed library lock: {error}")),
        }
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)
            .map_err(|error| format!("Could not open managed library lock: {error}"))?;
        file.lock_exclusive()
            .map_err(|error| format!("Could not lock managed library: {error}"))?;
        Ok(file)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedArticle {
    id: String,
    filename: String,
    source: String,
    created_at: String,
    updated_at: String,
    revision: u64,
    status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    origin_slug: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    order: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedDocument {
    id: String,
    filename: String,
    title: String,
    format: String,
    byte_length: usize,
    created_at: String,
    updated_at: String,
    revision: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    page_count: Option<u64>,
}

#[derive(Clone, Deserialize, Serialize)]
struct Manifest {
    version: u8,
    articles: Vec<ManagedArticle>,
    documents: Vec<ManagedDocument>,
}

impl Default for Manifest {
    fn default() -> Self {
        Self {
            version: MANIFEST_VERSION,
            articles: vec![],
            documents: vec![],
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum ArticleSaveResult {
    Saved { article: ManagedArticle },
    Conflict { article: ManagedArticle },
    Missing,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum ArticleDeleteResult {
    Deleted,
    Missing,
    Conflict { article: ManagedArticle },
    HasChildren { children: Vec<ManagedArticle> },
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum DocumentDeleteResult {
    Deleted,
    Missing,
    Conflict { document: ManagedDocument },
}

#[derive(Deserialize, Serialize)]
pub struct DocumentWithBytes {
    document: ManagedDocument,
    #[serde(with = "base64_bytes")]
    bytes: Vec<u8>,
}

mod base64_bytes {
    use base64::Engine;
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&base64::engine::general_purpose::STANDARD.encode(bytes))
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        let encoded = String::deserialize(deserializer)?;
        if encoded.len() > super::MAX_DOCUMENT_BYTES.div_ceil(3) * 4 {
            return Err(serde::de::Error::custom("The reading file exceeds 50 MB."));
        }
        base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    articles_copied: usize,
    documents_copied: usize,
    already_present: usize,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn valid_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !value.is_ascii()
        || bytes.len() < 20
        || bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
        || !value.ends_with('Z')
    {
        return false;
    }
    let number = |start: usize, end: usize| value.get(start..end)?.parse::<u8>().ok();
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second)) = (
        value.get(0..4).and_then(|part| part.parse::<i32>().ok()),
        number(5, 7),
        number(8, 10),
        number(11, 13),
        number(14, 16),
        number(17, 19),
    ) else {
        return false;
    };
    if bytes.len() != 20
        && (bytes.get(19) != Some(&b'.')
            || !bytes[20..bytes.len() - 1].iter().all(u8::is_ascii_digit)
            || bytes.len() == 21)
    {
        return false;
    }
    time::Month::try_from(month)
        .ok()
        .and_then(|month| time::Date::from_calendar_date(year, month, day).ok())
        .is_some()
        && time::Time::from_hms(hour, minute, second).is_ok()
}

fn validate_article(article: &ManagedArticle) -> Result<(), String> {
    if !valid_id(&article.id)
        || !super::is_readable_name(&article.filename)
        || !valid_timestamp(&article.created_at)
        || !valid_timestamp(&article.updated_at)
        || article.revision > 9_007_199_254_740_991
        || !matches!(article.status.as_str(), "draft" | "saved")
        || article
            .title
            .as_ref()
            .is_some_and(|title| title.trim().is_empty() || title.chars().count() > 500)
        || article.parent_id.as_ref().is_some_and(|id| !valid_id(id))
        || article
            .order
            .is_some_and(|order| !order.is_finite() || order < 0.0)
    {
        return Err(
            "A managed article is invalid; the existing library was left unchanged.".into(),
        );
    }
    Ok(())
}

fn validate_document(document: &ManagedDocument) -> Result<(), String> {
    if !valid_id(&document.id)
        || !matches!(document.format.as_str(), "pdf" | "epub")
        || !document
            .filename
            .to_lowercase()
            .ends_with(&format!(".{}", document.format))
        || document.title.trim().is_empty()
        || document.byte_length == 0
        || document.byte_length > MAX_DOCUMENT_BYTES
        || !valid_timestamp(&document.created_at)
        || !valid_timestamp(&document.updated_at)
        || document.revision == 0
        || document.revision > 9_007_199_254_740_991
        || document.page_count == Some(0)
    {
        return Err(
            "A managed reading file is invalid; the existing library was left unchanged.".into(),
        );
    }
    Ok(())
}

fn validate_hierarchy(articles: &[ManagedArticle]) -> Result<(), String> {
    let mut ids = HashSet::new();
    for article in articles {
        validate_article(article)?;
        if !ids.insert(&article.id) {
            return Err("The managed library contains duplicate page IDs.".into());
        }
    }
    for article in articles {
        let mut visited = HashSet::from([article.id.as_str()]);
        let mut parent_id = article.parent_id.as_deref();
        while let Some(id) = parent_id {
            if !visited.insert(id) {
                return Err("A page cannot be moved into itself or a subpage.".into());
            }
            let parent = articles
                .iter()
                .find(|article| article.id == id)
                .ok_or_else(|| {
                    "The parent page no longer exists. Choose another page.".to_string()
                })?;
            parent_id = parent.parent_id.as_deref();
        }
    }
    Ok(())
}

fn ensure_plain_directory(path: &Path, create: bool) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            Err("Managed library storage must be a directory, not a symbolic link.".into())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && create => {
            fs::create_dir_all(path)
                .map_err(|error| format!("Could not create managed library storage: {error}"))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not inspect managed library storage: {error}"
        )),
    }
}

fn read_plain_file(path: &Path, limit: usize) -> Result<Option<Vec<u8>>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not inspect managed library data: {error}")),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Managed library data must be a regular file, not a symbolic link.".into());
    }
    if metadata.len() > limit as u64 {
        return Err("Managed library data exceeds the storage limit.".into());
    }
    let mut bytes = vec![];
    fs::File::open(path)
        .map_err(|error| format!("Could not open managed library data: {error}"))?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read managed library data: {error}"))?;
    if bytes.len() > limit {
        return Err("Managed library data exceeds the storage limit.".into());
    }
    Ok(Some(bytes))
}

fn load_manifest(directory: &Path) -> Result<Manifest, String> {
    ensure_plain_directory(directory, false)?;
    let Some(bytes) = read_plain_file(&directory.join("library.json"), MAX_MANIFEST_BYTES)? else {
        return Ok(Manifest::default());
    };
    let manifest: Manifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Managed library data is damaged. Keep its backup and restore it before saving: {error}"))?;
    if manifest.version != MANIFEST_VERSION {
        return Err("This managed library version is not supported.".into());
    }
    validate_hierarchy(&manifest.articles)?;
    let mut ids = HashSet::new();
    for document in &manifest.documents {
        validate_document(document)?;
        if !ids.insert(&document.id) {
            return Err("The managed library contains duplicate reading file IDs.".into());
        }
    }
    Ok(manifest)
}

fn persist_manifest(directory: &Path, manifest: &Manifest) -> Result<(), String> {
    ensure_plain_directory(directory, true)?;
    let path = directory.join("library.json");
    // Reject unsafe existing targets before atomic replacement.
    read_plain_file(&path, MAX_MANIFEST_BYTES)?;
    let bytes = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Could not encode managed library: {error}"))?;
    if bytes.len() > MAX_MANIFEST_BYTES {
        return Err(
            "The managed article library is too large to save. Export some pages first.".into(),
        );
    }
    super::atomic_write(&path, &bytes)
}

fn now_iso() -> String {
    let now = time::OffsetDateTime::now_utc();
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
        now.millisecond()
    )
}

fn save_article_at(
    directory: &Path,
    mut article: ManagedArticle,
    expected_revision: Option<u64>,
) -> Result<ArticleSaveResult, String> {
    validate_article(&article)?;
    let mut manifest = load_manifest(directory)?;
    let index = manifest
        .articles
        .iter()
        .position(|existing| existing.id == article.id);
    match index {
        Some(index) if expected_revision != Some(manifest.articles[index].revision) => {
            return Ok(ArticleSaveResult::Conflict {
                article: manifest.articles[index].clone(),
            })
        }
        None if expected_revision.is_some() => return Ok(ArticleSaveResult::Missing),
        _ => {}
    }
    if let Some(index) = index {
        article.created_at = manifest.articles[index].created_at.clone();
        article.revision = manifest.articles[index]
            .revision
            .checked_add(1)
            .ok_or("Article revision overflow.")?;
        manifest.articles[index] = article.clone();
    } else {
        article.revision = 1;
        manifest.articles.push(article.clone());
    }
    article.updated_at = now_iso();
    let saved = manifest
        .articles
        .iter_mut()
        .find(|item| item.id == article.id)
        .expect("saved article exists");
    *saved = article.clone();
    validate_hierarchy(&manifest.articles)?;
    persist_manifest(directory, &manifest)?;
    Ok(ArticleSaveResult::Saved { article })
}

fn delete_article_at(
    directory: &Path,
    id: &str,
    expected_revision: u64,
) -> Result<ArticleDeleteResult, String> {
    let mut manifest = load_manifest(directory)?;
    let Some(article) = manifest.articles.iter().find(|item| item.id == id) else {
        return Ok(ArticleDeleteResult::Missing);
    };
    if article.revision != expected_revision {
        return Ok(ArticleDeleteResult::Conflict {
            article: article.clone(),
        });
    }
    let children: Vec<_> = manifest
        .articles
        .iter()
        .filter(|item| item.parent_id.as_deref() == Some(id))
        .cloned()
        .collect();
    if !children.is_empty() {
        return Ok(ArticleDeleteResult::HasChildren { children });
    }
    manifest.articles.retain(|item| item.id != id);
    persist_manifest(directory, &manifest)?;
    Ok(ArticleDeleteResult::Deleted)
}

fn blob_path(directory: &Path, id: &str, create: bool) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err("A reading file ID is invalid.".into());
    }
    let blobs = directory.join("originals");
    ensure_plain_directory(directory, create)?;
    ensure_plain_directory(&blobs, create)?;
    Ok(blobs.join(format!("{id}.bin")))
}

fn validate_document_bytes(document: &ManagedDocument, bytes: &[u8]) -> Result<(), String> {
    validate_document(document)?;
    if document.byte_length != bytes.len()
        || (document.format == "pdf" && !bytes.starts_with(b"%PDF-"))
        || (document.format == "epub" && !bytes.starts_with(b"PK\x03\x04"))
    {
        return Err("The original reading file is missing or damaged.".into());
    }
    Ok(())
}

fn import_document_at(
    directory: &Path,
    document: ManagedDocument,
    bytes: &[u8],
) -> Result<ManagedDocument, String> {
    validate_document_bytes(&document, bytes)?;
    let mut manifest = load_manifest(directory)?;
    if manifest.documents.iter().any(|item| item.id == document.id) {
        return Err("This reading file ID already exists; nothing was overwritten.".into());
    }
    let path = blob_path(directory, &document.id, true)?;
    if let Some(existing) = read_plain_file(&path, MAX_DOCUMENT_BYTES)? {
        // Failed prior manifest commits may leave harmless unreferenced bytes.
        if existing != bytes {
            return Err(
                "Original reading file bytes already exist; nothing was overwritten.".into(),
            );
        }
    } else {
        super::atomic_write(&path, bytes)?;
    }
    manifest.documents.push(document.clone());
    persist_manifest(directory, &manifest)?;
    Ok(document)
}

fn read_document_at(directory: &Path, id: &str) -> Result<Option<DocumentWithBytes>, String> {
    let manifest = load_manifest(directory)?;
    let Some(document) = manifest.documents.into_iter().find(|item| item.id == id) else {
        return Ok(None);
    };
    let bytes = read_plain_file(&blob_path(directory, id, false)?, MAX_DOCUMENT_BYTES)?
        .ok_or_else(|| {
            "The original reading file is missing. Import it again from your backup.".to_string()
        })?;
    validate_document_bytes(&document, &bytes)?;
    Ok(Some(DocumentWithBytes { document, bytes }))
}

fn delete_document_at(
    directory: &Path,
    id: &str,
    expected_revision: u64,
) -> Result<DocumentDeleteResult, String> {
    let mut manifest = load_manifest(directory)?;
    let Some(document) = manifest.documents.iter().find(|item| item.id == id) else {
        return Ok(DocumentDeleteResult::Missing);
    };
    if document.revision != expected_revision {
        return Ok(DocumentDeleteResult::Conflict {
            document: document.clone(),
        });
    }
    // Metadata commit is authoritative. A failed cleanup leaves unreferenced
    // bytes, never a visible record whose original content has disappeared.
    let path = blob_path(directory, id, false)?;
    let has_bytes = read_plain_file(&path, MAX_DOCUMENT_BYTES)?.is_some();
    manifest.documents.retain(|item| item.id != id);
    persist_manifest(directory, &manifest)?;
    if has_bytes {
        let _ = fs::remove_file(path);
    }
    Ok(DocumentDeleteResult::Deleted)
}

fn migrate_at(
    directory: &Path,
    articles: Vec<ManagedArticle>,
    documents: Vec<DocumentWithBytes>,
) -> Result<MigrationResult, String> {
    if documents
        .iter()
        .map(|record| record.bytes.len() as u64)
        .sum::<u64>()
        > 100 * 1024 * 1024
    {
        return Err("One-time migration supports up to 100 MB of reading files; browser originals are unchanged.".into());
    }
    let mut manifest = load_manifest(directory)?;
    let mut result = MigrationResult::default();
    for article in articles {
        validate_article(&article)?;
        if let Some(existing) = manifest.articles.iter().find(|item| item.id == article.id) {
            if existing != &article {
                return Err("A device page has the same ID but different content. Migration left both copies unchanged.".into());
            }
            result.already_present += 1;
        } else {
            manifest.articles.push(article);
            result.articles_copied += 1;
        }
    }
    validate_hierarchy(&manifest.articles)?;
    // Validate every collision before writing even unreferenced original bytes.
    for record in &documents {
        validate_document_bytes(&record.document, &record.bytes)?;
        if let Some(existing) = manifest
            .documents
            .iter()
            .find(|item| item.id == record.document.id)
        {
            let saved = read_document_at(directory, &existing.id)?
                .ok_or("The device reading file is missing.")?;
            if existing != &record.document || saved.bytes != record.bytes {
                return Err("A device reading file has the same ID but different content. Migration left both copies unchanged.".into());
            }
            result.already_present += 1;
        }
    }
    let mut seen = HashSet::new();
    for record in documents {
        if !seen.insert(record.document.id.clone()) {
            return Err("Migration contains duplicate reading file IDs.".into());
        }
        if manifest
            .documents
            .iter()
            .any(|item| item.id == record.document.id)
        {
            continue;
        }
        let path = blob_path(directory, &record.document.id, true)?;
        if let Some(existing) = read_plain_file(&path, MAX_DOCUMENT_BYTES)? {
            if existing != record.bytes {
                return Err(
                    "Migration found different original bytes; nothing was overwritten.".into(),
                );
            }
        } else {
            super::atomic_write(&path, &record.bytes)?;
        }
        manifest.documents.push(record.document);
        result.documents_copied += 1;
    }
    persist_manifest(directory, &manifest)?;
    Ok(result)
}

#[tauri::command]
pub fn list_managed_articles(
    library: State<'_, ManagedLibrary>,
) -> Result<Vec<ManagedArticle>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(load_manifest(&library.directory)?.articles)
}

#[tauri::command]
pub fn read_managed_article(
    id: String,
    library: State<'_, ManagedLibrary>,
) -> Result<Option<ManagedArticle>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(load_manifest(&library.directory)?
        .articles
        .into_iter()
        .find(|article| article.id == id))
}

#[tauri::command]
pub fn save_managed_article(
    article: ManagedArticle,
    expected_revision: Option<u64>,
    library: State<'_, ManagedLibrary>,
) -> Result<ArticleSaveResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    save_article_at(&library.directory, article, expected_revision)
}

#[tauri::command]
pub fn update_managed_article(
    id: String,
    changes: serde_json::Value,
    expected_revision: u64,
    library: State<'_, ManagedLibrary>,
) -> Result<ArticleSaveResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    let manifest = load_manifest(&library.directory)?;
    let Some(article) = manifest.articles.iter().find(|article| article.id == id) else {
        return Ok(ArticleSaveResult::Missing);
    };
    if article.revision != expected_revision {
        return Ok(ArticleSaveResult::Conflict {
            article: article.clone(),
        });
    }
    let mut next = serde_json::to_value(article).map_err(|error| error.to_string())?;
    let object = changes
        .as_object()
        .ok_or("Page metadata must be an object.")?;
    for key in ["title", "filename", "parentId", "order"] {
        if let Some(value) = object.get(key) {
            next[key] = value.clone();
        }
    }
    let article = serde_json::from_value(next)
        .map_err(|error| format!("Page metadata is invalid: {error}"))?;
    save_article_at(&library.directory, article, Some(expected_revision))
}

#[tauri::command]
pub fn delete_managed_article(
    id: String,
    expected_revision: u64,
    library: State<'_, ManagedLibrary>,
) -> Result<ArticleDeleteResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    delete_article_at(&library.directory, &id, expected_revision)
}

#[tauri::command]
pub fn list_managed_documents(
    library: State<'_, ManagedLibrary>,
) -> Result<Vec<ManagedDocument>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(load_manifest(&library.directory)?.documents)
}

#[tauri::command]
pub fn read_managed_document_metadata(
    id: String,
    library: State<'_, ManagedLibrary>,
) -> Result<Option<ManagedDocument>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(load_manifest(&library.directory)?
        .documents
        .into_iter()
        .find(|document| document.id == id))
}

#[tauri::command]
pub fn import_managed_document(
    document: ManagedDocument,
    bytes: String,
    library: State<'_, ManagedLibrary>,
) -> Result<ManagedDocument, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    if bytes.len() > MAX_DOCUMENT_BYTES.div_ceil(3) * 4 {
        return Err("Reading files must be 50 MB or smaller.".into());
    }
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(bytes)
        .map_err(|_| "Original file bytes are invalid.")?;
    import_document_at(&library.directory, document, &decoded)
}

#[tauri::command]
pub fn read_managed_document(
    id: String,
    library: State<'_, ManagedLibrary>,
) -> Result<Option<DocumentWithBytes>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    read_document_at(&library.directory, &id)
}

#[tauri::command]
pub fn delete_managed_document(
    id: String,
    expected_revision: u64,
    library: State<'_, ManagedLibrary>,
) -> Result<DocumentDeleteResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    delete_document_at(&library.directory, &id, expected_revision)
}

#[tauri::command]
pub fn migrate_managed_library(
    articles: Vec<ManagedArticle>,
    documents: Vec<DocumentWithBytes>,
    library: State<'_, ManagedLibrary>,
) -> Result<MigrationResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    migrate_at(&library.directory, articles, documents)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn article(id: &str, source: &str) -> ManagedArticle {
        ManagedArticle {
            id: id.into(),
            filename: "notes.mdx".into(),
            source: source.into(),
            created_at: "2026-10-02T01:00:00.000Z".into(),
            updated_at: "2026-10-02T01:00:00.000Z".into(),
            revision: 0,
            status: "saved".into(),
            origin_slug: None,
            title: None,
            parent_id: None,
            order: None,
        }
    }

    fn pdf(id: &str) -> DocumentWithBytes {
        let bytes = b"%PDF-1.7\noriginal fixture\n".to_vec();
        DocumentWithBytes {
            document: ManagedDocument {
                id: id.into(),
                filename: "paper.pdf".into(),
                title: "Paper".into(),
                format: "pdf".into(),
                byte_length: bytes.len(),
                created_at: "2026-10-02T01:00:00.000Z".into(),
                updated_at: "2026-10-02T01:00:00.000Z".into(),
                revision: 1,
                author: None,
                language: None,
                page_count: Some(1),
            },
            bytes,
        }
    }

    fn saved(result: ArticleSaveResult) -> ManagedArticle {
        match result {
            ArticleSaveResult::Saved { article } => article,
            _ => panic!("fixture should save"),
        }
    }

    #[test]
    fn exact_source_revisions_cycles_and_leaf_deletion() {
        let directory = tempfile::tempdir().unwrap();
        let root = saved(
            save_article_at(
                directory.path(),
                article("root", "\u{feff}---\r\n# 原文\r\n"),
                None,
            )
            .unwrap(),
        );
        assert_eq!(
            load_manifest(directory.path()).unwrap().articles[0].source,
            root.source
        );
        let mut child = article("child", "# Child");
        child.parent_id = Some(root.id.clone());
        let child = saved(save_article_at(directory.path(), child, None).unwrap());
        let mut changed = root.clone();
        changed.parent_id = Some(child.id.clone());
        assert!(
            save_article_at(directory.path(), changed, Some(root.revision))
                .unwrap_err()
                .contains("subpage")
        );
        assert!(matches!(
            delete_article_at(directory.path(), "root", root.revision).unwrap(),
            ArticleDeleteResult::HasChildren { .. }
        ));
        let mut edited = child.clone();
        edited.source = "Newer text".into();
        let edited =
            saved(save_article_at(directory.path(), edited, Some(child.revision)).unwrap());
        assert!(matches!(
            save_article_at(directory.path(), child.clone(), Some(child.revision)).unwrap(),
            ArticleSaveResult::Conflict { .. }
        ));
        assert!(matches!(
            delete_article_at(directory.path(), "child", child.revision).unwrap(),
            ArticleDeleteResult::Conflict { .. }
        ));
        assert!(matches!(
            delete_article_at(directory.path(), "child", edited.revision).unwrap(),
            ArticleDeleteResult::Deleted
        ));
        assert!(matches!(
            delete_article_at(directory.path(), "root", root.revision).unwrap(),
            ArticleDeleteResult::Deleted
        ));
    }

    #[test]
    fn corrupted_manifest_is_never_reset_or_overwritten() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        fs::write(&path, b"{ damaged original").unwrap();
        assert!(save_article_at(directory.path(), article("page", "Replacement"), None).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"{ damaged original");
    }

    #[test]
    fn reading_bytes_are_exact_and_revision_delete_is_safe() {
        let directory = tempfile::tempdir().unwrap();
        let record = pdf("pdf-one");
        import_document_at(directory.path(), record.document.clone(), &record.bytes).unwrap();
        let reopened = read_document_at(directory.path(), "pdf-one")
            .unwrap()
            .unwrap();
        assert_eq!(reopened.bytes, record.bytes);
        assert!(
            import_document_at(directory.path(), record.document.clone(), b"%PDF-other").is_err()
        );
        assert!(matches!(
            delete_document_at(directory.path(), "pdf-one", 2).unwrap(),
            DocumentDeleteResult::Conflict { .. }
        ));
        assert!(matches!(
            delete_document_at(directory.path(), "pdf-one", 1).unwrap(),
            DocumentDeleteResult::Deleted
        ));
        assert!(read_document_at(directory.path(), "pdf-one")
            .unwrap()
            .is_none());
        assert!(!directory.path().join("originals/pdf-one.bin").exists());
        assert!(blob_path(directory.path(), "../escape", true).is_err());
    }

    #[test]
    fn migration_is_additive_idempotent_and_never_overwrites_collisions() {
        let directory = tempfile::tempdir().unwrap();
        let mut parent = article("parent", "Exact markdown");
        parent.revision = 7;
        let mut child = article("child", "Exact child");
        child.revision = 3;
        child.parent_id = Some(parent.id.clone());
        let documents = vec![pdf("paper")];
        let result = migrate_at(
            directory.path(),
            vec![child.clone(), parent.clone()],
            documents,
        )
        .unwrap();
        assert_eq!((result.articles_copied, result.documents_copied), (2, 1));
        let result = migrate_at(
            directory.path(),
            vec![parent.clone(), child],
            vec![pdf("paper")],
        )
        .unwrap();
        assert_eq!(result.already_present, 3);
        parent.source = "Must not replace".into();
        let new_page = article("new-page", "Must not partially commit");
        assert!(migrate_at(directory.path(), vec![new_page, parent], vec![]).is_err());
        let manifest = load_manifest(directory.path()).unwrap();
        assert_eq!(manifest.articles.len(), 2);
        assert_eq!(
            manifest
                .articles
                .iter()
                .find(|article| article.id == "parent")
                .unwrap()
                .source,
            "Exact markdown"
        );
    }

    #[test]
    fn independent_device_instances_share_one_compare_and_swap_file_lock() {
        let directory = tempfile::tempdir().unwrap();
        let initial =
            saved(save_article_at(directory.path(), article("one", "Original"), None).unwrap());
        let path = directory.path().to_path_buf();
        let threads: Vec<_> = ["Window A", "Window B"]
            .into_iter()
            .map(|source| {
                let library = ManagedLibrary::new(path.clone());
                let mut article = initial.clone();
                article.source = source.into();
                std::thread::spawn(move || {
                    let _lock = library.lock.lock().unwrap();
                    let _file_lock = library.lock_file().unwrap();
                    save_article_at(&library.directory, article, Some(1)).unwrap()
                })
            })
            .collect();
        let results: Vec<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, ArticleSaveResult::Saved { .. }))
                .count(),
            1
        );
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, ArticleSaveResult::Conflict { .. }))
                .count(),
            1
        );
    }

    #[test]
    fn native_document_ipc_round_trips_compact_base64_and_rejects_invalid_encoding() {
        let record = pdf("encoded-pdf");
        let encoded = serde_json::to_value(&record).unwrap();
        assert!(encoded["bytes"].is_string());
        assert_eq!(
            encoded["bytes"].as_str().unwrap().len(),
            record.bytes.len().div_ceil(3) * 4
        );
        let decoded: DocumentWithBytes = serde_json::from_value(encoded).unwrap();
        assert_eq!(decoded.bytes, record.bytes);
        let mut invalid = serde_json::to_value(&record).unwrap();
        invalid["bytes"] = "%%not base64%%".into();
        assert!(serde_json::from_value::<DocumentWithBytes>(invalid).is_err());
    }

    #[test]
    fn migration_rejects_damaged_reading_bytes_before_any_manifest_commit() {
        let directory = tempfile::tempdir().unwrap();
        let mut page = article("page", "Do not partially commit");
        page.revision = 1;
        let mut document = pdf("damaged");
        document.bytes[0] = 0;
        assert!(migrate_at(directory.path(), vec![page], vec![document]).is_err());
        assert!(load_manifest(directory.path()).unwrap().articles.is_empty());
        assert!(!directory.path().join("originals/damaged.bin").exists());
    }
}
