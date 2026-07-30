use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::{
    fingerprint_confined_content_file_bounded, is_ignored_content_segment, is_readable_name,
    ContentFileReadError,
};

pub const VAULT_WATCH_EVENT: &str = "verto://vault-watch";
pub const VAULT_WATCH_STATUS_EVENT: &str = "verto://vault-watch-status";
const WATCH_SCHEMA_VERSION: u8 = 1;
const DEBOUNCE_WINDOW: Duration = Duration::from_millis(90);
const MAX_BATCH_DELAY: Duration = Duration::from_millis(450);
const HEALTH_CHECK_INTERVAL: Duration = Duration::from_millis(500);
const RECONNECT_DELAY: Duration = Duration::from_millis(500);

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchSession {
    pub schema_version: u8,
    pub root: String,
    pub generation: u64,
    pub sequence: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchBatch {
    pub schema_version: u8,
    pub root: String,
    pub generation: u64,
    pub sequence: u64,
    pub rescan: bool,
    pub changes: Vec<VaultWatchChange>,
    pub portable_state_rescan: bool,
    pub portable_state_names: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchStatus {
    pub schema_version: u8,
    pub root: String,
    pub generation: u64,
    pub status: VaultWatchAvailability,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum VaultWatchAvailability {
    Available,
    Degraded,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWatchEntry {
    pub path: Vec<String>,
    pub id: String,
    pub size: u64,
    pub mtime: u64,
    pub sha: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VaultWatchChange {
    Upsert {
        entry: VaultWatchEntry,
    },
    Remove {
        id: String,
        path: Vec<String>,
    },
    Rename {
        #[serde(rename = "fromId")]
        from_id: String,
        #[serde(rename = "fromPath")]
        from_path: Vec<String>,
        entry: VaultWatchEntry,
    },
}

struct ActiveWatch {
    generation: u64,
    stopped: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl Drop for ActiveWatch {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RootIdentity {
    canonical: PathBuf,
    first: u64,
    second: u64,
}

struct WatchRegistration {
    _watcher: RecommendedWatcher,
    receiver: mpsc::Receiver<notify::Result<Event>>,
    root_identity: RootIdentity,
}

impl WatchRegistration {
    fn open(root: &Path) -> Result<Self, String> {
        let before = root_identity(root)?;
        let (sender, receiver) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |event| {
            let _ = sender.send(event);
        })
        .map_err(|error| format!("could not create Vault watcher: {error}"))?;
        watcher
            .watch(root, RecursiveMode::Recursive)
            .map_err(|error| format!("could not watch active Vault: {error}"))?;
        let after = root_identity(root)?;
        if before != after {
            return Err("active Vault changed while its watcher was being registered".to_string());
        }
        Ok(Self {
            _watcher: watcher,
            receiver,
            root_identity: after,
        })
    }
}

#[derive(Default)]
pub struct VaultWatchState {
    active: Mutex<Option<ActiveWatch>>,
    next_generation: AtomicU64,
}

impl VaultWatchState {
    pub fn start(
        &self,
        app: AppHandle,
        root: PathBuf,
        renderer_root: String,
    ) -> Result<VaultWatchSession, String> {
        // Serialize starts so a slower earlier request can never replace a
        // newer generation after a Vault switch.
        let mut active = self
            .active
            .lock()
            .map_err(|_| "Vault watcher state is unavailable".to_string())?;
        active.take();

        let generation = self.next_generation.fetch_add(1, Ordering::AcqRel) + 1;
        let registration = WatchRegistration::open(&root)?;

        let stopped = Arc::new(AtomicBool::new(false));
        let worker_stopped = Arc::clone(&stopped);
        let session_root = renderer_root.clone();
        let worker = thread::Builder::new()
            .name(format!("verto-vault-watch-{generation}"))
            .spawn(move || {
                run_watch_worker(
                    app,
                    root,
                    renderer_root,
                    generation,
                    worker_stopped,
                    registration,
                );
            })
            .map_err(|error| format!("could not start Vault watcher worker: {error}"))?;

        *active = Some(ActiveWatch {
            generation,
            stopped,
            worker: Some(worker),
        });

        Ok(VaultWatchSession {
            schema_version: WATCH_SCHEMA_VERSION,
            root: session_root,
            generation,
            sequence: 0,
        })
    }

    pub fn stop(&self, generation: u64) -> Result<(), String> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| "Vault watcher state is unavailable".to_string())?;
        if active
            .as_ref()
            .map(|watch| watch.generation == generation)
            .unwrap_or(false)
        {
            active.take();
        }
        Ok(())
    }
}

fn run_watch_worker(
    app: AppHandle,
    root: PathBuf,
    renderer_root: String,
    generation: u64,
    stopped: Arc<AtomicBool>,
    initial_registration: WatchRegistration,
) {
    let mut sequence = 0u64;
    let mut known = HashMap::<String, (String, u64, u64)>::new();
    let mut registration = Some(initial_registration);
    let mut degraded = false;
    let mut last_health_check = Instant::now();

    while !stopped.load(Ordering::Acquire) {
        if registration.is_none() {
            match WatchRegistration::open(&root) {
                Ok(next) => {
                    if stopped.load(Ordering::Acquire) {
                        break;
                    }
                    registration = Some(next);
                    last_health_check = Instant::now();
                    if degraded {
                        emit_watch_status(
                            &app,
                            &renderer_root,
                            generation,
                            VaultWatchAvailability::Available,
                            None,
                        );
                        sequence += 1;
                        let _ = app.emit(
                            VAULT_WATCH_EVENT,
                            VaultWatchBatch {
                                schema_version: WATCH_SCHEMA_VERSION,
                                root: renderer_root.clone(),
                                generation,
                                sequence,
                                rescan: true,
                                changes: Vec::new(),
                                portable_state_rescan: true,
                                portable_state_names: Vec::new(),
                            },
                        );
                        degraded = false;
                    }
                    continue;
                }
                Err(error) => {
                    if !degraded {
                        known.clear();
                        emit_watch_status(
                            &app,
                            &renderer_root,
                            generation,
                            VaultWatchAvailability::Degraded,
                            Some(error),
                        );
                        degraded = true;
                    }
                    wait_for_reconnect(&stopped);
                    continue;
                }
            }
        }

        let receiver = &registration.as_ref().expect("registration exists").receiver;
        let first = match receiver.recv_timeout(DEBOUNCE_WINDOW) {
            Ok(event) => event,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if last_health_check.elapsed() >= HEALTH_CHECK_INTERVAL {
                    last_health_check = Instant::now();
                    let healthy = registration
                        .as_ref()
                        .map(|watch| root_identity(&root) == Ok(watch.root_identity.clone()))
                        .unwrap_or(false);
                    if !healthy {
                        transition_to_degraded(
                            &app,
                            &renderer_root,
                            generation,
                            &mut known,
                            &mut degraded,
                            "active Vault root is unavailable or was replaced".to_string(),
                        );
                        registration.take();
                    }
                }
                continue;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                transition_to_degraded(
                    &app,
                    &renderer_root,
                    generation,
                    &mut known,
                    &mut degraded,
                    "native Vault watcher channel disconnected".to_string(),
                );
                registration.take();
                continue;
            }
        };

        let started = Instant::now();
        let mut raw = vec![first];
        while started.elapsed() < MAX_BATCH_DELAY {
            match receiver.recv_timeout(DEBOUNCE_WINDOW) {
                Ok(event) => raw.push(event),
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        if stopped.load(Ordering::Acquire) {
            break;
        }

        let runtime_error = raw.iter().find_map(|result| {
            result
                .as_ref()
                .err()
                .map(|error| format!("native Vault watcher failed: {error}"))
        });
        let root_invalidated = raw.iter().any(|result| {
            result
                .as_ref()
                .ok()
                .map(|event| event_invalidates_root(&root, event))
                .unwrap_or(false)
        });
        let root_replaced = registration
            .as_ref()
            .map(|watch| root_identity(&root) != Ok(watch.root_identity.clone()))
            .unwrap_or(true);
        if runtime_error.is_some() || root_invalidated || root_replaced {
            let error = runtime_error.unwrap_or_else(|| {
                if root_invalidated {
                    "active Vault root was removed or renamed".to_string()
                } else {
                    "active Vault root is unavailable or was replaced".to_string()
                }
            });
            transition_to_degraded(
                &app,
                &renderer_root,
                generation,
                &mut known,
                &mut degraded,
                error,
            );
            registration.take();
            continue;
        }

        let coalesced = coalesce_events(&root, raw, &mut known);
        if !coalesced.rescan
            && coalesced.changes.is_empty()
            && !coalesced.portable_state_rescan
            && coalesced.portable_state_names.is_empty()
        {
            continue;
        }
        sequence += 1;
        let batch = VaultWatchBatch {
            schema_version: WATCH_SCHEMA_VERSION,
            root: renderer_root.clone(),
            generation,
            sequence,
            rescan: coalesced.rescan,
            changes: coalesced.changes,
            portable_state_rescan: coalesced.portable_state_rescan,
            portable_state_names: coalesced.portable_state_names,
        };
        let _ = app.emit(VAULT_WATCH_EVENT, batch);
    }
}

fn transition_to_degraded(
    app: &AppHandle,
    renderer_root: &str,
    generation: u64,
    known: &mut HashMap<String, (String, u64, u64)>,
    degraded: &mut bool,
    error: String,
) {
    known.clear();
    if *degraded {
        return;
    }
    emit_watch_status(
        app,
        renderer_root,
        generation,
        VaultWatchAvailability::Degraded,
        Some(error),
    );
    *degraded = true;
}

fn emit_watch_status(
    app: &AppHandle,
    renderer_root: &str,
    generation: u64,
    status: VaultWatchAvailability,
    error: Option<String>,
) {
    let _ = app.emit(
        VAULT_WATCH_STATUS_EVENT,
        VaultWatchStatus {
            schema_version: WATCH_SCHEMA_VERSION,
            root: renderer_root.to_string(),
            generation,
            status,
            error,
        },
    );
}

fn wait_for_reconnect(stopped: &AtomicBool) {
    let started = Instant::now();
    while !stopped.load(Ordering::Acquire) && started.elapsed() < RECONNECT_DELAY {
        thread::sleep(Duration::from_millis(25));
    }
}

struct CoalescedEvents {
    rescan: bool,
    changes: Vec<VaultWatchChange>,
    portable_state_rescan: bool,
    portable_state_names: Vec<String>,
}

fn coalesce_events(
    root: &Path,
    raw: Vec<notify::Result<Event>>,
    known: &mut HashMap<String, (String, u64, u64)>,
) -> CoalescedEvents {
    let mut rescan = false;
    let mut changes = BTreeMap::<String, VaultWatchChange>::new();
    let mut portable_state_rescan = false;
    let mut portable_state_names = BTreeSet::<String>::new();

    for result in raw {
        let event = match result {
            Ok(event) => event,
            Err(_) => {
                rescan = true;
                portable_state_rescan = true;
                continue;
            }
        };
        classify_portable_state_event(
            root,
            &event,
            &mut portable_state_rescan,
            &mut portable_state_names,
        );
        classify_event(root, event, &mut rescan, &mut changes);
    }

    // A source path that is independently recreated or removed in the same
    // burst cannot be represented by a single rename. Applying the sorted
    // change map would otherwise let the rename erase the new source entry in
    // both native fingerprints and the renderer's pending reads.
    if changes.values().any(|change| {
        matches!(
            change,
            VaultWatchChange::Rename { from_id, .. } if changes.contains_key(from_id)
        )
    }) {
        rescan = true;
    }

    // A full listing is authoritative. Keeping fingerprints from before that
    // boundary could suppress the first real change after a subtree was
    // replaced while the backend reported an overflow or ambiguous rename.
    if rescan {
        known.clear();
        return CoalescedEvents {
            rescan: true,
            changes: Vec::new(),
            portable_state_rescan,
            portable_state_names: portable_state_names.into_iter().collect(),
        };
    }

    let mut output = Vec::new();
    for change in changes.into_values() {
        match &change {
            VaultWatchChange::Upsert { entry } => {
                let fingerprint = (entry.sha.clone(), entry.size, entry.mtime);
                if known.get(&entry.id) == Some(&fingerprint) {
                    continue;
                }
                known.insert(entry.id.clone(), fingerprint);
            }
            VaultWatchChange::Remove { id, .. } => {
                known.remove(id);
            }
            VaultWatchChange::Rename { from_id, entry, .. } => {
                known.remove(from_id);
                known.insert(
                    entry.id.clone(),
                    (entry.sha.clone(), entry.size, entry.mtime),
                );
            }
        }
        output.push(change);
    }
    CoalescedEvents {
        rescan,
        changes: output,
        portable_state_rescan,
        portable_state_names: portable_state_names.into_iter().collect(),
    }
}

fn classify_portable_state_event(
    root: &Path,
    event: &Event,
    rescan: &mut bool,
    names: &mut BTreeSet<String>,
) {
    if matches!(event.kind, EventKind::Access(_)) {
        return;
    }

    for path in &event.paths {
        let Ok(relative) = path.strip_prefix(root) else {
            continue;
        };
        let segments = relative
            .components()
            .filter_map(|component| match component {
                Component::Normal(value) => value.to_str(),
                _ => None,
            })
            .collect::<Vec<_>>();
        if segments.first().copied() != Some(".verto") {
            continue;
        }
        if segments.len() == 1 {
            *rescan = true;
            continue;
        }
        // Conflict/recovery artifacts and write-lock activity are internal
        // implementation details. Only direct `<name>.json` state files drive
        // portable cache invalidation.
        if segments.len() != 2 {
            continue;
        }
        let Some(name) = segments[1].strip_suffix(".json") else {
            continue;
        };
        if is_portable_state_name(name) {
            names.insert(name.to_string());
        }
    }
}

fn is_portable_state_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    !bytes.is_empty()
        && bytes[0].is_ascii_alphanumeric()
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'.' | b'_' | b'-'))
}

fn classify_event(
    root: &Path,
    event: Event,
    rescan: &mut bool,
    changes: &mut BTreeMap<String, VaultWatchChange>,
) {
    if !matches!(event.kind, EventKind::Access(_)) && event.paths.iter().any(|path| path == root) {
        *rescan = true;
        return;
    }

    if matches!(
        event.kind,
        EventKind::Create(CreateKind::Folder) | EventKind::Remove(RemoveKind::Folder)
    ) && event
        .paths
        .iter()
        .any(|path| visible_relative(root, path).is_some())
    {
        *rescan = true;
        return;
    }

    if matches!(
        event.kind,
        EventKind::Modify(ModifyKind::Name(RenameMode::Both))
    ) && event.paths.len() >= 2
    {
        let touches_visible_path = event
            .paths
            .iter()
            .any(|path| path == root || visible_relative(root, path).is_some());
        if touches_visible_path && event.paths.iter().any(|path| is_existing_directory(path)) {
            *rescan = true;
            return;
        }
        classify_rename(root, &event.paths[0], &event.paths[1], rescan, changes);
        return;
    }

    if matches!(event.kind, EventKind::Access(_)) {
        return;
    }

    if matches!(event.kind, EventKind::Modify(ModifyKind::Name(_))) {
        // Some backends split a rename across independent From/To events. A
        // metadata rescan is the only portable way to pair them reliably.
        if event
            .paths
            .iter()
            .any(|path| visible_relative(root, path).is_some())
        {
            *rescan = true;
        }
        return;
    }

    for path in event.paths {
        let Some(relative) = visible_relative(root, &path) else {
            continue;
        };
        if is_existing_directory(&path) {
            *rescan = true;
            continue;
        }
        if !is_readable_path(&path) {
            // A backend may not retain the file/folder distinction after a
            // removal. Relist rather than leave descendants of an ambiguously
            // removed directory in the renderer index.
            if matches!(event.kind, EventKind::Remove(_)) {
                *rescan = true;
            }
            continue;
        }

        match event.kind {
            EventKind::Remove(RemoveKind::File) => insert_remove(&path, relative, rescan, changes),
            EventKind::Remove(_) => {
                *rescan = true;
            }
            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Any | EventKind::Other => {
                match entry_for_path(root, &path) {
                    ContentEntryLookup::Ready(entry) => insert_upsert(entry, changes),
                    ContentEntryLookup::Oversized { id, path } => {
                        insert_remove_id(id, path, rescan, changes)
                    }
                    // A readable path that cannot be fingerprinted may be in
                    // the middle of an atomic replacement or temporarily
                    // unreadable. A targeted remove would discard confirmed
                    // state, so recover through an authoritative listing.
                    ContentEntryLookup::Unavailable => *rescan = true,
                }
            }
            EventKind::Access(_) => {}
        }
    }
}

fn classify_rename(
    root: &Path,
    from: &Path,
    to: &Path,
    rescan: &mut bool,
    changes: &mut BTreeMap<String, VaultWatchChange>,
) {
    let from_relative = visible_relative(root, from);
    let to_relative = visible_relative(root, to);
    let from_readable = from_relative.is_some() && is_readable_path(from);
    let to_readable = to_relative.is_some() && is_readable_path(to);

    match (from_readable, to_readable) {
        (true, true) => {
            let entry = match entry_for_path(root, to) {
                ContentEntryLookup::Ready(entry) => entry,
                // The source identity must disappear, and the destination may
                // replace a previously indexed note. A full listing is the
                // only lossless representation when the destination is now
                // beyond the content limit.
                ContentEntryLookup::Oversized { .. } | ContentEntryLookup::Unavailable => {
                    *rescan = true;
                    return;
                }
            };
            let from_id = renderer_path_text(from);
            let (source_id, source_path) = match changes.remove(&from_id) {
                Some(VaultWatchChange::Rename {
                    from_id, from_path, ..
                }) => (from_id, from_path),
                // The backend does not tell us whether an adjacent source-path
                // upsert/remove is a rename echo or a distinct recreation.
                // Relist rather than erase a real file that now occupies the
                // old name.
                Some(VaultWatchChange::Upsert { .. }) | Some(VaultWatchChange::Remove { .. }) => {
                    *rescan = true;
                    return;
                }
                None => (from_id, from_relative.unwrap_or_default()),
            };
            if source_id == entry.id || changes.contains_key(&entry.id) {
                *rescan = true;
                return;
            }
            changes.insert(
                entry.id.clone(),
                VaultWatchChange::Rename {
                    from_id: source_id,
                    from_path: source_path,
                    entry,
                },
            );
        }
        (true, false) => {
            insert_remove(from, from_relative.unwrap_or_default(), rescan, changes);
        }
        (false, true) => match entry_for_path(root, to) {
            ContentEntryLookup::Ready(entry) => insert_upsert(entry, changes),
            ContentEntryLookup::Oversized { id, path } => {
                insert_remove_id(id, path, rescan, changes)
            }
            ContentEntryLookup::Unavailable => *rescan = true,
        },
        (false, false) => {
            if from_relative.is_some() || to_relative.is_some() {
                *rescan = true;
            }
        }
    }
}

fn insert_upsert(entry: VaultWatchEntry, changes: &mut BTreeMap<String, VaultWatchChange>) {
    if let Some(VaultWatchChange::Rename {
        entry: renamed_entry,
        ..
    }) = changes.get_mut(&entry.id)
    {
        // Preserve the old identity when a modify echo follows a rename while
        // refreshing the final fingerprint from disk.
        *renamed_entry = entry;
        return;
    }
    changes.insert(entry.id.clone(), VaultWatchChange::Upsert { entry });
}

fn insert_remove(
    path: &Path,
    relative: Vec<String>,
    rescan: &mut bool,
    changes: &mut BTreeMap<String, VaultWatchChange>,
) {
    insert_remove_id(renderer_path_text(path), relative, rescan, changes);
}

fn insert_remove_id(
    id: String,
    relative: Vec<String>,
    rescan: &mut bool,
    changes: &mut BTreeMap<String, VaultWatchChange>,
) {
    if let Some(VaultWatchChange::Rename {
        from_id, from_path, ..
    }) = changes.remove(&id)
    {
        if changes.contains_key(&from_id) {
            *rescan = true;
            return;
        }
        changes.insert(
            from_id.clone(),
            VaultWatchChange::Remove {
                id: from_id,
                path: from_path,
            },
        );
        return;
    }
    changes.insert(id.clone(), VaultWatchChange::Remove { id, path: relative });
}

enum ContentEntryLookup {
    Ready(VaultWatchEntry),
    Oversized { id: String, path: Vec<String> },
    Unavailable,
}

fn entry_for_path(root: &Path, path: &Path) -> ContentEntryLookup {
    let Some(relative) = visible_relative(root, path) else {
        return ContentEntryLookup::Unavailable;
    };
    if !is_readable_path(path) {
        return ContentEntryLookup::Unavailable;
    }
    let Ok(link_metadata) = fs::symlink_metadata(path) else {
        return ContentEntryLookup::Unavailable;
    };
    if link_metadata.file_type().is_symlink() || !link_metadata.is_file() {
        return ContentEntryLookup::Unavailable;
    }
    let Ok(canonical) = fs::canonicalize(path) else {
        return ContentEntryLookup::Unavailable;
    };
    if !canonical.starts_with(root) {
        return ContentEntryLookup::Unavailable;
    }
    let fingerprint = match fingerprint_confined_content_file_bounded(root, &canonical) {
        Ok(fingerprint) => fingerprint,
        Err(ContentFileReadError::TooLarge) => {
            return ContentEntryLookup::Oversized {
                id: renderer_path_text(&canonical),
                path: relative,
            }
        }
        Err(
            ContentFileReadError::ChangedDuringRead
            | ContentFileReadError::Unsafe(_)
            | ContentFileReadError::Io(_),
        ) => return ContentEntryLookup::Unavailable,
    };
    ContentEntryLookup::Ready(VaultWatchEntry {
        path: relative,
        id: renderer_path_text(&canonical),
        size: fingerprint.size,
        mtime: fingerprint.mtime.unwrap_or(0),
        sha: fingerprint.sha,
    })
}

fn visible_relative(root: &Path, path: &Path) -> Option<Vec<String>> {
    let relative = path.strip_prefix(root).ok()?;
    let mut segments = Vec::new();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            continue;
        };
        let segment = part.to_str()?.to_string();
        if is_ignored_content_segment(&segment) {
            return None;
        }
        segments.push(segment);
    }
    (!segments.is_empty()).then_some(segments)
}

