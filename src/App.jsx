import { useState, useEffect } from "react";

// ─── Supabase client ───────────────────────────────────────────────
const SUPABASE_URL = "https://yykfoloinyzonxszhggg.supabase.co";
const SUPABASE_KEY = "sb_publishable__MQzesNrt7w9NInOJCNbuA_iRrWm3VX";

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

function dbToTask(t) {
  return { id: t.id, title: t.title, description: t.description || "", status: t.status, priority: t.priority, assignee: t.assignee, dueDate: t.due_date || "", tags: t.tags || [], createdAt: t.created_at?.slice(0,10) || "" };
}
function dbToMember(m) {
  return { id: m.id, name: m.name, role: m.role || "", email: m.email || "", color: m.color || "#7C6FFF" };
}
// ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#FF6B6B","#4ECDC4","#FFE66D","#A29BFE","#FD79A8",
  "#55EFC4","#FDCB6E","#74B9FF","#E17055","#00CEC9"
];

const DEFAULT_MEMBERS = [];
const INITIAL_TASKS = [];

const PRIORITIES = { high: { label: "Alta", color: "#FF6B6B" }, medium: { label: "Media", color: "#FFB347" }, low: { label: "Baja", color: "#4ECDC4" } };
const COLUMNS = { todo: "Por hacer", doing: "En progreso", done: "Completado" };

