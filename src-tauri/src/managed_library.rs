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
const MAX_BOOK_ASSET_BYTES: usize = 100 * 1024 * 1024;
const MAX_BOOK_SOURCE_BYTES: usize = 16 * 1024 * 1024;

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
    #[serde(default)]
    books: Vec<ManagedBook>,
    #[serde(default)]
    assets: Vec<ManagedBookAssetMetadata>,
}

impl Default for Manifest {
    fn default() -> Self {
        Self {
            version: MANIFEST_VERSION,
            articles: vec![],
            documents: vec![],
            books: vec![],
            assets: vec![],
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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookTocItem {
    title: String,
    article_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    anchor: Option<String>,
    children: Vec<BookTocItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookChapterFile {
    article_id: String,
    filename: String,
    original_path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedBook {
    id: String,
    root_article_id: String,
    source_document_id: String,
    title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    created_at: String,
    chapter_files: Vec<BookChapterFile>,
    toc: Vec<BookTocItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ManagedBookAssetMetadata {
    id: String,
    book_id: String,
    filename: String,
    mime: String,
    byte_length: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedBookAsset {
    id: String,
    book_id: String,
    filename: String,
    mime: String,
    #[serde(with = "base64_assets")]
    bytes: Vec<u8>,
}

impl ManagedBookAsset {
    fn metadata(&self) -> ManagedBookAssetMetadata {
        ManagedBookAssetMetadata {
            id: self.id.clone(),
            book_id: self.book_id.clone(),
            filename: self.filename.clone(),
            mime: self.mime.clone(),
            byte_length: self.bytes.len(),
        }
    }
}

mod base64_assets {
    use base64::Engine;
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&base64::engine::general_purpose::STANDARD.encode(bytes))
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        let encoded = String::deserialize(deserializer)?;
        if encoded.len() > super::MAX_BOOK_ASSET_BYTES.div_ceil(3) * 4 {
            return Err(serde::de::Error::custom("Book assets exceed 100 MB."));
        }
        base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedBookDraft {
    book: ManagedBook,
    articles: Vec<ManagedArticle>,
    assets: Vec<ManagedBookAsset>,
    source_revision: u64,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum BookSaveResult {
    Saved {
        book: ManagedBook,
    },
    Existing {
        #[serde(rename = "existingBook")]
        existing_book: ManagedBook,
    },
}

#[derive(Debug, Serialize)]
pub struct ManagedBookSnapshot {
    book: ManagedBook,
    articles: Vec<ManagedArticle>,
    assets: Vec<ManagedBookAsset>,
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
    books_copied: usize,
    assets_copied: usize,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn valid_book_filename(filename: &str) -> bool {
    if filename.is_empty()
        || filename.chars().count() > 240
        || filename.ends_with('.')
        || filename.ends_with(' ')
        || filename
            .chars()
            .any(|character| character.is_control() || "/\\<>:\"|?*".contains(character))
    {
        return false;
    }
    let stem = filename
        .split('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    !matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        && !((stem.starts_with("com") || stem.starts_with("lpt"))
            && stem.len() == 4
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

fn validate_toc(items: &[BookTocItem], depth: usize) -> Result<(), String> {
    if depth > 100 {
        return Err("The book navigation is too deeply nested.".into());
    }
    for item in items {
        if !valid_id(&item.article_id) {
            return Err("Book navigation references an invalid page ID.".into());
        }
        validate_toc(&item.children, depth + 1)?;
    }
    Ok(())
}

fn validate_book(book: &ManagedBook) -> Result<(), String> {
    if !valid_id(&book.id)
        || !valid_id(&book.root_article_id)
        || !valid_id(&book.source_document_id)
        || book.title.trim().is_empty()
        || !valid_timestamp(&book.created_at)
    {
        return Err("The converted book record is invalid.".into());
    }
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for chapter in &book.chapter_files {
        if !valid_id(&chapter.article_id)
            || !valid_book_filename(&chapter.filename)
            || !chapter.filename.to_lowercase().ends_with(".mdx")
            || !ids.insert(&chapter.article_id)
            || !names.insert(chapter.filename.to_lowercase())
        {
            return Err("The book chapter map is invalid or contains duplicate filenames.".into());
        }
    }
    validate_toc(&book.toc, 0)
}

fn validate_asset(asset: &ManagedBookAssetMetadata) -> Result<(), String> {
    let valid_mime = asset.mime.split_once('/').is_some_and(|(kind, subtype)| {
        !kind.is_empty()
            && !subtype.is_empty()
            && kind
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
            && subtype
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
    });
    if !valid_id(&asset.id)
        || !valid_id(&asset.book_id)
        || !valid_book_filename(&asset.filename)
        || !valid_mime
        || asset.byte_length > MAX_BOOK_ASSET_BYTES
    {
        return Err("A converted book asset is invalid.".into());
    }
    Ok(())
}

fn validate_book_manifest(manifest: &Manifest) -> Result<(), String> {
    let mut books = HashSet::new();
    let mut sources = HashSet::new();
    for book in &manifest.books {
        validate_book(book)?;
        if !books.insert(&book.id) || !sources.insert(&book.source_document_id) {
            return Err("The managed library contains duplicate converted books.".into());
        }
    }
    let mut assets = HashSet::new();
    let mut names = HashSet::new();
    for asset in &manifest.assets {
        validate_asset(asset)?;
        if !books.contains(&asset.book_id)
            || !assets.insert((&asset.book_id, &asset.id))
            || !names.insert((&asset.book_id, asset.filename.to_lowercase()))
        {
            return Err("The managed library contains duplicate or orphaned book assets.".into());
        }
    }
    for book in &manifest.books {
        if manifest
            .assets
            .iter()
            .filter(|asset| asset.book_id == book.id)
            .map(|asset| asset.byte_length as u64)
            .sum::<u64>()
            > MAX_BOOK_ASSET_BYTES as u64
        {
            return Err("Converted book assets exceed 100 MB.".into());
        }
    }
    Ok(())
}

fn validate_book_draft(draft: &ManagedBookDraft) -> Result<(), String> {
    validate_book(&draft.book)?;
    validate_hierarchy(&draft.articles)?;
    if draft.source_revision == 0 || draft.source_revision > 9_007_199_254_740_991 {
        return Err("A valid original EPUB revision is required.".into());
    }
    let root = draft
        .articles
        .iter()
        .find(|article| article.id == draft.book.root_article_id)
        .ok_or("The converted book root page is missing.")?;
    if root.parent_id.is_some() {
        return Err("The converted book root cannot have a parent.".into());
    }
    let mut names = HashSet::new();
    let mut source_bytes = 0;
    for article in &draft.articles {
        if article.revision != 0
            || article.status != "saved"
            || !valid_book_filename(&article.filename)
            || !article.filename.to_lowercase().ends_with(".mdx")
            || !names.insert(article.filename.to_lowercase())
        {
            return Err(
                "Converted chapters must be new, saved MDX pages with unique filenames.".into(),
            );
        }
        source_bytes += article.source.len();
        let mut current = article;
        let mut reached_root = current.id == root.id;
        while let Some(id) = &current.parent_id {
            current = draft
                .articles
                .iter()
                .find(|article| &article.id == id)
                .ok_or("A converted parent page is missing.")?;
            reached_root |= current.id == root.id;
        }
        if !reached_root {
            return Err("All converted chapters must belong to this book root.".into());
        }
    }
    if source_bytes > MAX_BOOK_SOURCE_BYTES {
        return Err("Converted Markdown source must be 16 MB or smaller.".into());
    }
    for chapter in &draft.book.chapter_files {
        if !draft
            .articles
            .iter()
            .any(|article| article.id == chapter.article_id && article.filename == chapter.filename)
        {
            return Err("The converted chapter filename does not match its page.".into());
        }
    }
    fn check_toc(items: &[BookTocItem], articles: &[ManagedArticle]) -> Result<(), String> {
        for item in items {
            if !articles.iter().any(|article| article.id == item.article_id) {
                return Err("Book navigation references a missing converted chapter.".into());
            }
            check_toc(&item.children, articles)?;
        }
        Ok(())
    }
    check_toc(&draft.book.toc, &draft.articles)?;
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    let mut total = 0;
    for asset in &draft.assets {
        validate_asset(&asset.metadata())?;
        if asset.book_id != draft.book.id
            || !ids.insert(&asset.id)
            || !names.insert(asset.filename.to_lowercase())
        {
            return Err(
                "Book assets must belong to this book and have unique IDs and filenames.".into(),
            );
        }
        total += asset.bytes.len();
    }
    if total > MAX_BOOK_ASSET_BYTES {
        return Err("Converted book assets must be 100 MB or smaller.".into());
    }
    Ok(())
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
    validate_book_manifest(&manifest)?;
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

fn asset_path(
    directory: &Path,
    book_id: &str,
    asset_id: &str,
    create: bool,
) -> Result<PathBuf, String> {
    if !valid_id(book_id) || !valid_id(asset_id) {
        return Err("A converted book asset ID is invalid.".into());
    }
    ensure_plain_directory(directory, create)?;
    let assets = directory.join("assets");
    ensure_plain_directory(&assets, create)?;
    let book_assets = assets.join(book_id);
    ensure_plain_directory(&book_assets, create)?;
    Ok(book_assets.join(format!("{asset_id}.bin")))
}

fn persist_asset_bytes(directory: &Path, asset: &ManagedBookAsset) -> Result<(), String> {
    validate_asset(&asset.metadata())?;
    let path = asset_path(directory, &asset.book_id, &asset.id, true)?;
    if let Some(existing) = read_plain_file(&path, MAX_BOOK_ASSET_BYTES)? {
        if existing != asset.bytes {
            return Err(
                "Different book asset bytes already exist; nothing was overwritten.".into(),
            );
        }
    } else {
        super::atomic_write(&path, &asset.bytes)?;
    }
    Ok(())
}

fn read_asset_bytes(
    directory: &Path,
    asset: &ManagedBookAssetMetadata,
) -> Result<ManagedBookAsset, String> {
    let bytes = read_plain_file(
        &asset_path(directory, &asset.book_id, &asset.id, false)?,
        MAX_BOOK_ASSET_BYTES,
    )?
    .ok_or("A converted book image is missing. Restore it from your backup before exporting.")?;
    if bytes.len() != asset.byte_length {
        return Err(
            "A converted book image is damaged. Restore it from your backup before exporting."
                .into(),
        );
    }
    Ok(ManagedBookAsset {
        id: asset.id.clone(),
        book_id: asset.book_id.clone(),
        filename: asset.filename.clone(),
        mime: asset.mime.clone(),
        bytes,
    })
}

fn save_book_at(directory: &Path, draft: ManagedBookDraft) -> Result<BookSaveResult, String> {
    validate_book_draft(&draft)?;
    let mut manifest = load_manifest(directory)?;
    if let Some(existing) = manifest
        .books
        .iter()
        .find(|book| book.source_document_id == draft.book.source_document_id)
    {
        return Ok(BookSaveResult::Existing {
            existing_book: existing.clone(),
        });
    }
    if manifest.books.iter().any(|book| book.id == draft.book.id) {
        return Err("This book ID already exists; nothing was overwritten.".into());
    }
    let source = manifest
        .documents
        .iter()
        .find(|document| document.id == draft.book.source_document_id)
        .ok_or("The original EPUB changed or was removed. Reopen it and convert again.")?;
    if source.format != "epub" || source.revision != draft.source_revision {
        return Err(
            "The original EPUB changed or was removed. Reopen it and convert again.".into(),
        );
    }
    // The conversion never replaces the original. Verify its readable bytes too.
    read_document_at(directory, &source.id)?.ok_or("The original EPUB is missing.")?;
    if draft.articles.iter().any(|article| {
        manifest
            .articles
            .iter()
            .any(|existing| existing.id == article.id)
    }) {
        return Err("A converted page ID already exists; nothing was overwritten.".into());
    }
    // Write immutable assets first. A failed manifest commit can leave harmless
    // unreferenced bytes; retrying the same draft reuses them without overwriting.
    for asset in &draft.assets {
        persist_asset_bytes(directory, asset)?;
    }
    let now = now_iso();
    for mut article in draft.articles {
        article.revision = 1;
        article.updated_at = now.clone();
        manifest.articles.push(article);
    }
    for asset in draft.assets {
        manifest.assets.push(asset.metadata());
    }
    manifest.books.push(draft.book.clone());
    validate_hierarchy(&manifest.articles)?;
    validate_book_manifest(&manifest)?;
    persist_manifest(directory, &manifest)?;
    Ok(BookSaveResult::Saved { book: draft.book })
}

fn book_for_article<'a>(manifest: &'a Manifest, article_id: &str) -> Option<&'a ManagedBook> {
    if let Some(book) = manifest.books.iter().find(|book| {
        book.root_article_id == article_id
            || book
                .chapter_files
                .iter()
                .any(|chapter| chapter.article_id == article_id)
    }) {
        return Some(book);
    }
    let mut id = Some(article_id);
    let mut visited = HashSet::new();
    while let Some(current) = id {
        if !visited.insert(current) {
            return None;
        }
        if let Some(book) = manifest
            .books
            .iter()
            .find(|book| book.root_article_id == current)
        {
            return Some(book);
        }
        id = manifest
            .articles
            .iter()
            .find(|article| article.id == current)
            .and_then(|article| article.parent_id.as_deref());
    }
    None
}

fn book_snapshot_at(directory: &Path, book_id: &str) -> Result<ManagedBookSnapshot, String> {
    let manifest = load_manifest(directory)?;
    let book = manifest
        .books
        .iter()
        .find(|book| book.id == book_id)
        .ok_or("This editable book is missing from the library.")?
        .clone();
    if !manifest
        .articles
        .iter()
        .any(|article| article.id == book.root_article_id)
    {
        return Err("The converted book's root page was removed. Its original EPUB and other pages are unchanged.".into());
    }
    let mut descendants = HashSet::from([book.root_article_id.clone()]);
    loop {
        let old_len = descendants.len();
        for article in &manifest.articles {
            if article
                .parent_id
                .as_ref()
                .is_some_and(|id| descendants.contains(id))
            {
                descendants.insert(article.id.clone());
            }
        }
        if descendants.len() == old_len {
            break;
        }
    }
    let members: HashSet<_> = descendants
        .into_iter()
        .chain(
            book.chapter_files
                .iter()
                .map(|chapter| chapter.article_id.clone()),
        )
        .collect();
    let articles = manifest
        .articles
        .into_iter()
        .filter(|article| members.contains(&article.id))
        .collect();
    let assets = manifest
        .assets
        .iter()
        .filter(|asset| asset.book_id == book.id)
        .map(|asset| read_asset_bytes(directory, asset))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ManagedBookSnapshot {
        book,
        articles,
        assets,
    })
}

#[cfg(test)]
fn migrate_at(
    directory: &Path,
    articles: Vec<ManagedArticle>,
    documents: Vec<DocumentWithBytes>,
) -> Result<MigrationResult, String> {
    migrate_books_at(directory, articles, documents, vec![], vec![])
}

fn migrate_books_at(
    directory: &Path,
    articles: Vec<ManagedArticle>,
    documents: Vec<DocumentWithBytes>,
    books: Vec<ManagedBook>,
    assets: Vec<ManagedBookAsset>,
) -> Result<MigrationResult, String> {
    if documents
        .iter()
        .map(|record| record.bytes.len() as u64)
        .sum::<u64>()
        + assets
            .iter()
            .map(|asset| asset.bytes.len() as u64)
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
    for book in books {
        validate_book(&book)?;
        if let Some(existing) = manifest
            .books
            .iter()
            .find(|item| item.id == book.id || item.source_document_id == book.source_document_id)
        {
            if existing != &book {
                return Err("A device book has the same ID or EPUB source but different content. Migration left both copies unchanged.".into());
            }
            result.already_present += 1;
        } else {
            manifest.books.push(book);
            result.books_copied += 1;
        }
    }
    let mut new_assets = vec![];
    for asset in assets {
        let metadata = asset.metadata();
        validate_asset(&metadata)?;
        if let Some(existing) = manifest
            .assets
            .iter()
            .find(|item| item.book_id == asset.book_id && item.id == asset.id)
        {
            if existing != &metadata || read_asset_bytes(directory, existing)?.bytes != asset.bytes
            {
                return Err("A device book asset has different metadata or content. Migration left both copies unchanged.".into());
            }
            result.already_present += 1;
        } else {
            if new_assets
                .iter()
                .any(|item: &ManagedBookAsset| item.book_id == asset.book_id && item.id == asset.id)
            {
                return Err("Migration contains duplicate book assets.".into());
            }
            manifest.assets.push(metadata);
            new_assets.push(asset);
            result.assets_copied += 1;
        }
    }
    validate_book_manifest(&manifest)?;
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
    for asset in new_assets {
        persist_asset_bytes(directory, &asset)?;
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
    books: Option<Vec<ManagedBook>>,
    assets: Option<Vec<ManagedBookAsset>>,
    library: State<'_, ManagedLibrary>,
) -> Result<MigrationResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    migrate_books_at(
        &library.directory,
        articles,
        documents,
        books.unwrap_or_default(),
        assets.unwrap_or_default(),
    )
}

#[tauri::command]
pub fn save_managed_book(
    draft: ManagedBookDraft,
    library: State<'_, ManagedLibrary>,
) -> Result<BookSaveResult, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    save_book_at(&library.directory, draft)
}

#[tauri::command]
pub fn list_managed_books(library: State<'_, ManagedLibrary>) -> Result<Vec<ManagedBook>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(load_manifest(&library.directory)?.books)
}

#[tauri::command]
pub fn find_managed_book_for_article(
    article_id: String,
    library: State<'_, ManagedLibrary>,
) -> Result<Option<ManagedBook>, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    Ok(book_for_article(&load_manifest(&library.directory)?, &article_id).cloned())
}

#[tauri::command]
pub fn read_managed_book_snapshot(
    book_id: String,
    library: State<'_, ManagedLibrary>,
) -> Result<ManagedBookSnapshot, String> {
    let _guard = library
        .lock
        .lock()
        .map_err(|_| "Managed library is unavailable.")?;
    let _file_lock = library.lock_file()?;
    book_snapshot_at(&library.directory, &book_id)
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

    fn epub(id: &str) -> DocumentWithBytes {
        let mut record = pdf(id);
        record.bytes = b"PK\x03\x04original epub bytes".to_vec();
        record.document.filename = "original.epub".into();
        record.document.format = "epub".into();
        record.document.byte_length = record.bytes.len();
        record.document.page_count = None;
        record
    }

    fn book_draft(source_id: &str) -> ManagedBookDraft {
        let mut root = article("book-root", "# Book\n\n[Chapter](./chapter-1.mdx)\n");
        root.filename = "index.mdx".into();
        let mut chapter = article(
            "book-chapter",
            "\u{feff}# Chapter\r\n![Image](./assets/cover.png)\r\n",
        );
        chapter.filename = "chapter-1.mdx".into();
        chapter.parent_id = Some(root.id.clone());
        let book = ManagedBook {
            id: "converted-book".into(),
            root_article_id: root.id.clone(),
            source_document_id: source_id.into(),
            title: "Converted book".into(),
            author: Some("Ada".into()),
            language: Some("zh".into()),
            created_at: root.created_at.clone(),
            chapter_files: vec![BookChapterFile {
                article_id: chapter.id.clone(),
                filename: chapter.filename.clone(),
                original_path: "OPS/chapter.xhtml".into(),
            }],
            toc: vec![BookTocItem {
                title: "Chapter".into(),
                article_id: chapter.id.clone(),
                anchor: None,
                children: vec![],
            }],
        };
        ManagedBookDraft {
            assets: vec![ManagedBookAsset {
                id: "cover".into(),
                book_id: book.id.clone(),
                filename: "cover.png".into(),
                mime: "image/png".into(),
                bytes: vec![0, 1, 255],
            }],
            book,
            articles: vec![root, chapter],
            source_revision: 1,
        }
    }

    fn store_original(directory: &Path) -> DocumentWithBytes {
        let record = epub("original-epub");
        import_document_at(directory, record.document.clone(), &record.bytes).unwrap();
        record
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

    #[test]
    fn converted_book_commits_exact_chapters_assets_and_preserves_original_source() {
        let directory = tempfile::tempdir().unwrap();
        let source = store_original(directory.path());
        let draft = book_draft(&source.document.id);
        let exact_source = draft.articles[1].source.clone();
        assert!(matches!(
            save_book_at(directory.path(), draft.clone()).unwrap(),
            BookSaveResult::Saved { .. }
        ));
        let snapshot = book_snapshot_at(directory.path(), &draft.book.id).unwrap();
        assert_eq!(snapshot.articles.len(), 2);
        assert_eq!(snapshot.articles[1].source, exact_source);
        assert_eq!(snapshot.articles[1].revision, 1);
        assert_eq!(snapshot.assets[0].bytes, vec![0, 1, 255]);
        assert_eq!(
            read_document_at(directory.path(), &source.document.id)
                .unwrap()
                .unwrap()
                .bytes,
            source.bytes
        );
        let mut edited = snapshot.articles[1].clone();
        edited.source = "My edited chapter".into();
        save_article_at(directory.path(), edited, Some(1)).unwrap();
        assert!(matches!(
            save_book_at(directory.path(), draft).unwrap(),
            BookSaveResult::Existing { .. }
        ));
        assert_eq!(
            book_snapshot_at(directory.path(), "converted-book")
                .unwrap()
                .articles[1]
                .source,
            "My edited chapter"
        );
        let mut descendant = article("new-child", "New child");
        descendant.parent_id = Some("book-root".into());
        save_article_at(directory.path(), descendant, None).unwrap();
        assert_eq!(
            book_for_article(&load_manifest(directory.path()).unwrap(), "new-child")
                .unwrap()
                .id,
            "converted-book"
        );
        assert_eq!(
            book_snapshot_at(directory.path(), "converted-book")
                .unwrap()
                .articles
                .len(),
            3
        );
    }

    #[test]
    fn converted_book_refuses_stale_original_revision_and_asset_path_escape_without_partial_pages()
    {
        let directory = tempfile::tempdir().unwrap();
        let source = store_original(directory.path());
        let draft = book_draft(&source.document.id);
        let mut stale = draft.clone();
        stale.source_revision = 2;
        assert!(save_book_at(directory.path(), stale)
            .unwrap_err()
            .contains("changed or was removed"));
        let mut escaped = draft.clone();
        escaped.assets[0].filename = "../escape.png".into();
        assert!(save_book_at(directory.path(), escaped).is_err());
        fs::create_dir(directory.path().join("assets")).unwrap();
        fs::write(
            directory.path().join("assets/converted-book"),
            b"not a directory",
        )
        .unwrap();
        assert!(save_book_at(directory.path(), draft).is_err());
        let manifest = load_manifest(directory.path()).unwrap();
        assert!(manifest.articles.is_empty());
        assert!(manifest.books.is_empty());
        assert!(manifest.assets.is_empty());
        assert_eq!(
            read_document_at(directory.path(), &source.document.id)
                .unwrap()
                .unwrap()
                .bytes,
            source.bytes
        );
        assert!(asset_path(directory.path(), "../book", "image", false).is_err());
        assert!(asset_path(directory.path(), "book", "../image", false).is_err());
    }

    #[test]
    fn converted_book_snapshot_keeps_deleted_links_and_reports_removed_root_honestly() {
        let directory = tempfile::tempdir().unwrap();
        let source = store_original(directory.path());
        let draft = book_draft(&source.document.id);
        save_book_at(directory.path(), draft).unwrap();
        delete_article_at(directory.path(), "book-chapter", 1).unwrap();
        let snapshot = book_snapshot_at(directory.path(), "converted-book").unwrap();
        assert_eq!(snapshot.articles.len(), 1);
        assert_eq!(snapshot.book.chapter_files[0].article_id, "book-chapter");
        delete_article_at(directory.path(), "book-root", 1).unwrap();
        assert!(book_snapshot_at(directory.path(), "converted-book")
            .unwrap_err()
            .contains("root page was removed"));
        assert!(read_document_at(directory.path(), &source.document.id)
            .unwrap()
            .is_some());
    }

    #[test]
    fn converted_book_migration_copies_assets_atomically_and_refuses_collision_overwrite() {
        let donor = tempfile::tempdir().unwrap();
        let original = store_original(donor.path());
        let draft = book_draft(&original.document.id);
        save_book_at(donor.path(), draft).unwrap();
        let snapshot = book_snapshot_at(donor.path(), "converted-book").unwrap();
        let target = tempfile::tempdir().unwrap();
        let result = migrate_books_at(
            target.path(),
            snapshot.articles.clone(),
            vec![DocumentWithBytes {
                document: original.document.clone(),
                bytes: original.bytes.clone(),
            }],
            vec![snapshot.book.clone()],
            snapshot.assets.clone(),
        )
        .unwrap();
        assert_eq!(
            (
                result.books_copied,
                result.assets_copied,
                result.articles_copied
            ),
            (1, 1, 2)
        );
        let repeated = migrate_books_at(
            target.path(),
            snapshot.articles.clone(),
            vec![],
            vec![snapshot.book.clone()],
            snapshot.assets.clone(),
        )
        .unwrap();
        assert_eq!(repeated.already_present, 4);
        let mut changed = snapshot.assets.clone();
        changed[0].bytes[0] = 99;
        assert!(migrate_books_at(
            target.path(),
            vec![article("uncommitted-new-page", "Do not partially commit")],
            vec![],
            vec![snapshot.book],
            changed
        )
        .is_err());
        assert_eq!(load_manifest(target.path()).unwrap().articles.len(), 2);
        assert_eq!(
            book_snapshot_at(target.path(), "converted-book")
                .unwrap()
                .assets[0]
                .bytes,
            vec![0, 1, 255]
        );
    }

    #[test]
    fn legacy_native_manifest_defaults_new_book_collections_without_resetting_existing_data() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(
            directory.path().join("library.json"),
            br#"{"version":1,"articles":[],"documents":[]}"#,
        )
        .unwrap();
        let manifest = load_manifest(directory.path()).unwrap();
        assert!(manifest.books.is_empty());
        assert!(manifest.assets.is_empty());
        let mut bad = book_draft("missing-original");
        bad.articles[0].source = "x".repeat(MAX_BOOK_SOURCE_BYTES + 1);
        assert!(save_book_at(directory.path(), bad)
            .unwrap_err()
            .contains("16 MB"));
        assert!(load_manifest(directory.path()).unwrap().articles.is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn failed_book_manifest_replace_does_not_publish_chapters_or_book_metadata() {
        let directory = tempfile::tempdir().unwrap();
        let original = store_original(directory.path());
        let draft = book_draft(&original.document.id);
        let path = directory.path().join("library.json");
        let before = fs::read(&path).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(save_book_at(directory.path(), draft.clone()).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        assert!(load_manifest(directory.path()).unwrap().articles.is_empty());
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        // Unreferenced identical asset bytes from the failed attempt are reusable.
        assert!(matches!(
            save_book_at(directory.path(), draft).unwrap(),
            BookSaveResult::Saved { .. }
        ));
    }
}