fn is_readable_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(is_readable_name)
        .unwrap_or(false)
}

fn is_existing_directory(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.is_dir())
        .unwrap_or(false)
}

fn event_invalidates_root(root: &Path, event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    ) && event.paths.iter().any(|path| path == root)
}

fn root_identity(root: &Path) -> Result<RootIdentity, String> {
    let canonical = fs::canonicalize(root)
        .map_err(|error| format!("could not resolve active Vault root: {error}"))?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| format!("could not inspect active Vault root: {error}"))?;
    if !metadata.is_dir() {
        return Err("active Vault root is not a directory".to_string());
    }
    let (first, second) = platform_root_identity(&canonical, &metadata)?;
    Ok(RootIdentity {
        canonical,
        first,
        second,
    })
}

#[cfg(unix)]
fn platform_root_identity(_path: &Path, metadata: &fs::Metadata) -> Result<(u64, u64), String> {
    use std::os::unix::fs::MetadataExt;

    Ok((metadata.dev(), metadata.ino()))
}

#[cfg(windows)]
fn platform_root_identity(path: &Path, _metadata: &fs::Metadata) -> Result<(u64, u64), String> {
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };

    let directory = fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)
        .map_err(|error| format!("could not open active Vault root: {error}"))?;
    let mut information = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
    let succeeded = unsafe {
        GetFileInformationByHandle(directory.as_raw_handle() as _, &mut information as *mut _)
    };
    if succeeded == 0 {
        return Err(format!(
            "could not identify active Vault root: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok((
        u64::from(information.dwVolumeSerialNumber),
        ((information.nFileIndexHigh as u64) << 32) | information.nFileIndexLow as u64,
    ))
}