function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getDueStatus(d) {
  if (!d) return "";
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + "T00:00:00");
  const diff = Math.ceil((due - today) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "";
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0A0A0F; --surface: #12121A; --surface2: #1A1A26;
    --border: rgba(255,255,255,0.07); --text: #F0EEF8; --muted: #6B6880;
    --accent: #7C6FFF; --accent2: #FF6B9D; --green: #50E3A4; --radius: 14px;
  }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
  .app { display: flex; height: 100vh; overflow: hidden; }

  .sidebar { width: 240px; min-width: 240px; background: var(--surface);
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
    padding: 24px 16px; gap: 4px; overflow-y: auto; }
  .logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px;
    color: var(--text); letter-spacing: -0.5px; padding: 8px 12px 20px;
    display: flex; align-items: center; gap: 8px; }
  .logo-dot { width: 10px; height: 10px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent2)); }
  .nav-section { font-size: 10px; font-weight: 600; letter-spacing: 1.5px;
    color: var(--muted); text-transform: uppercase; padding: 16px 12px 6px; }
  .nav-btn { display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    border-radius: 10px; border: none; background: transparent; color: var(--muted);
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
  .nav-btn:hover { background: var(--surface2); color: var(--text); }
  .nav-btn.active { background: linear-gradient(135deg, rgba(124,111,255,0.2), rgba(255,107,157,0.1));
    color: var(--text); border: 1px solid rgba(124,111,255,0.3); }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .sidebar-members { margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border); }
  .member-item { display: flex; align-items: center; gap: 10px; padding: 7px 12px;
    border-radius: 10px; cursor: pointer; transition: background 0.15s; }
  .member-item:hover { background: var(--surface2); }
  .avatar { width: 28px; height: 28px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; font-size: 10px;
    font-weight: 700; color: #0A0A0F; flex-shrink: 0; }
  .member-name { font-size: 13px; color: var(--muted); font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .member-filter-active { color: var(--accent) !important; }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { display: flex; align-items: center; gap: 16px; padding: 20px 28px;
    border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .page-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px;
    letter-spacing: -0.5px; flex: 1; }
  .search-box { display: flex; align-items: center; gap: 8px; background: var(--bg);
    border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; width: 220px; }
  .search-box input { background: none; border: none; outline: none; color: var(--text);
    font-size: 13px; font-family: 'DM Sans', sans-serif; width: 100%; }
  .search-box input::placeholder { color: var(--muted); }
  .btn-add { display: flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border: none; border-radius: 10px; padding: 9px 16px; color: white;
    font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px;
    cursor: pointer; transition: opacity 0.15s; white-space: nowrap; }
  .btn-add:hover { opacity: 0.88; }
  .view-toggle { display: flex; background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; }
  .view-btn { padding: 8px 12px; border: none; background: transparent;
    color: var(--muted); cursor: pointer; font-size: 14px; transition: all 0.15s; }
  .view-btn.active { background: var(--surface2); color: var(--text); }

  .filters { display: flex; align-items: center; gap: 10px; padding: 14px 28px;
    border-bottom: 1px solid var(--border); flex-shrink: 0; overflow-x: auto; }
  .filter-label { font-size: 12px; color: var(--muted); font-weight: 500; white-space: nowrap; }
  .filter-btn { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: all 0.15s; white-space: nowrap; }
  .filter-btn.active { background: rgba(124,111,255,0.15); border-color: var(--accent); color: var(--accent); }
  .filter-btn:hover:not(.active) { border-color: rgba(255,255,255,0.2); color: var(--text); }

  .stats-bar { display: flex; gap: 16px; padding: 16px 28px;
    border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .stat-card { background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 12px 18px; flex: 1; display: flex; align-items: center; gap: 12px; }
  .stat-icon { font-size: 20px; }
  .stat-num { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; line-height: 1; }
  .stat-label { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .kanban { display: flex; gap: 20px; padding: 24px 28px;
    overflow-x: auto; flex: 1; align-items: flex-start; }
  .column { min-width: 300px; max-width: 320px; flex-shrink: 0; }
  .col-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .col-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; }
  .col-count { background: var(--surface2); color: var(--muted); border-radius: 6px;
    padding: 2px 8px; font-size: 11px; font-weight: 600; }
  .col-dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-todo { background: var(--muted); }
  .dot-doing { background: var(--accent); }
  .dot-done { background: var(--green); }
  .col-body { display: flex; flex-direction: column; gap: 10px; }

  .task-card { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; cursor: pointer; transition: all 0.2s;
    position: relative; overflow: hidden; }
  .task-card:hover { border-color: rgba(124,111,255,0.4); transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .task-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 2px; opacity: 0; transition: opacity 0.2s;
    background: linear-gradient(90deg, var(--accent), var(--accent2)); }
  .task-card:hover::before { opacity: 1; }
  .task-priority { display: inline-flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
  .priority-dot { width: 6px; height: 6px; border-radius: 50%; }
  .task-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 14px;
    line-height: 1.4; margin-bottom: 6px; }
  .task-desc { font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 12px; }
  .task-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
  .tag { padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: 600;
    background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
  .task-footer { display: flex; align-items: center; justify-content: space-between; }
  .task-due { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px; }
  .task-due.overdue { color: #FF6B6B; }
  .task-due.soon { color: #FFB347; }

  .list-view { flex: 1; overflow-y: auto; padding: 24px 28px; }
  .list-header { display: grid; grid-template-columns: 1fr 120px 100px 100px 80px;
    gap: 16px; padding: 8px 16px; margin-bottom: 8px;
    font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: 0.8px; text-transform: uppercase; }
  .list-row { display: grid; grid-template-columns: 1fr 120px 100px 100px 80px;
    gap: 16px; align-items: center; padding: 12px 16px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; margin-bottom: 6px; cursor: pointer; transition: all 0.15s; }
  .list-row:hover { border-color: rgba(124,111,255,0.4); background: var(--surface2); }
  .list-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; }
  .status-badge { display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .badge-todo { background: rgba(107,104,128,0.2); color: var(--muted); }
  .badge-doing { background: rgba(124,111,255,0.2); color: var(--accent); }
  .badge-done { background: rgba(80,227,164,0.2); color: var(--green); }

  /* TEAM PAGE */
  .team-page { flex: 1; overflow-y: auto; padding: 28px; }
  .team-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .team-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; }
  .team-count { font-size: 13px; color: var(--muted); }
  .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .team-card { background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 24px; display: flex; flex-direction: column;
    align-items: center; gap: 12px; position: relative; transition: all 0.2s; }
  .team-card:hover { border-color: rgba(124,111,255,0.4); transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.4); }
  .team-avatar { width: 64px; height: 64px; border-radius: 18px; display: flex;
    align-items: center; justify-content: center; font-size: 22px; font-weight: 800;
    color: #0A0A0F; }
  .team-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; text-align: center; }
  .team-role { font-size: 12px; color: var(--muted); text-align: center; }
  .team-email { font-size: 11px; color: var(--muted); opacity: 0.7; }
  .team-task-count { font-size: 12px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 6px; padding: 3px 10px; color: var(--muted); }
  .team-card-actions { display: flex; gap: 8px; margin-top: 4px; }
  .btn-edit-member { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .btn-edit-member:hover { border-color: var(--accent); color: var(--accent); }
  .btn-del-member { padding: 6px 14px; border-radius: 8px;
    border: 1px solid rgba(255,107,107,0.3); background: rgba(255,107,107,0.1);
    color: #FF6B6B; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .btn-del-member:hover { background: rgba(255,107,107,0.2); }
  .add-member-card { background: var(--surface); border: 2px dashed var(--border);
    border-radius: 16px; padding: 24px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px; cursor: pointer;
    transition: all 0.2s; min-height: 200px; }
  .add-member-card:hover { border-color: var(--accent); }
  .add-member-icon { width: 52px; height: 52px; border-radius: 16px;
    background: rgba(124,111,255,0.15); display: flex; align-items: center;
    justify-content: center; font-size: 24px; }
  .add-member-label { font-size: 14px; color: var(--muted); font-weight: 500; }
  .add-member-sub { font-size: 11px; color: var(--muted); opacity: 0.6; }

  /* COLOR PICKER */
  .color-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .color-swatch { width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
    border: 2px solid transparent; transition: all 0.15s; }
  .color-swatch.selected { border-color: white; transform: scale(1.1); }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
    z-index: 100; padding: 20px; }
  .modal { background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; width: 100%; max-width: 520px; padding: 28px;
    max-height: 90vh; overflow-y: auto; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .modal-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; }
  .modal-close { background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; width: 32px; height: 32px; display: flex;
    align-items: center; justify-content: center; cursor: pointer; color: var(--muted);
    font-size: 18px; transition: all 0.15s; }
  .modal-close:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
  .form-group { margin-bottom: 18px; }
  .form-label { display: block; font-size: 12px; font-weight: 600;
    color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 7px; }
  .form-input { width: 100%; background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px; color: var(--text);
    font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s; }
  .form-input:focus { border-color: var(--accent); }
  .form-select { appearance: none; cursor: pointer; }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .member-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .member-option { display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 8px; border-radius: 10px; border: 1px solid var(--border);
    cursor: pointer; transition: all 0.15s; background: var(--bg); }
  .member-option:hover { border-color: rgba(124,111,255,0.4); }
  .member-option.selected { border-color: var(--accent); background: rgba(124,111,255,0.1); }
  .member-option .avatar { width: 36px; height: 36px; border-radius: 10px; font-size: 11px; }
  .member-option-name { font-size: 11px; color: var(--muted); text-align: center; line-height: 1.2; }
  .btn-row { display: flex; gap: 10px; margin-top: 24px; }
  .btn-cancel { flex: 1; padding: 11px; border: 1px solid var(--border);
    border-radius: 10px; background: transparent; color: var(--muted);
    font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.15s; }
  .btn-cancel:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
  .btn-submit { flex: 2; padding: 11px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border: none; border-radius: 10px; color: white;
    font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.15s; }
  .btn-submit:hover { opacity: 0.88; }
  .detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .status-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg); color: var(--muted); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .status-btn.active-todo { border-color: var(--muted); color: var(--muted); background: rgba(107,104,128,0.15); }
  .status-btn.active-doing { border-color: var(--accent); color: var(--accent); background: rgba(124,111,255,0.15); }
  .status-btn.active-done { border-color: var(--green); color: var(--green); background: rgba(80,227,164,0.15); }
  .status-btn:hover:not(.active-todo):not(.active-doing):not(.active-done) { border-color: rgba(255,255,255,0.2); color: var(--text); }
  .btn-delete { margin-left: auto; padding: 7px 14px; border-radius: 8px;
    border: 1px solid rgba(255,107,107,0.3); background: rgba(255,107,107,0.1);
    color: #FF6B6B; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .btn-delete:hover { background: rgba(255,107,107,0.2); }
  .detail-field { margin-bottom: 16px; }
  .detail-field-label { font-size: 11px; color: var(--muted); font-weight: 600;
    letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 6px; }
  .detail-field-value { font-size: 14px; color: var(--text); }

  .empty-state { display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 20px; color: var(--muted); gap: 10px; }
  .empty-icon { font-size: 40px; opacity: 0.5; }
  .empty-text { font-size: 14px; }

  /* MEMBER FILTER ROW */
  .member-filter-row { display: flex; align-items: center; gap: 10px; padding: 12px 28px;
    border-bottom: 1px solid var(--border); flex-shrink: 0; overflow-x: auto; flex-wrap: wrap; }
  .mf-label { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: 0.8px;
    text-transform: uppercase; white-space: nowrap; }
  .mf-avatar-btn { position: relative; cursor: pointer; border: none; background: none;
    padding: 0; transition: transform 0.15s; flex-shrink: 0; }
  .mf-avatar-btn:hover { transform: scale(1.08); }
  .mf-avatar-btn .mf-av { width: 36px; height: 36px; border-radius: 10px; display: flex;
    align-items: center; justify-content: center; font-size: 12px; font-weight: 800;
    color: #0A0A0F; transition: all 0.15s; }
  .mf-avatar-btn.active-member .mf-av { outline: 2.5px solid white; outline-offset: 2px; }
  .mf-avatar-btn:not(.active-member) .mf-av { opacity: 0.45; filter: grayscale(0.3); }
  .mf-avatar-btn .mf-badge { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px;
    border-radius: 9px; background: var(--accent); color: white; font-size: 9px;
    font-weight: 800; display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--bg); padding: 0 3px; }
  .mf-sep { width: 1px; height: 28px; background: var(--border); flex-shrink: 0; margin: 0 4px; }
  .mf-clear { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 11px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: all 0.15s; white-space: nowrap; }
  .mf-clear:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
  .mf-summary { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; }
  .mf-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
    border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .mf-pill-todo { background: rgba(107,104,128,0.2); color: var(--muted); }
  .mf-pill-doing { background: rgba(124,111,255,0.2); color: var(--accent); }
  .mf-pill-done { background: rgba(80,227,164,0.2); color: var(--green); }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .topbar { padding: 14px 16px; }
    .stats-bar { padding: 12px 16px; gap: 10px; }
    .kanban { padding: 16px; }
    .team-page { padding: 16px; }
  }
`;

const EMPTY_MEMBER_FORM = { name: "", role: "", email: "", color: AVATAR_COLORS[0] };
const EMPTY_TASK_FORM = { title: "", description: "", priority: "medium", assignee: null, status: "todo", dueDate: "", tags: "" };

export default function App() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("tasks");

  // ── Load data from Supabase on mount ──
  useEffect(() => {
    async function loadData() {
      try {
        const [rawMembers, rawTasks] = await Promise.all([
          sb("members?select=*&order=id"),
          sb("tasks?select=*&order=id"),
        ]);
        setMembers(rawMembers.map(dbToMember));
        setTasks(rawTasks.map(dbToTask));
      } catch(e) { console.error("Error cargando datos:", e); }
      finally { setLoading(false); }
    }
    loadData();
  }, []);
  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMembers, setFilterMembers] = useState([]); // array of ids, empty = all
  const [filterPriority, setFilterPriority] = useState("all");

  // Modals
  const [taskModal, setTaskModal] = useState(null); // null | "add" | task object
  const [memberModal, setMemberModal] = useState(null); // null | "add" | member object
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);

  useEffect(() => {
    if (taskModal && typeof taskModal === "object") {
      setTaskForm({ ...taskModal, tags: taskModal.tags.join(", ") });
    } else if (taskModal === "add") {
      setTaskForm({ ...EMPTY_TASK_FORM, assignee: members[0]?.id || null });
    }
  }, [taskModal]);

  useEffect(() => {
    if (memberModal && typeof memberModal === "object") {
      setMemberForm({ name: memberModal.name, role: memberModal.role, email: memberModal.email, color: memberModal.color });
    } else if (memberModal === "add") {
      const usedColors = members.map(m => m.color);
      const nextColor = AVATAR_COLORS.find(c => !usedColors.includes(c)) || AVATAR_COLORS[members.length % AVATAR_COLORS.length];
      setMemberForm({ ...EMPTY_MEMBER_FORM, color: nextColor });
    }
  }, [memberModal]);

  const getMember = (id) => members.find(m => m.id === id) || members[0];

  function toggleMemberFilter(id) {
    setFilterMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterMembers.length > 0 && !filterMembers.includes(t.assignee)) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const byStatus = (s) => filtered.filter(t => t.status === s);
  const stats = { total: tasks.length, todo: tasks.filter(t=>t.status==="todo").length, doing: tasks.filter(t=>t.status==="doing").length, done: tasks.filter(t=>t.status==="done").length };

  // --- TASK CRUD ---
  async function saveTask() {
    if (!taskForm.title.trim()) return;
    const tags = taskForm.tags.split(",").map(s => s.trim()).filter(Boolean);
    const assignee = taskForm.assignee || members[0]?.id;
    const payload = { title: taskForm.title, description: taskForm.description, status: taskForm.status, priority: taskForm.priority, assignee, due_date: taskForm.dueDate || null, tags };
    try {
      if (typeof taskModal === "object") {
        const [updated] = await sb(`tasks?id=eq.${taskModal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setTasks(ts => ts.map(t => t.id === taskModal.id ? dbToTask(updated) : t));
      } else {
        const [created] = await sb("tasks", { method: "POST", body: JSON.stringify(payload) });
        setTasks(ts => [...ts, dbToTask(created)]);
      }
    } catch(e) { console.error("Error guardando tarea:", e); }
    setTaskModal(null);
  }

  async function deleteTask(id) {
    try { await sb(`tasks?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }); }
    catch(e) { console.error("Error eliminando tarea:", e); }
    setTasks(ts => ts.filter(t => t.id !== id));
    setTaskModal(null);
  }

  async function changeStatus(id, status) {
    try { await sb(`tasks?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
    catch(e) { console.error("Error cambiando estado:", e); }
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
    if (typeof taskModal === "object") setTaskModal(m => ({ ...m, status }));
  }

  // --- MEMBER CRUD ---
  async function saveMember() {
    if (!memberForm.name.trim()) return;
    const payload = { name: memberForm.name, role: memberForm.role, email: memberForm.email, color: memberForm.color };
    try {
      if (typeof memberModal === "object") {
        const [updated] = await sb(`members?id=eq.${memberModal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMembers(ms => ms.map(m => m.id === memberModal.id ? dbToMember(updated) : m));
      } else {
        if (members.length >= 10) return;
        const [created] = await sb("members", { method: "POST", body: JSON.stringify(payload) });
        const newMember = dbToMember(created);
        setMembers(ms => [...ms, newMember]);
        if (!taskForm.assignee) setTaskForm(f => ({ ...f, assignee: newMember.id }));
      }
    } catch(e) { console.error("Error guardando miembro:", e); }
    setMemberModal(null);
  }

  async function deleteMember(id) {
    try { await sb(`members?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }); }
    catch(e) { console.error("Error eliminando miembro:", e); }
    setMembers(ms => ms.filter(m => m.id !== id));
    setTasks(ts => ts.map(t => t.assignee === id ? { ...t, assignee: null } : t));
    setMemberModal(null);
  }

  const canAddMember = members.length < 10;

  // ---- RENDER ----
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0A0A0F",flexDirection:"column",gap:16}}>
      <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#7C6FFF,#FF6B9D)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#0A0A0F",fontFamily:"Syne,sans-serif"}}>T</div>
      <div style={{color:"#6B6880",fontSize:14,fontFamily:"DM Sans,sans-serif"}}>Cargando Taskly...</div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo"><div className="logo-dot"/><span>Taskly</span></div>
          <div className="nav-section">Menú</div>
          {[["tasks","📋","Tareas"],["team","👥","Equipo"]].map(([id, icon, label]) => (
            <button key={id} className={`nav-btn ${activeNav===id?"active":""}`} onClick={()=>setActiveNav(id)}>
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
          <div className="nav-section">Miembros</div>
          <div className="sidebar-members">
            {members.map(m => (
              <div key={m.id} className="member-item" onClick={()=>toggleMemberFilter(m.id)}>
                <div className="avatar" style={{background:m.color,outline:filterMembers.includes(m.id)?"2px solid var(--accent)":"none",outlineOffset:"2px"}}>{getInitials(m.name)}</div>
                <span className={`member-name ${filterMembers.includes(m.id)?"member-filter-active":""}`}>{m.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          {/* TOPBAR */}
          <div className="topbar">
            <span className="page-title">{activeNav==="tasks"?"Gestión de Tareas":"Equipo"}</span>
            {activeNav==="tasks" && <>
              <div className="search-box">
                <span style={{color:"var(--muted)",fontSize:13}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tareas..."/>
              </div>
              <div className="view-toggle">
                <button className={`view-btn ${view==="kanban"?"active":""}`} onClick={()=>setView("kanban")}>⬛ Kanban</button>
                <button className={`view-btn ${view==="list"?"active":""}`} onClick={()=>setView("list")}>≡ Lista</button>
              </div>
              <button className="btn-add" onClick={()=>setTaskModal("add")}>+ Nueva tarea</button>
            </>}
            {activeNav==="team" && (
              <button className="btn-add" onClick={()=>canAddMember&&setMemberModal("add")}
                style={{opacity:canAddMember?1:0.4,cursor:canAddMember?"pointer":"not-allowed"}}>
                + Agregar miembro
              </button>
            )}
          </div>

          {/* ===== TASKS VIEW ===== */}
          {activeNav==="tasks" && <>
            <div className="stats-bar">
              {[["📋",stats.total,"Total"],["⬜",stats.todo,"Por hacer"],["🔵",stats.doing,"En progreso"],["✅",stats.done,"Completadas"]].map(([icon,num,label])=>(
                <div key={label} className="stat-card">
                  <span className="stat-icon">{icon}</span>
                  <div><div className="stat-num">{num}</div><div className="stat-label">{label}</div></div>
                </div>
              ))}
            </div>
            {/* MEMBER FILTER ROW */}
            <div className="member-filter-row">
              <span className="mf-label">Personas:</span>
              {members.map(m => {
                const isActive = filterMembers.includes(m.id);
                const mTasks = tasks.filter(t => t.assignee === m.id);
                return (
                  <button key={m.id} className={`mf-avatar-btn ${isActive || filterMembers.length===0?"active-member":""}`}
                    title={m.name} onClick={()=>toggleMemberFilter(m.id)}>
                    <div className="mf-av" style={{background:m.color}}>{getInitials(m.name)}</div>
                    {isActive && <div className="mf-badge">{mTasks.length}</div>}
                  </button>
                );
              })}
              {filterMembers.length > 0 && <>
                <div className="mf-sep"/>
                <button className="mf-clear" onClick={()=>setFilterMembers([])}>Ver todos ✕</button>
                <div className="mf-summary">
                  {[["todo","mf-pill-todo","⬜"],["doing","mf-pill-doing","🔵"],["done","mf-pill-done","✅"]].map(([s,cls,icon])=>{
                    const count = filtered.filter(t=>t.status===s).length;
                    return count > 0 ? <span key={s} className={`mf-pill ${cls}`}>{icon} {count}</span> : null;
                  })}
                </div>
              </>}
            </div>
            <div className="filters">
              <span className="filter-label">Estado:</span>
              {[["all","Todos"],["todo","Por hacer"],["doing","En progreso"],["done","Completado"]].map(([v,l])=>(
                <button key={v} className={`filter-btn ${filterStatus===v?"active":""}`} onClick={()=>setFilterStatus(v)}>{l}</button>
              ))}
              <span className="filter-label" style={{marginLeft:8}}>Prioridad:</span>
              {[["all","Todas"],["high","Alta"],["medium","Media"],["low","Baja"]].map(([v,l])=>(
                <button key={v} className={`filter-btn ${filterPriority===v?"active":""}`} onClick={()=>setFilterPriority(v)}>{l}</button>
              ))}
            </div>

            {/* KANBAN */}
            {view==="kanban" && (
              <div className="kanban">
                {Object.entries(COLUMNS).map(([status, label]) => (
                  <div key={status} className="column">
                    <div className="col-header">
                      <div className={`col-dot dot-${status}`}/>
                      <span className="col-title">{label}</span>
                      <span className="col-count">{byStatus(status).length}</span>
                    </div>
                    <div className="col-body">
                      {byStatus(status).map(task => {
                        const m = getMember(task.assignee);
                        const due = getDueStatus(task.dueDate);
                        return (
                          <div key={task.id} className="task-card" onClick={()=>setTaskModal(task)}>
                            <div className="task-priority" style={{color:PRIORITIES[task.priority].color}}>
                              <div className="priority-dot" style={{background:PRIORITIES[task.priority].color}}/>
                              {PRIORITIES[task.priority].label}
                            </div>
                            <div className="task-title">{task.title}</div>
                            <div className="task-desc">{task.description}</div>
                            {task.tags.length>0 && <div className="task-tags">{task.tags.map(tag=><span key={tag} className="tag">{tag}</span>)}</div>}
                            <div className="task-footer">
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                {m && <div className="avatar" style={{background:m.color,width:24,height:24,borderRadius:6,fontSize:9}}>{getInitials(m.name)}</div>}
                                <span style={{fontSize:11,color:"var(--muted)"}}>{m?.name.split(" ")[0]||"—"}</span>
                              </div>
                              {task.dueDate && <div className={`task-due ${due}`}>{due==="overdue"?"⚠":"📅"} {formatDate(task.dueDate)}</div>}
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={()=>{setTaskModal("add");setTaskForm(f=>({...f,status,assignee:members[0]?.id||null}))}}
                        style={{width:"100%",padding:"10px",border:"1px dashed var(--border)",borderRadius:"var(--radius)",background:"transparent",color:"var(--muted)",cursor:"pointer",fontSize:13,fontFamily:"DM Sans, sans-serif",transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.target.style.borderColor="rgba(124,111,255,0.4)";e.target.style.color="var(--accent)"}}
                        onMouseLeave={e=>{e.target.style.borderColor="var(--border)";e.target.style.color="var(--muted)"}}>
                        + Agregar tarea
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LIST */}
            {view==="list" && (
              <div className="list-view">
                <div className="list-header"><span>Tarea</span><span>Asignado</span><span>Estado</span><span>Prioridad</span><span>Vence</span></div>
                {filtered.map(task => {
                  const m = getMember(task.assignee);
                  const due = getDueStatus(task.dueDate);
                  return (
                    <div key={task.id} className="list-row" onClick={()=>setTaskModal(task)}>
                      <div>
                        <div className="list-title">{task.title}</div>
                        {task.tags.length>0 && <div className="task-tags" style={{marginTop:4}}>{task.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        {m && <div className="avatar" style={{background:m.color,width:26,height:26,borderRadius:7,fontSize:9}}>{getInitials(m.name)}</div>}
                        <span style={{fontSize:12,color:"var(--muted)"}}>{m?.name.split(" ")[0]||"—"}</span>
                      </div>
                      <div><span className={`status-badge badge-${task.status}`}>{COLUMNS[task.status]}</span></div>
                      <div style={{color:PRIORITIES[task.priority].color,fontSize:12,fontWeight:600}}>{PRIORITIES[task.priority].label}</div>
                      <div className={`task-due ${due}`} style={{fontSize:12}}>{formatDate(task.dueDate)}</div>
                    </div>
                  );
                })}
                {filtered.length===0 && <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-text">No se encontraron tareas.</div></div>}
              </div>
            )}
          </>}

          {/* ===== TEAM VIEW ===== */}
          {activeNav==="team" && (
            <div className="team-page">
              <div className="team-header">
                <div>
                  <div className="team-title">Miembros del equipo</div>
                  <div className="team-count">{members.length} de 10 miembros</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{background:"var(--surface2)",borderRadius:6,height:6,marginBottom:28,overflow:"hidden"}}>
                <div style={{width:`${(members.length/10)*100}%`,height:"100%",background:"linear-gradient(90deg, var(--accent), var(--accent2))",borderRadius:6,transition:"width 0.4s"}}/>
              </div>

              <div className="team-grid">
                {members.map(m => {
                  const memberTasks = tasks.filter(t=>t.assignee===m.id);
                  const doneTasks = memberTasks.filter(t=>t.status==="done").length;
                  return (
                    <div key={m.id} className="team-card">
                      <div className="team-avatar" style={{background:m.color}}>{getInitials(m.name)}</div>
                      <div className="team-name">{m.name}</div>
                      {m.role && <div className="team-role">{m.role}</div>}
                      {m.email && <div className="team-email">{m.email}</div>}
                      <div className="team-task-count">
                        {memberTasks.length} tarea{memberTasks.length!==1?"s":""} · {doneTasks} completada{doneTasks!==1?"s":""}
                      </div>
                      <div className="team-card-actions">
                        <button className="btn-edit-member" onClick={()=>setMemberModal(m)}>✏️ Editar</button>
                        <button className="btn-del-member" onClick={()=>deleteMember(m.id)}>🗑</button>
                      </div>
                    </div>
                  );
                })}
                {canAddMember && (
                  <div className="add-member-card" onClick={()=>setMemberModal("add")}>
                    <div className="add-member-icon">+</div>
                    <div className="add-member-label">Agregar miembro</div>
                    <div className="add-member-sub">{10-members.length} lugar{10-members.length!==1?"es":""} disponible{10-members.length!==1?"s":""}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===== TASK MODAL ===== */}
      {taskModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setTaskModal(null)}>
          <div className="modal">
            {/* ADD / EDIT form */}
            {(taskModal==="add" || (typeof taskModal==="object" && taskModal._editing)) && (
              <>
                <div className="modal-header">
                  <div className="modal-title">{taskModal==="add"?"Nueva Tarea":"Editar Tarea"}</div>
                  <div className="modal-close" onClick={()=>setTaskModal(null)}>✕</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Título *</label>
                  <input className="form-input" placeholder="Describe la tarea..." value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-input form-textarea" placeholder="Más detalles..." value={taskForm.description} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))}/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input form-select" value={taskForm.status} onChange={e=>setTaskForm(f=>({...f,status:e.target.value}))}>
                      {Object.entries(COLUMNS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prioridad</label>
                    <select className="form-input form-select" value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}>
                      {Object.entries(PRIORITIES).map(([v,p])=><option key={v} value={v}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha límite</label>
                  <input type="date" className="form-input" value={taskForm.dueDate} onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Etiquetas (separadas por coma)</label>
                  <input className="form-input" placeholder="diseño, backend, ux..." value={taskForm.tags} onChange={e=>setTaskForm(f=>({...f,tags:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Asignar a</label>
                  {members.length===0
                    ? <div style={{color:"var(--muted)",fontSize:13}}>No hay miembros. Crea uno primero en "Equipo".</div>
                    : <div className="member-grid">
                        {members.map(m=>(
                          <div key={m.id} className={`member-option ${taskForm.assignee===m.id?"selected":""}`} onClick={()=>setTaskForm(f=>({...f,assignee:m.id}))}>
                            <div className="avatar" style={{background:m.color,width:36,height:36,borderRadius:10,fontSize:11}}>{getInitials(m.name)}</div>
                            <span className="member-option-name">{m.name.split(" ")[0]}</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
                <div className="btn-row">
                  <button className="btn-cancel" onClick={()=>setTaskModal(null)}>Cancelar</button>
                  <button className="btn-submit" onClick={saveTask}>{taskModal==="add"?"Crear Tarea":"Guardar Cambios"}</button>
                </div>
              </>
            )}

            {/* TASK DETAIL */}
            {typeof taskModal==="object" && !taskModal._editing && (
              <>
                <div className="modal-header">
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="priority-dot" style={{width:10,height:10,borderRadius:"50%",background:PRIORITIES[taskModal.priority].color,flexShrink:0}}/>
                    <div className="modal-title" style={{fontSize:17}}>{taskModal.title}</div>
                  </div>
                  <div className="modal-close" onClick={()=>setTaskModal(null)}>✕</div>
                </div>
                <div className="detail-actions">
                  {Object.entries(COLUMNS).map(([s,l])=>(
                    <button key={s} className={`status-btn ${taskModal.status===s?`active-${s}`:""}`} onClick={()=>changeStatus(taskModal.id,s)}>{l}</button>
                  ))}
                  <button className="btn-delete" onClick={()=>deleteTask(taskModal.id)}>🗑 Eliminar</button>
                </div>
                {taskModal.description && (
                  <div className="detail-field">
                    <div className="detail-field-label">Descripción</div>
                    <div className="detail-field-value" style={{color:"var(--muted)",lineHeight:1.6}}>{taskModal.description}</div>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                  <div className="detail-field">
                    <div className="detail-field-label">Asignado a</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                      {getMember(taskModal.assignee) && <>
                        <div className="avatar" style={{background:getMember(taskModal.assignee).color,width:32,height:32,borderRadius:9,fontSize:11}}>{getInitials(getMember(taskModal.assignee).name)}</div>
                        <span style={{fontSize:14}}>{getMember(taskModal.assignee).name}</span>
                      </>}
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Fecha límite</div>
                    <div className={`detail-field-value ${getDueStatus(taskModal.dueDate)}`} style={{marginTop:6}}>
                      {formatDate(taskModal.dueDate)}
                      {getDueStatus(taskModal.dueDate)==="overdue"&&<span style={{fontSize:11,marginLeft:6}}>· Vencida</span>}
                      {getDueStatus(taskModal.dueDate)==="soon"&&<span style={{fontSize:11,marginLeft:6,color:"#FFB347"}}>· Pronto</span>}
                    </div>
                  </div>
                </div>
                {taskModal.tags.length>0 && (
                  <div className="detail-field">
                    <div className="detail-field-label">Etiquetas</div>
                    <div className="task-tags" style={{marginTop:6}}>{taskModal.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>
                  </div>
                )}
                <div className="btn-row">
                  <button className="btn-cancel" onClick={()=>setTaskModal(null)}>Cerrar</button>
                  <button className="btn-submit" onClick={()=>setTaskModal({...taskModal,_editing:true})}>✏️ Editar tarea</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== MEMBER MODAL ===== */}
      {memberModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMemberModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{memberModal==="add"?"Nuevo Miembro":"Editar Miembro"}</div>
              <div className="modal-close" onClick={()=>setMemberModal(null)}>✕</div>
            </div>

            {/* Preview avatar */}
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,padding:16,background:"var(--bg)",borderRadius:12,border:"1px solid var(--border)"}}>
              <div style={{width:56,height:56,borderRadius:16,background:memberForm.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#0A0A0F",flexShrink:0}}>
                {memberForm.name ? getInitials(memberForm.name) : "?"}
              </div>
              <div>
                <div style={{fontFamily:"Syne, sans-serif",fontWeight:700,fontSize:16}}>{memberForm.name||"Nombre del miembro"}</div>
                <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{memberForm.role||"Rol"}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input className="form-input" placeholder="Ej: Juan Pérez" value={memberForm.name} onChange={e=>setMemberForm(f=>({...f,name:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Rol / Cargo</label>
              <input className="form-input" placeholder="Ej: Desarrollador Frontend" value={memberForm.role} onChange={e=>setMemberForm(f=>({...f,role:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input className="form-input" type="email" placeholder="juan@empresa.com" value={memberForm.email} onChange={e=>setMemberForm(f=>({...f,email:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Color de avatar</label>
              <div className="color-grid">
                {AVATAR_COLORS.map(c=>(
                  <div key={c} className={`color-swatch ${memberForm.color===c?"selected":""}`}
                    style={{background:c}} onClick={()=>setMemberForm(f=>({...f,color:c}))}/>
                ))}
              </div>
            </div>

            <div className="btn-row">
              {typeof memberModal==="object" && (
                <button className="btn-cancel" style={{flex:"none",padding:"11px 16px",borderColor:"rgba(255,107,107,0.3)",color:"#FF6B6B"}}
                  onClick={()=>deleteMember(memberModal.id)}>🗑 Eliminar</button>
              )}
              <button className="btn-cancel" onClick={()=>setMemberModal(null)}>Cancelar</button>
              <button className="btn-submit" onClick={saveMember}>{memberModal==="add"?"Agregar Miembro":"Guardar Cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
