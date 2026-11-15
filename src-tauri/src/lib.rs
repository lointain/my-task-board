use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use chrono::{DateTime, Datelike, Duration as ChronoDuration, Local, NaiveDate, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// State / models
// ---------------------------------------------------------------------------

struct AppState {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Task {
    id: String,
    parent_id: Option<String>,
    title: String,
    status: String,
    due_at: Option<String>,
    recurrence: Option<String>,
    color: Option<String>,
    emoji: Option<String>,
    sort_order: f64,
    note_json: Option<String>,
    note_text: Option<String>,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
    deleted_at: Option<String>,
    effective_due: Option<String>,
    due_source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Placement {
    id: String,
    task_id: String,
    board: String,
    scheduled_date: Option<String>,
    x: f64,
    y: f64,
    momentum_mode: String,
    vx: f64,
    vy: f64,
    momentum_updated_at: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TagGroup {
    id: String,
    name: String,
    mode: String,
    is_free: bool,
    color: Option<String>,
    sort_order: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Tag {
    id: String,
    group_id: String,
    name: String,
    color: Option<String>,
    sort_order: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppData {
    tasks: Vec<Task>,
    placements: Vec<Placement>,
    tag_groups: Vec<TagGroup>,
    tags: Vec<Tag>,
    settings: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TagBundle {
    groups: Vec<TagGroup>,
    tags: Vec<Tag>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StatsPayload {
    completed: Vec<Task>,
    overdue: Vec<Task>,
    completed_count: usize,
    overdue_count: usize,
    due_today: usize,
    due_week: usize,
    week_start: String,
    week_end: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskCreate {
    title: String,
    parent_id: Option<String>,
    color: Option<String>,
    emoji: Option<String>,
    /// 新建节点插到这个同级节点之后；为空则追加到末尾。
    after_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskPatch {
    title: Option<String>,
    status: Option<String>,
    due_at: Option<String>,
    parent_id: Option<String>,
    sort_order: Option<f64>,
    note_json: Option<String>,
    note_text: Option<String>,
    color: Option<String>,
    emoji: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlacementInput {
    task_id: String,
    board: String,
    scheduled_date: Option<String>,
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MomentumInput {
    task_id: String,
    due_at: Option<String>,
    mode: String,
    vx: f64,
    vy: f64,
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn today_string() -> String {
    today().format("%Y-%m-%d").to_string()
}

fn weekday_board(date: NaiveDate) -> &'static str {
    match date.weekday() {
        chrono::Weekday::Mon => "mon",
        chrono::Weekday::Tue => "tue",
        chrono::Weekday::Wed => "wed",
        chrono::Weekday::Thu => "thu",
        chrono::Weekday::Fri => "fri",
        chrono::Weekday::Sat => "sat",
        chrono::Weekday::Sun => "sun",
    }
}

fn week_bounds() -> (NaiveDate, NaiveDate) {
    let t = today();
    let start = t - ChronoDuration::days(t.weekday().num_days_from_monday() as i64);
    (start, start + ChronoDuration::days(6))
}

fn clamp(v: f64) -> f64 {
    v.clamp(0.0, 100.0)
}

fn is_valid_board(board: &str) -> bool {
    matches!(board, "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | "week")
}

fn is_valid_status(status: &str) -> bool {
    matches!(status, "todo" | "doing" | "done" | "archived")
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

fn days_left(due: &str) -> f64 {
    let Some(due_date) = parse_date(due) else {
        return 0.0;
    };
    let today = today();
    if due_date <= today {
        return 0.0;
    }
    (due_date - today).num_days() as f64
}

fn calc_auto_vx(x: f64, due: &str) -> f64 {
    let left = days_left(due);
    if left <= 0.0 {
        0.0
    } else {
        (100.0 - x) / left
    }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

fn init_db(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;
         PRAGMA busy_timeout=5000;",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id),
            parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo','doing','done','archived')),
            due_at TEXT,
            recurrence TEXT,
            color TEXT,
            emoji TEXT,
            sort_order REAL NOT NULL DEFAULT 0,
            note_json TEXT,
            note_text TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS tag_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            mode TEXT NOT NULL CHECK (mode IN ('single','multi')),
            is_free INTEGER NOT NULL DEFAULT 0,
            color TEXT,
            sort_order REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT,
            sort_order REAL NOT NULL DEFAULT 0,
            UNIQUE (group_id, name)
        );

        CREATE TABLE IF NOT EXISTS task_tags (
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS chart_placements (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
            board TEXT NOT NULL CHECK (board IN ('mon','tue','wed','thu','fri','sat','sun','week')),
            scheduled_date TEXT,
            x REAL NOT NULL CHECK (x BETWEEN 0 AND 100),
            y REAL NOT NULL CHECK (y BETWEEN 0 AND 100),
            momentum_mode TEXT NOT NULL DEFAULT 'manual'
                CHECK (momentum_mode IN ('auto','manual')),
            vx REAL NOT NULL DEFAULT 0.25,
            vy REAL NOT NULL DEFAULT 0,
            momentum_updated_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            owner_id TEXT NOT NULL REFERENCES users(id),
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (owner_id, key)
        );

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    let now = now_iso();
    conn.execute(
        "INSERT OR IGNORE INTO users (id, display_name, created_at) VALUES ('local', 'Local', ?1)",
        params![now],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
        params![now],
    )?;

    // v2：给已有库补 emoji 列（新库建表时已包含）
    let has_emoji: bool = conn
        .prepare("PRAGMA table_info(tasks)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name == "emoji");
    if !has_emoji {
        conn.execute_batch("ALTER TABLE tasks ADD COLUMN emoji TEXT;")?;
    }
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (2, ?1)",
        params![now],
    )?;

    for (key, value) in [
        ("momentum_default", "0.25"),
        ("show_momentum", "true"),
        ("momentum_horizon_days", "7"),
        ("color_by", "project"),
        ("theme", "dark"),
        ("week_starts_on", "mon"),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO settings (owner_id, key, value) VALUES ('local', ?1, ?2)",
            params![key, value],
        )?;
    }

    let group_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM tag_groups", [], |row| row.get(0))?;
    if group_count == 0 {
        conn.execute(
            "INSERT INTO tag_groups (id, name, mode, is_free, color, sort_order)
             VALUES ('g_domain', '领域', 'single', 0, '#34d399', 0)",
            [],
        )?;
        for (i, (id, name, color)) in [
            ("t_work", "工作", "#f87171"),
            ("t_life", "生活", "#34d399"),
            ("t_learn", "学习", "#60a5fa"),
        ]
        .into_iter()
        .enumerate()
        {
            conn.execute(
                "INSERT INTO tags (id, group_id, name, color, sort_order)
                 VALUES (?1, 'g_domain', ?2, ?3, ?4)",
                params![id, name, color, i as f64],
            )?;
        }
        conn.execute(
            "INSERT INTO tag_groups (id, name, mode, is_free, color, sort_order)
             VALUES ('g_free', '标签', 'multi', 1, '#c084fc', 1)",
            [],
        )?;
    }

    Ok(conn)
}

// ---------------------------------------------------------------------------
// Due inheritance
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct DueNode {
    parent_id: Option<String>,
    due_at: Option<String>,
    title: String,
}

fn resolve_due(
    id: &str,
    nodes: &HashMap<String, DueNode>,
    memo: &mut HashMap<String, Option<(String, String)>>,
) -> Option<(String, String)> {
    if let Some(cached) = memo.get(id) {
        return cached.clone();
    }
    let Some(node) = nodes.get(id) else {
        return None;
    };
    let result = if let Some(due) = node.due_at.as_ref().filter(|d| !d.is_empty()) {
        Some((due.clone(), node.title.clone()))
    } else if let Some(parent) = node.parent_id.as_ref() {
        resolve_due(parent, nodes, memo)
    } else {
        None
    };
    memo.insert(id.to_string(), result.clone());
    result
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

fn load_tasks(conn: &Connection) -> Result<Vec<Task>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, title, status, due_at, recurrence, color, emoji, sort_order,
                    note_json, note_text, created_at, updated_at, completed_at, deleted_at
             FROM tasks WHERE deleted_at IS NULL
             ORDER BY sort_order ASC, created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                due_at: row.get(4)?,
                recurrence: row.get(5)?,
                color: row.get(6)?,
                emoji: row.get(7)?,
                sort_order: row.get(8)?,
                note_json: row.get(9)?,
                note_text: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                completed_at: row.get(13)?,
                deleted_at: row.get(14)?,
                effective_due: None,
                due_source: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks: Vec<Task> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let nodes: HashMap<String, DueNode> = tasks
        .iter()
        .map(|t| {
            (
                t.id.clone(),
                DueNode {
                    parent_id: t.parent_id.clone(),
                    due_at: t.due_at.clone(),
                    title: t.title.clone(),
                },
            )
        })
        .collect();
    let mut memo = HashMap::new();
    for task in &mut tasks {
        if let Some((due, owner)) = resolve_due(&task.id, &nodes, &mut memo) {
            task.effective_due = Some(due);
            task.due_source = if task.due_at.as_deref().is_some_and(|d| !d.is_empty()) {
                Some("own".to_string())
            } else {
                Some(owner)
            };
        }
    }
    Ok(tasks)
}

fn load_placements(conn: &Connection) -> Result<Vec<Placement>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.task_id, p.board, p.scheduled_date, p.x, p.y,
                    p.momentum_mode, p.vx, p.vy, p.momentum_updated_at,
                    p.created_at, p.updated_at
             FROM chart_placements p
             JOIN tasks t ON t.id = p.task_id
             WHERE t.deleted_at IS NULL",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Placement {
                id: row.get(0)?,
                task_id: row.get(1)?,
                board: row.get(2)?,
                scheduled_date: row.get(3)?,
                x: row.get(4)?,
                y: row.get(5)?,
                momentum_mode: row.get(6)?,
                vx: row.get(7)?,
                vy: row.get(8)?,
                momentum_updated_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_tag_groups(conn: &Connection) -> Result<Vec<TagGroup>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, mode, is_free, color, sort_order FROM tag_groups ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TagGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                mode: row.get(2)?,
                is_free: row.get::<_, i64>(3)? != 0,
                color: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_tags(conn: &Connection) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare("SELECT id, group_id, name, color, sort_order FROM tags ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                group_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_settings(conn: &Connection) -> Result<HashMap<String, String>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings WHERE owner_id = 'local'")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        map.insert(k, v);
    }
    Ok(map)
}

fn default_momentum(conn: &Connection) -> f64 {
    load_settings(conn)
        .ok()
        .and_then(|s| s.get("momentum_default").cloned())
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.25)
}

// ---------------------------------------------------------------------------
// Rollover / momentum
// ---------------------------------------------------------------------------

fn rollover(conn: &Connection) -> Result<(), String> {
    let today_s = today_string();
    let board = weekday_board(today());
    let now = now_iso();
    conn.execute(
        "UPDATE chart_placements
         SET scheduled_date = ?1, board = ?2, updated_at = ?3
         WHERE board != 'week'
           AND scheduled_date IS NOT NULL
           AND scheduled_date < ?1
           AND task_id IN (
             SELECT id FROM tasks
             WHERE deleted_at IS NULL AND status NOT IN ('done','archived')
           )",
        params![today_s, board, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn advance_momentum(conn: &Connection) -> Result<(), String> {
    let tasks = load_tasks(conn)?;
    let due_map: HashMap<String, Option<String>> = tasks
        .iter()
        .map(|t| (t.id.clone(), t.effective_due.clone()))
        .collect();

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.task_id, p.x, p.y, p.momentum_mode, p.vx, p.vy, p.momentum_updated_at
             FROM chart_placements p
             JOIN tasks t ON t.id = p.task_id
             WHERE t.deleted_at IS NULL AND t.status NOT IN ('done','archived')",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let now = Utc::now();
    let mut updates = Vec::new();
    for row in rows {
        let (id, task_id, x, y, mode, vx, vy, updated) = row.map_err(|e| e.to_string())?;
        let Ok(updated_at) = DateTime::parse_from_rfc3339(&updated) else {
            continue;
        };
        let elapsed_days = (now - updated_at.with_timezone(&Utc)).num_seconds() as f64 / 86400.0;
        if elapsed_days <= 0.0 {
            continue;
        }

        let mut new_x = x;
        let mut new_y = y;
        let mut new_vx = vx;
        let new_vy = vy;

        if mode == "auto" {
            if let Some(Some(due)) = due_map.get(&task_id) {
                let left = days_left(due);
                if left <= 0.0 {
                    new_x = 100.0;
                    new_vx = 0.0;
                } else {
                    new_vx = (100.0 - x) / left;
                    new_x = clamp(x + new_vx * elapsed_days);
                }
            }
        } else {
            new_x = clamp(x + vx * elapsed_days);
            new_y = clamp(y + vy * elapsed_days);
        }

        updates.push((id, new_x, new_y, new_vx, new_vy));
    }

    let now_s = now_iso();
    for (id, x, y, vx, vy) in updates {
        conn.execute(
            "UPDATE chart_placements
             SET x = ?2, y = ?3, vx = ?4, vy = ?5, momentum_updated_at = ?6, updated_at = ?6
             WHERE id = ?1",
            params![id, x, y, vx, vy, now_s],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn refresh(conn: &Connection) -> Result<(), String> {
    rollover(conn)?;
    advance_momentum(conn)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn bootstrap(state: State<'_, AppState>) -> Result<AppData, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    refresh(&conn)?;
    Ok(AppData {
        tasks: load_tasks(&conn)?,
        placements: load_placements(&conn)?,
        tag_groups: load_tag_groups(&conn)?,
        tags: load_tags(&conn)?,
        settings: load_settings(&conn)?,
    })
}

#[tauri::command]
fn task_create(state: State<'_, AppState>, input: TaskCreate) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("标题不能为空".into());
    }
    if let Some(parent) = input.parent_id.as_deref() {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
                params![parent],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err("父任务不存在".into());
        }
    }
    let sort_order: f64 = if let Some(after_id) = input.after_id.as_deref() {
        let after: (Option<String>, f64) = conn
            .query_row(
                "SELECT parent_id, sort_order FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
                params![after_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| "插入位置不存在".to_string())?;
        let next: Option<f64> = conn
            .query_row(
                "SELECT MIN(sort_order) FROM tasks
                 WHERE deleted_at IS NULL
                   AND IFNULL(parent_id,'') = IFNULL(?1,'')
                   AND sort_order > ?2",
                params![input.parent_id, after.1],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();
        match next {
            Some(next_order) => (after.1 + next_order) / 2.0,
            None => after.1 + 1.0,
        }
    } else {
        conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks
             WHERE deleted_at IS NULL AND IFNULL(parent_id,'') = IFNULL(?1,'')",
            params![input.parent_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    conn.execute(
        "INSERT INTO tasks
         (id, owner_id, parent_id, title, status, sort_order, color, emoji, created_at, updated_at)
         VALUES (?1, 'local', ?2, ?3, 'todo', ?4, ?5, ?6, ?7, ?7)",
        params![
            id,
            input.parent_id,
            title,
            sort_order,
            input.color,
            input.emoji,
            now
        ],
    )
    .map_err(|e| e.to_string())?;
    load_tasks(&conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| "创建后未找到任务".into())
}

#[tauri::command]
fn task_update(state: State<'_, AppState>, id: String, patch: TaskPatch) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let current = load_tasks(&conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| "任务不存在".to_string())?;

    let title = patch
        .title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or(current.title);
    let previous_status = current.status.clone();
    let status = patch.status.unwrap_or_else(|| current.status.clone());
    if !is_valid_status(&status) {
        return Err("非法状态".into());
    }
    let due_at = match patch.due_at {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
        None => current.due_at,
    };
    let parent_id = match patch.parent_id {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
        None => current.parent_id,
    };
    if parent_id.as_deref() == Some(id.as_str()) {
        return Err("不能把自己设为父任务".into());
    }
    let sort_order = patch.sort_order.unwrap_or(current.sort_order);
    let note_json = match patch.note_json {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
        None => current.note_json,
    };
    let note_text = match patch.note_text {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
        None => current.note_text,
    };
    let color = match patch.color {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
        None => current.color,
    };
    let emoji = match patch.emoji {
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v.trim().to_string()),
        None => current.emoji,
    };
    let completed_at = if status == "done" {
        current.completed_at.or_else(|| Some(now_iso()))
    } else {
        None
    };
    let now = now_iso();
    conn.execute(
        "UPDATE tasks SET title=?2, status=?3, due_at=?4, parent_id=?5, sort_order=?6,
         note_json=?7, note_text=?8, color=?9, completed_at=?10, updated_at=?11, emoji=?12
         WHERE id=?1",
        params![
            id,
            title,
            status,
            due_at,
            parent_id,
            sort_order,
            note_json,
            note_text,
            color,
            completed_at,
            now,
            emoji
        ],
    )
    .map_err(|e| e.to_string())?;
    // 从“完成”改回未完成：重置动量计时，保留原坐标
    if previous_status == "done" && status != "done" {
        conn.execute(
            "UPDATE chart_placements SET momentum_updated_at = ?2 WHERE task_id = ?1",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    // 完成时保留 placement：图上只是不显示（done 会被过滤），
    // 取消完成时能按原坐标重新出现
    load_tasks(&conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| "更新后未找到任务".into())
}

#[tauri::command]
fn task_complete(state: State<'_, AppState>, id: String, done: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = now_iso();
    let status = if done { "done" } else { "todo" };
    let completed = if done { Some(now.clone()) } else { None };
    conn.execute(
        "WITH RECURSIVE sub(id) AS (
            SELECT id FROM tasks WHERE id = ?1 AND deleted_at IS NULL
            UNION ALL
            SELECT t.id FROM tasks t JOIN sub s ON t.parent_id = s.id
            WHERE t.deleted_at IS NULL
         )
         UPDATE tasks SET status = ?2, completed_at = ?3, updated_at = ?4
         WHERE id IN (SELECT id FROM sub)",
        params![id, status, completed, now],
    )
    .map_err(|e| e.to_string())?;
    // 不删除 placement：取消完成时按原坐标回到图上
    if !done {
        // 完成期间不动量，恢复时从“现在”重新计时，避免一口气跳很远
        conn.execute(
            "WITH RECURSIVE sub(id) AS (
                SELECT id FROM tasks WHERE id = ?1
                UNION ALL
                SELECT t.id FROM tasks t JOIN sub s ON t.parent_id = s.id
             )
             UPDATE chart_placements SET momentum_updated_at = ?2
             WHERE task_id IN (SELECT id FROM sub)",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn task_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = now_iso();
    conn.execute(
        "WITH RECURSIVE sub(id) AS (
            SELECT id FROM tasks WHERE id = ?1
            UNION ALL
            SELECT t.id FROM tasks t JOIN sub s ON t.parent_id = s.id
         )
         UPDATE tasks SET deleted_at = ?2, updated_at = ?2
         WHERE id IN (SELECT id FROM sub) AND deleted_at IS NULL",
        params![id, now],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "WITH RECURSIVE sub(id) AS (
            SELECT id FROM tasks WHERE id = ?1
            UNION ALL
            SELECT t.id FROM tasks t JOIN sub s ON t.parent_id = s.id
         )
         DELETE FROM chart_placements WHERE task_id IN (SELECT id FROM sub)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn placement_upsert(
    state: State<'_, AppState>,
    input: PlacementInput,
) -> Result<Placement, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let task = load_tasks(&conn)?
        .into_iter()
        .find(|t| t.id == input.task_id)
        .ok_or_else(|| "任务不存在".to_string())?;

    let (board, scheduled_date) = if input.board == "week" {
        ("week".to_string(), None)
    } else {
        if !is_valid_board(&input.board) {
            return Err("非法的板".into());
        }
        let date = input
            .scheduled_date
            .clone()
            .ok_or_else(|| "日板必须有日期".to_string())?;
        let parsed = parse_date(&date).ok_or_else(|| "日期格式应为 YYYY-MM-DD".to_string())?;
        (weekday_board(parsed).to_string(), Some(date))
    };

    let existing: Option<(String, String, f64, f64)> = conn
        .query_row(
            "SELECT id, momentum_mode, vx, vy FROM chart_placements WHERE task_id = ?1",
            params![input.task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let x = clamp(input.x);
    let y = clamp(input.y);
    let now = now_iso();
    let default_v = default_momentum(&conn);

    let (id, mode, vx, vy) = if let Some((id, mode, vx, vy)) = existing {
        let mode = if mode == "auto" && task.effective_due.is_none() {
            "manual".to_string()
        } else {
            mode
        };
        let vx = if mode == "auto" {
            task.effective_due
                .as_deref()
                .map(|d| calc_auto_vx(x, d))
                .unwrap_or(vx)
        } else {
            vx
        };
        (id, mode, vx, vy)
    } else {
        let mode = if task.effective_due.is_some() {
            "auto".to_string()
        } else {
            "manual".to_string()
        };
        let vx = if mode == "auto" {
            task.effective_due
                .as_deref()
                .map(|d| calc_auto_vx(x, d))
                .unwrap_or(default_v)
        } else {
            default_v
        };
        (Uuid::new_v4().to_string(), mode, vx, 0.0)
    };

    conn.execute(
        "INSERT INTO chart_placements
         (id, task_id, board, scheduled_date, x, y, momentum_mode, vx, vy,
          momentum_updated_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?10)
         ON CONFLICT(task_id) DO UPDATE SET
           board=excluded.board, scheduled_date=excluded.scheduled_date,
           x=excluded.x, y=excluded.y, momentum_mode=excluded.momentum_mode,
           vx=excluded.vx, vy=excluded.vy,
           momentum_updated_at=excluded.momentum_updated_at,
           updated_at=excluded.updated_at",
        params![id, input.task_id, board, scheduled_date, x, y, mode, vx, vy, now],
    )
    .map_err(|e| e.to_string())?;

    load_placements(&conn)?
        .into_iter()
        .find(|p| p.task_id == input.task_id)
        .ok_or_else(|| "保存后未找到 placement".into())
}

#[tauri::command]
fn placement_remove(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM chart_placements WHERE task_id = ?1",
        params![task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn placement_set_momentum(
    state: State<'_, AppState>,
    input: MomentumInput,
) -> Result<Placement, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    if !matches!(input.mode.as_str(), "auto" | "manual") {
        return Err("非法动量模式".into());
    }
    if let Some(due) = input.due_at.as_ref() {
        let value = if due.trim().is_empty() { None } else { Some(due) };
        conn.execute(
            "UPDATE tasks SET due_at = ?2, updated_at = ?3 WHERE id = ?1",
            params![input.task_id, value, now_iso()],
        )
        .map_err(|e| e.to_string())?;
    }
    let task = load_tasks(&conn)?
        .into_iter()
        .find(|t| t.id == input.task_id)
        .ok_or_else(|| "任务不存在".to_string())?;
    let placement = load_placements(&conn)?
        .into_iter()
        .find(|p| p.task_id == input.task_id)
        .ok_or_else(|| "该任务还没有上图".to_string())?;

    let (vx, vy) = if input.mode == "auto" {
        (
            task.effective_due
                .as_deref()
                .map(|d| calc_auto_vx(placement.x, d))
                .unwrap_or(input.vx),
            input.vy,
        )
    } else {
        (input.vx, input.vy)
    };
    let now = now_iso();
    conn.execute(
        "UPDATE chart_placements
         SET momentum_mode = ?2, vx = ?3, vy = ?4, momentum_updated_at = ?5, updated_at = ?5
         WHERE task_id = ?1",
        params![input.task_id, input.mode, vx, vy, now],
    )
    .map_err(|e| e.to_string())?;
    load_placements(&conn)?
        .into_iter()
        .find(|p| p.task_id == input.task_id)
        .ok_or_else(|| "更新后未找到 placement".into())
}

#[tauri::command]
fn task_set_tags(
    state: State<'_, AppState>,
    task_id: String,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM task_tags WHERE task_id = ?1", params![task_id])
        .map_err(|e| e.to_string())?;
    for tag_id in tag_ids {
        tx.execute(
            "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
            params![task_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn task_tags(state: State<'_, AppState>) -> Result<HashMap<String, Vec<String>>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT task_id, tag_id FROM task_tags")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let (task_id, tag_id) = row.map_err(|e| e.to_string())?;
        map.entry(task_id).or_default().push(tag_id);
    }
    Ok(map)
}

#[tauri::command]
fn tag_group_save(
    state: State<'_, AppState>,
    id: Option<String>,
    name: String,
    mode: String,
    is_free: bool,
    color: Option<String>,
) -> Result<Vec<TagGroup>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    if !matches!(mode.as_str(), "single" | "multi") {
        return Err("标签组模式必须是 single 或 multi".into());
    }
    let now_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let sort_order: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tag_groups",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tag_groups (id, name, mode, is_free, color, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, mode=excluded.mode,
           is_free=excluded.is_free, color=excluded.color",
        params![now_id, name, mode, if is_free { 1 } else { 0 }, color, sort_order],
    )
    .map_err(|e| e.to_string())?;
    load_tag_groups(&conn)
}

#[tauri::command]
fn tag_group_delete(state: State<'_, AppState>, id: String) -> Result<Vec<TagGroup>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tag_groups WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    load_tag_groups(&conn)
}

#[tauri::command]
fn tag_save(
    state: State<'_, AppState>,
    id: Option<String>,
    group_id: String,
    name: String,
    color: Option<String>,
) -> Result<Vec<Tag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let sort_order: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tags WHERE group_id = ?1",
            params![group_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tags (id, group_id, name, color, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color,
           group_id=excluded.group_id",
        params![now_id, group_id, name, color, sort_order],
    )
    .map_err(|e| e.to_string())?;
    load_tags(&conn)
}

#[tauri::command]
fn tag_delete(state: State<'_, AppState>, id: String) -> Result<Vec<Tag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    load_tags(&conn)
}

#[tauri::command]
fn tags_bundle(state: State<'_, AppState>) -> Result<TagBundle, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    Ok(TagBundle {
        groups: load_tag_groups(&conn)?,
        tags: load_tags(&conn)?,
    })
}

#[tauri::command]
fn stats_week(state: State<'_, AppState>) -> Result<StatsPayload, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    refresh(&conn)?;
    let tasks = load_tasks(&conn)?;
    let (start, end) = week_bounds();
    let start_s = start.format("%Y-%m-%d").to_string();
    let end_s = end.format("%Y-%m-%d").to_string();
    let today_s = today_string();

    let completed: Vec<Task> = tasks
        .iter()
        .filter(|t| {
            t.status == "done"
                && t.completed_at
                    .as_deref()
                    .and_then(|s| s.get(0..10))
                    .and_then(parse_date)
                    .is_some_and(|d| d >= start && d <= end)
        })
        .cloned()
        .collect();
    let mut completed = completed;
    completed.sort_by(|a, b| b.completed_at.cmp(&a.completed_at));

    let mut overdue: Vec<Task> = tasks
        .iter()
        .filter(|t| {
            matches!(t.status.as_str(), "todo" | "doing")
                && t.effective_due
                    .as_deref()
                    .is_some_and(|d| d < today_s.as_str())
        })
        .cloned()
        .collect();
    overdue.sort_by(|a, b| a.effective_due.cmp(&b.effective_due));

    let due_today = tasks
        .iter()
        .filter(|t| {
            matches!(t.status.as_str(), "todo" | "doing")
                && t.effective_due.as_deref() == Some(today_s.as_str())
        })
        .count();
    let due_week = tasks
        .iter()
        .filter(|t| {
            matches!(t.status.as_str(), "todo" | "doing")
                && t.effective_due
                    .as_deref()
                    .is_some_and(|d| d >= start_s.as_str() && d <= end_s.as_str())
        })
        .count();

    Ok(StatsPayload {
        completed_count: completed.len(),
        overdue_count: overdue.len(),
        completed,
        overdue,
        due_today,
        due_week,
        week_start: start_s,
        week_end: end_s,
    })
}

#[tauri::command]
fn settings_set(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<HashMap<String, String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (owner_id, key, value) VALUES ('local', ?1, ?2)
         ON CONFLICT(owner_id, key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    load_settings(&conn)
}

#[tauri::command]
fn backup_now(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let dir = state.data_dir.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let path = dir.join(format!("data-{stamp}.db"));
    let path_s = path.to_string_lossy().to_string();
    conn.execute("VACUUM INTO ?1", params![path_s])
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn data_dir(state: State<'_, AppState>) -> String {
    state.data_dir.to_string_lossy().to_string()
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("data.db");
            let conn = init_db(&db_path)?;
            let _ = refresh(&conn);
            app.manage(AppState {
                conn: Mutex::new(conn),
                data_dir,
            });
            println!("[taskboard] SQLite ready at {}", db_path.display());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            task_create,
            task_update,
            task_complete,
            task_delete,
            placement_upsert,
            placement_remove,
            placement_set_momentum,
            task_set_tags,
            task_tags,
            tag_group_save,
            tag_group_delete,
            tag_save,
            tag_delete,
            tags_bundle,
            stats_week,
            settings_set,
            backup_now,
            data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_conn() -> (Connection, PathBuf) {
        let path = std::env::temp_dir().join(format!("taskboard-test-{}.db", Uuid::new_v4()));
        let conn = init_db(&path).expect("init db");
        (conn, path)
    }

    #[test]
    fn due_inherits_nearest_ancestor_and_own_overrides() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "root".to_string(),
            DueNode {
                parent_id: None,
                due_at: Some("2026-12-31".into()),
                title: "Root".into(),
            },
        );
        nodes.insert(
            "mid".to_string(),
            DueNode {
                parent_id: Some("root".into()),
                due_at: None,
                title: "Mid".into(),
            },
        );
        nodes.insert(
            "leaf".to_string(),
            DueNode {
                parent_id: Some("mid".into()),
                due_at: Some("2026-12-20".into()),
                title: "Leaf".into(),
            },
        );
        let mut memo = HashMap::new();
        assert_eq!(
            resolve_due("mid", &nodes, &mut memo).map(|v| v.0),
            Some("2026-12-31".into())
        );
        assert_eq!(
            resolve_due("leaf", &nodes, &mut memo).map(|v| v.0),
            Some("2026-12-20".into())
        );
        assert_eq!(resolve_due("missing", &nodes, &mut memo), None);
    }

    #[test]
    fn rollover_moves_old_day_placement_to_today() {
        let (conn, path) = temp_conn();
        let now = now_iso();
        conn.execute(
            "INSERT INTO tasks (id, owner_id, title, status, created_at, updated_at)
             VALUES ('t1', 'local', 'Task', 'todo', ?1, ?1)",
            params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chart_placements
             (id, task_id, board, scheduled_date, x, y, momentum_mode, vx, vy,
              momentum_updated_at, created_at, updated_at)
             VALUES ('p1', 't1', 'mon', '2000-01-01', 50, 50, 'manual', 0.25, 0, ?1, ?1, ?1)",
            params![now],
        )
        .unwrap();

        rollover(&conn).unwrap();
        let (date, board): (String, String) = conn
            .query_row(
                "SELECT scheduled_date, board FROM chart_placements WHERE id = 'p1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(date, today_string());
        assert_eq!(board, weekday_board(today()));

        drop(conn);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn auto_vx_targets_100_by_due_date() {
        let due = (today() + ChronoDuration::days(10))
            .format("%Y-%m-%d")
            .to_string();
        let vx = calc_auto_vx(40.0, &due);
        assert!((vx - 6.0).abs() < 0.001);
    }
}