#[cfg(not(any(unix, windows)))]
fn platform_root_identity(_path: &Path, metadata: &fs::Metadata) -> Result<(u64, u64), String> {
    let modified = modified_millis(metadata);
    Ok((metadata.len(), modified))
}

#[cfg(not(any(unix, windows)))]
fn modified_millis(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn renderer_path_text(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        value.into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, ModifyKind, RemoveKind};
    use sha2::{Digest, Sha256};
    use tempfile::tempdir;

    fn event(kind: EventKind, paths: Vec<PathBuf>) -> Event {
        Event {
            kind,
            paths,
            attrs: Default::default(),
        }
    }

    #[test]
    fn upsert_contains_sha_revision_and_duplicate_echoes_are_coalesced() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let note = root.join("note.md");
        fs::write(&note, "# Saved").expect("write note");
        let raw = vec![
            Ok(event(
                EventKind::Modify(ModifyKind::Any),
                vec![note.clone()],
            )),
            Ok(event(
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                vec![note.clone()],
            )),
        ];

        let CoalescedEvents { changes, .. } = coalesce_events(&root, raw, &mut HashMap::new());
        assert_eq!(changes.len(), 1);
        let VaultWatchChange::Upsert { entry } = &changes[0] else {
            panic!("expected upsert");
        };
        assert_eq!(entry.sha, format!("{:x}", Sha256::digest(b"# Saved")));
    }

    #[test]
    fn a_previously_indexed_file_that_becomes_oversized_is_removed_without_a_rescan_loop() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let note = root.join("note.md");
        fs::File::create(&note)
            .expect("create oversized note")
            .set_len(crate::MAX_CONTENT_FILE_BYTES + 1)
            .expect("extend oversized note");
        let id = renderer_path_text(&note);
        let mut known = HashMap::from([(id.clone(), ("old-sha".to_string(), 7, 1_000))]);

        let CoalescedEvents {
            rescan, changes, ..
        } = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                vec![note],
            ))],
            &mut known,
        );

        assert!(!rescan);
        assert_eq!(
            changes,
            vec![VaultWatchChange::Remove {
                id: id.clone(),
                path: vec!["note.md".to_string()],
            }]
        );
        assert!(!known.contains_key(&id));
    }

    #[test]
    fn hidden_state_and_temporary_files_are_ignored() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let state_dir = root.join(".verto");
        fs::create_dir(&state_dir).expect("state directory");
        let state = state_dir.join("threads.md");
        let temporary = root.join("note.md.tmp");
        let temporary_dir = root.join("scratch.tmp");
        fs::create_dir(&temporary_dir).expect("temporary directory");
        let nested_temporary = temporary_dir.join("note.md");
        fs::write(&state, "state").expect("state");
        fs::write(&temporary, "temporary").expect("temporary");
        fs::write(&nested_temporary, "temporary").expect("nested temporary");

        let CoalescedEvents { changes, .. } = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Create(CreateKind::Any),
                vec![state, temporary, nested_temporary],
            ))],
            &mut HashMap::new(),
        );

        assert!(changes.is_empty());
    }

    #[test]
    fn direct_portable_state_changes_are_reported_without_content_work() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let state_dir = root.join(".verto");
        fs::create_dir(&state_dir).expect("state directory");
        let bookmarks = state_dir.join("bookmarks.json");
        fs::write(&bookmarks, "{}").expect("portable state");

        let CoalescedEvents {
            rescan,
            changes,
            portable_state_rescan,
            portable_state_names,
        } = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                vec![bookmarks],
            ))],
            &mut HashMap::new(),
        );

        assert!(!rescan);
        assert!(changes.is_empty());
        assert!(!portable_state_rescan);
        assert_eq!(portable_state_names, vec!["bookmarks"]);
    }

    #[test]
    fn portable_state_internal_artifacts_are_ignored_and_root_changes_rescan() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let state_dir = root.join(".verto");
        let conflict = state_dir.join("conflicts").join("bookmarks.json");
        let recovery = state_dir.join("recovery").join("bookmarks.json");
        let temporary = state_dir.join(".verto-write-bookmarks.tmp");

        let internal = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Create(CreateKind::File),
                vec![conflict, recovery, temporary],
            ))],
            &mut HashMap::new(),
        );
        assert!(!internal.rescan);
        assert!(internal.changes.is_empty());
        assert!(!internal.portable_state_rescan);
        assert!(internal.portable_state_names.is_empty());

        let root_change = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Remove(RemoveKind::Folder),
                vec![state_dir],
            ))],
            &mut HashMap::new(),
        );
        assert!(!root_change.rescan);
        assert!(root_change.changes.is_empty());
        assert!(root_change.portable_state_rescan);
        assert!(root_change.portable_state_names.is_empty());
    }

    #[test]
    fn a_portable_both_rename_keeps_old_and_new_identity() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let from = root.join("old.md");
        let to = root.join("new.mdx");
        fs::write(&to, "# Renamed").expect("renamed note");

        let CoalescedEvents { changes, .. } = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                vec![from.clone(), to.clone()],
            ))],
            &mut HashMap::new(),
        );

        assert_eq!(changes.len(), 1);
        assert!(matches!(
            &changes[0],
            VaultWatchChange::Rename {
                from_id,
                entry,
                ..
            } if from_id == &renderer_path_text(&from) && entry.id == renderer_path_text(&to)
        ));
    }

    #[test]
    fn a_modify_echo_after_rename_preserves_the_old_identity() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let from = root.join("old.md");
        let to = root.join("new.md");
        fs::write(&to, "# Renamed and changed").expect("renamed note");

        let CoalescedEvents {
            rescan, changes, ..
        } = coalesce_events(
            &root,
            vec![
                Ok(event(
                    EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                    vec![from.clone(), to.clone()],
                )),
                Ok(event(
                    EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                    vec![to.clone()],
                )),
            ],
            &mut HashMap::new(),
        );

        assert!(!rescan);
        assert_eq!(changes.len(), 1);
        assert!(matches!(
            &changes[0],
            VaultWatchChange::Rename {
                from_id,
                entry,
                ..
            } if from_id == &renderer_path_text(&from)
                && entry.id == renderer_path_text(&to)
                && entry.sha == format!("{:x}", Sha256::digest(b"# Renamed and changed"))
        ));
    }

    #[test]
    fn rename_and_recreated_source_force_a_rescan_in_either_event_order() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let from = root.join("a.md");
        let to = root.join("z.md");
        fs::write(&from, "# Recreated source").expect("recreated source");
        fs::write(&to, "# Renamed destination").expect("renamed destination");

        for rename_first in [true, false] {
            let rename = Ok(event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                vec![from.clone(), to.clone()],
            ));
            let recreate = Ok(event(
                EventKind::Create(CreateKind::File),
                vec![from.clone()],
            ));
            let raw = if rename_first {
                vec![rename, recreate]
            } else {
                vec![recreate, rename]
            };
            let mut known = HashMap::from([(
                renderer_path_text(&from),
                ("old-source".to_string(), 10, 10),
            )]);

            let CoalescedEvents {
                rescan, changes, ..
            } = coalesce_events(&root, raw, &mut known);

            assert!(rescan);
            assert!(changes.is_empty());
            assert!(
                known.is_empty(),
                "an authoritative rescan must not advance stale native fingerprints"
            );
        }
    }

    #[test]
    fn an_unresolvable_rename_chain_forces_an_authoritative_rescan() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let first = root.join("first.md");
        let middle = root.join("middle.md");
        let final_path = root.join("final.md");
        fs::write(&final_path, "# Final").expect("final note");

        let CoalescedEvents {
            rescan, changes, ..
        } = coalesce_events(
            &root,
            vec![
                Ok(event(
                    EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                    vec![first, middle.clone()],
                )),
                Ok(event(
                    EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                    vec![middle, final_path],
                )),
            ],
            &mut HashMap::new(),
        );

        assert!(rescan);
        assert!(changes.is_empty());
    }

    #[test]
    fn root_and_directory_create_remove_and_rename_force_rescans() {
        let fixture = tempdir().expect("temp Vault");
        let root_path = fixture.path().join("vault");
        fs::create_dir(&root_path).expect("Vault directory");
        let root = fs::canonicalize(&root_path).expect("canonical Vault");
        let created = root.join("created.md");
        fs::create_dir(&created).expect("directory with readable-looking suffix");
        let renamed_from = root.join("before.folder");
        let renamed_to = root.join("after.folder");
        fs::create_dir(&renamed_to).expect("renamed directory");
        let moved_outside = fixture.path().join("moved-outside.md");
        fs::create_dir(&moved_outside).expect("directory moved outside");

        for raw in [
            event(EventKind::Create(CreateKind::Folder), vec![root.clone()]),
            event(EventKind::Create(CreateKind::Folder), vec![created.clone()]),
            event(
                EventKind::Remove(RemoveKind::Folder),
                vec![root.join("removed.with-extension")],
            ),
            event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                vec![renamed_from.clone(), renamed_to.clone()],
            ),
            event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                vec![root.join("moved-outside.md"), moved_outside],
            ),
        ] {
            let CoalescedEvents {
                rescan, changes, ..
            } = coalesce_events(&root, vec![Ok(raw)], &mut HashMap::new());
            assert!(rescan);
            assert!(changes.is_empty());
        }
    }

    #[test]
    fn a_rescan_clears_previously_known_fingerprints() {
        let fixture = tempdir().expect("temp Vault");
        let root = fs::canonicalize(fixture.path()).expect("canonical Vault");
        let mut known = HashMap::from([(
            renderer_path_text(&root.join("old.md")),
            ("old-sha".to_string(), 1, 1),
        )]);

        let CoalescedEvents { rescan, .. } = coalesce_events(
            &root,
            vec![Ok(event(
                EventKind::Remove(RemoveKind::Folder),
                vec![root.join("folder")],
            ))],
            &mut known,
        );

        assert!(rescan);
        assert!(known.is_empty());
    }

    #[test]
    fn root_identity_detects_replacement_at_the_same_path() {
        let fixture = tempdir().expect("temp parent");
        let root = fixture.path().join("vault");
        let moved = fixture.path().join("old-vault");
        fs::create_dir(&root).expect("create Vault");
        let first = root_identity(&root).expect("first identity");

        fs::rename(&root, &moved).expect("move old Vault");
        fs::create_dir(&root).expect("recreate Vault");
        let second = root_identity(&root).expect("second identity");

        assert_ne!(first, second);
    }

    #[test]
    fn remove_or_rename_of_the_root_invalidates_the_registration() {
        let root = PathBuf::from("C:/Vault");
        assert!(event_invalidates_root(
            &root,
            &event(EventKind::Remove(RemoveKind::Folder), vec![root.clone()])
        ));
        assert!(event_invalidates_root(
            &root,
            &event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                vec![root.clone(), PathBuf::from("C:/Moved")]
            )
        ));
        assert!(!event_invalidates_root(
            &root,
            &event(
                EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
                vec![root.join("note.md")]
            )
        ));
    }

    #[test]
    fn renderer_ids_strip_windows_verbatim_prefixes() {
        assert_eq!(
            renderer_path_text(Path::new(r"\\?\C:\Vault\note.md")),
            r"C:\Vault\note.md"
        );
        assert_eq!(
            renderer_path_text(Path::new(r"\\?\UNC\server\share\note.md")),
            r"\\server\share\note.md"
        );
    }
}
