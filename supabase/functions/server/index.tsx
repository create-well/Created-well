import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
const SYNC_KEYS = [
  "cr8w_tasks",
  "cr8w_stations",
  "cr8w_forum",
  "cr8w_messages",
  "cr8w_braindumps",
  "cr8w_announcements",
  "cr8w_forum_replies",
  "cr8w_workshops",
  "cr8w_workshop_programs",
  "cr8w_workshop_resources",
  "cr8w_coflow_dates",
  "cr8w_coflow_checkins",
  "cr8w_well_notes",
  "cr8w_calendar_events",
] as const;

function parseList(raw: any): any[] {
  if (!raw) return [];
  try {
    return typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function getList(key: string): Promise<any[]> {
  try {
    const raw = await kv.get(key);
    return parseList(raw);
  } catch (e) {
    console.log(`Error reading ${key}:`, e);
    return [];
  }
}
async function setList(key: string, list: any[]): Promise<void> {
  await kv.set(key, JSON.stringify(list));
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/health", (c) => c.json({ status: "ok" }));

// ── Sync — single query for all keys to avoid timeout on cold starts ─────
app.get("/make-server-8dcd9693/sync", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("kv_store_8dcd9693")
      .select("key, value")
      .in("key", SYNC_KEYS as unknown as string[]);

    if (error) {
      console.log("Sync DB error:", error);
      return c.json({ error: `Sync DB query failed: ${error.message}` }, 500);
    }

    // Build a lookup map from the single query result
    const map: Record<string, any[]> = {};
    for (const row of data || []) {
      map[row.key] = parseList(row.value);
    }

    return c.json({
      tasks: map["cr8w_tasks"] || [],
      stations: map["cr8w_stations"] || [],
      forum: map["cr8w_forum"] || [],
      messages: map["cr8w_messages"] || [],
      braindumps: map["cr8w_braindumps"] || [],
      announcements: map["cr8w_announcements"] || [],
      forumReplies: map["cr8w_forum_replies"] || [],
      workshops: map["cr8w_workshops"] || [],
      workshopPrograms: map["cr8w_workshop_programs"] || [],
      workshopResources: map["cr8w_workshop_resources"] || [],
      coflowDates: map["cr8w_coflow_dates"] || [],
      coflowCheckins: map["cr8w_coflow_checkins"] || [],
      wellNotes: map["cr8w_well_notes"] || [],
      calendarEvents: map["cr8w_calendar_events"] || [],
    });
  } catch (e) {
    console.log("Sync error:", e);
    return c.json({ error: `Sync failed: ${e}` }, 500);
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/tasks", async (c) => {
  return c.json(await getList("cr8w_tasks"));
});

app.post("/make-server-8dcd9693/tasks", async (c) => {
  try {
    const body = await c.req.json();
    const tasks = await getList("cr8w_tasks");
    const newTask = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    tasks.push(newTask);
    await setList("cr8w_tasks", tasks);
    return c.json(newTask, 201);
  } catch (e) {
    console.log("Create task error:", e);
    return c.json({ error: `Failed to create task: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/tasks/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const tasks = await getList("cr8w_tasks");
    const idx = tasks.findIndex(t => String(t.id) === String(id));
    if (idx === -1) return c.json({ error: "Task not found" }, 404);
    tasks[idx] = { ...tasks[idx], ...body, id: tasks[idx].id };
    await setList("cr8w_tasks", tasks);
    return c.json(tasks[idx]);
  } catch (e) {
    console.log("Update task error:", e);
    return c.json({ error: `Failed to update task: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/tasks/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const tasks = await getList("cr8w_tasks");
    await setList("cr8w_tasks", tasks.filter(t => String(t.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete task error:", e);
    return c.json({ error: `Failed to delete task: ${e}` }, 500);
  }
});

// ── Stations ──────────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/stations", async (c) => {
  return c.json(await getList("cr8w_stations"));
});

app.post("/make-server-8dcd9693/stations", async (c) => {
  try {
    const body = await c.req.json();
    const stations = await getList("cr8w_stations");
    const newStation = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    stations.push(newStation);
    await setList("cr8w_stations", stations);
    return c.json(newStation, 201);
  } catch (e) {
    console.log("Create station error:", e);
    return c.json({ error: `Failed to create station: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/stations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const stations = await getList("cr8w_stations");
    const idx = stations.findIndex(s => String(s.id) === String(id));
    if (idx === -1) return c.json({ error: "Station not found" }, 404);
    stations[idx] = { ...stations[idx], ...body, id: stations[idx].id };
    await setList("cr8w_stations", stations);
    return c.json(stations[idx]);
  } catch (e) {
    console.log("Update station error:", e);
    return c.json({ error: `Failed to update station: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/stations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const stations = await getList("cr8w_stations");
    await setList("cr8w_stations", stations.filter(s => String(s.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete station error:", e);
    return c.json({ error: `Failed to delete station: ${e}` }, 500);
  }
});

// ── Forum ─────────────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/forum", async (c) => {
  return c.json(await getList("cr8w_forum"));
});

app.post("/make-server-8dcd9693/forum", async (c) => {
  try {
    const body = await c.req.json();
    const forum = await getList("cr8w_forum");
    const newPost = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    forum.unshift(newPost);
    await setList("cr8w_forum", forum);
    return c.json(newPost, 201);
  } catch (e) {
    console.log("Create forum post error:", e);
    return c.json({ error: `Failed to create forum post: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/forum/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const forum = await getList("cr8w_forum");
    await setList("cr8w_forum", forum.filter(p => String(p.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete forum post error:", e);
    return c.json({ error: `Failed to delete forum post: ${e}` }, 500);
  }
});

// Update a Well post (content, tag, etc.)
app.put("/make-server-8dcd9693/forum/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const forum = await getList("cr8w_forum");
    const idx = forum.findIndex((p: any) => String(p.id) === String(id));
    if (idx === -1) return c.json({ error: "Post not found" }, 404);
    const updated = { ...forum[idx], ...body, updated_at: new Date().toISOString() };
    forum[idx] = updated;
    await setList("cr8w_forum", forum);
    return c.json(updated);
  } catch (e) {
    console.log("Update forum post error:", e);
    return c.json({ error: `Failed to update forum post: ${e}` }, 500);
  }
});

// ── Forum Replies (threaded) ──────────────────────────────────────────────────
app.get("/make-server-8dcd9693/forum/replies/all", async (c) => {
  try {
    return c.json(await getList("cr8w_forum_replies"));
  } catch (e) {
    console.log("Get all forum replies error:", e);
    return c.json({ error: `Failed to get all replies: ${e}` }, 500);
  }
});

app.get("/make-server-8dcd9693/forum/:id/replies", async (c) => {
  try {
    const postId = c.req.param("id");
    const all = await getList("cr8w_forum_replies");
    return c.json(all.filter((r: any) => String(r.postId) === String(postId)));
  } catch (e) {
    console.log("Get forum replies error:", e);
    return c.json({ error: `Failed to get replies: ${e}` }, 500);
  }
});

app.post("/make-server-8dcd9693/forum/:id/replies", async (c) => {
  try {
    const postId = c.req.param("id");
    const body = await c.req.json();
    const all = await getList("cr8w_forum_replies");
    const newReply = {
      ...body,
      id: Date.now(),
      postId: Number(postId) || postId,
      created_at: new Date().toISOString(),
    };
    all.push(newReply);
    await setList("cr8w_forum_replies", all);
    return c.json(newReply, 201);
  } catch (e) {
    console.log("Create forum reply error:", e);
    return c.json({ error: `Failed to create reply: ${e}` }, 500);
  }
});

// Delete a forum reply
app.delete("/make-server-8dcd9693/forum/replies/:replyId", async (c) => {
  try {
    const replyId = c.req.param("replyId");
    const all = await getList("cr8w_forum_replies");
    await setList("cr8w_forum_replies", all.filter((r: any) => String(r.id) !== String(replyId)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete forum reply error:", e);
    return c.json({ error: `Failed to delete forum reply: ${e}` }, 500);
  }
});

// ── Messages (iMessage-style) ─────────────────────────────────────────────────
app.get("/make-server-8dcd9693/messages", async (c) => {
  return c.json(await getList("cr8w_messages"));
});

app.post("/make-server-8dcd9693/messages", async (c) => {
  try {
    const body = await c.req.json();
    const messages = await getList("cr8w_messages");
    const newMsg = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    messages.push(newMsg);
    // Keep last 500 messages
    if (messages.length > 500) messages.splice(0, messages.length - 500);
    await setList("cr8w_messages", messages);
    return c.json(newMsg, 201);
  } catch (e) {
    console.log("Create message error:", e);
    return c.json({ error: `Failed to send message: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/messages/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const messages = await getList("cr8w_messages");
    await setList("cr8w_messages", messages.filter(m => String(m.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete message error:", e);
    return c.json({ error: `Failed to delete message: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/messages/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const messages = await getList("cr8w_messages");
    const idx = messages.findIndex((m: any) => String(m.id) === String(id));
    if (idx === -1) return c.json({ error: "Message not found" }, 404);
    messages[idx] = { ...messages[idx], ...body, id: messages[idx].id };
    await setList("cr8w_messages", messages);
    return c.json(messages[idx]);
  } catch (e) {
    console.log("Update message error:", e);
    return c.json({ error: `Failed to update message: ${e}` }, 500);
  }
});

// ── Brain Dumps ───────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/braindumps", async (c) => {
  return c.json(await getList("cr8w_braindumps"));
});

app.post("/make-server-8dcd9693/braindumps", async (c) => {
  try {
    const body = await c.req.json();
    const dumps = await getList("cr8w_braindumps");
    const newDump = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    dumps.unshift(newDump);
    await setList("cr8w_braindumps", dumps);
    return c.json(newDump, 201);
  } catch (e) {
    console.log("Create brain dump error:", e);
    return c.json({ error: `Failed to create brain dump: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/braindumps/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const dumps = await getList("cr8w_braindumps");
    await setList("cr8w_braindumps", dumps.filter(d => String(d.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete brain dump error:", e);
    return c.json({ error: `Failed to delete brain dump: ${e}` }, 500);
  }
});

// ── Announcements ─────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/announcements", async (c) => {
  return c.json(await getList("cr8w_announcements"));
});

app.post("/make-server-8dcd9693/announcements", async (c) => {
  try {
    const body = await c.req.json();
    const anns = await getList("cr8w_announcements");
    const newAnn = { ...body, id: Date.now(), active: 1, created_at: new Date().toISOString() };
    anns.unshift(newAnn);
    await setList("cr8w_announcements", anns);
    return c.json(newAnn, 201);
  } catch (e) {
    console.log("Create announcement error:", e);
    return c.json({ error: `Failed to create announcement: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/announcements/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const anns = await getList("cr8w_announcements");
    await setList("cr8w_announcements", anns.filter(a => String(a.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete announcement error:", e);
    return c.json({ error: `Failed to delete announcement: ${e}` }, 500);
  }
});

// ── Workshops ─────────────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/workshops", async (c) => {
  return c.json(await getList("cr8w_workshops"));
});

app.post("/make-server-8dcd9693/workshops", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_workshops");
    const item = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_workshops", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create workshop error:", e);
    return c.json({ error: `Failed to create workshop: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/workshops/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const list = await getList("cr8w_workshops");
    const idx = list.findIndex((w: any) => String(w.id) === String(id));
    if (idx === -1) return c.json({ error: "Workshop not found" }, 404);
    list[idx] = { ...list[idx], ...body, id: list[idx].id };
    await setList("cr8w_workshops", list);
    return c.json(list[idx]);
  } catch (e) {
    console.log("Update workshop error:", e);
    return c.json({ error: `Failed to update workshop: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/workshops/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList("cr8w_workshops");
    await setList("cr8w_workshops", list.filter((w: any) => String(w.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete workshop error:", e);
    return c.json({ error: `Failed to delete workshop: ${e}` }, 500);
  }
});

// ── Workshop Programs ─────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/workshop-programs", async (c) => {
  return c.json(await getList("cr8w_workshop_programs"));
});

app.post("/make-server-8dcd9693/workshop-programs", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_workshop_programs");
    const item = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_workshop_programs", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create workshop program error:", e);
    return c.json({ error: `Failed to create workshop program: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/workshop-programs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const list = await getList("cr8w_workshop_programs");
    const idx = list.findIndex((p: any) => String(p.id) === String(id));
    if (idx === -1) return c.json({ error: "Program not found" }, 404);
    list[idx] = { ...list[idx], ...body, id: list[idx].id };
    await setList("cr8w_workshop_programs", list);
    return c.json(list[idx]);
  } catch (e) {
    console.log("Update workshop program error:", e);
    return c.json({ error: `Failed to update workshop program: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/workshop-programs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList("cr8w_workshop_programs");
    await setList("cr8w_workshop_programs", list.filter((p: any) => String(p.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete workshop program error:", e);
    return c.json({ error: `Failed to delete workshop program: ${e}` }, 500);
  }
});

// ── Workshop Resources ────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/workshop-resources", async (c) => {
  return c.json(await getList("cr8w_workshop_resources"));
});

app.post("/make-server-8dcd9693/workshop-resources", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_workshop_resources");
    const item = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_workshop_resources", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create workshop resource error:", e);
    return c.json({ error: `Failed to create workshop resource: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/workshop-resources/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList("cr8w_workshop_resources");
    await setList("cr8w_workshop_resources", list.filter((r: any) => String(r.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete workshop resource error:", e);
    return c.json({ error: `Failed to delete workshop resource: ${e}` }, 500);
  }
});

// ── CoFlow Dates (behind h0es doors meetings) ───────────────────────────────────────────────
app.get("/make-server-8dcd9693/coflow-dates", async (c) => {
  return c.json(await getList("cr8w_coflow_dates"));
});

app.post("/make-server-8dcd9693/coflow-dates", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_coflow_dates");
    const item = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_coflow_dates", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create coflow date error:", e);
    return c.json({ error: `Failed to create coflow date: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/coflow-dates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const list = await getList("cr8w_coflow_dates");
    const idx = list.findIndex((d: any) => String(d.id) === String(id));
    if (idx === -1) return c.json({ error: "CoFlow date not found" }, 404);
    list[idx] = { ...list[idx], ...body, id: list[idx].id };
    await setList("cr8w_coflow_dates", list);
    return c.json(list[idx]);
  } catch (e) {
    console.log("Update coflow date error:", e);
    return c.json({ error: `Failed to update coflow date: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/coflow-dates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList("cr8w_coflow_dates");
    await setList("cr8w_coflow_dates", list.filter((d: any) => String(d.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete coflow date error:", e);
    return c.json({ error: `Failed to delete coflow date: ${e}` }, 500);
  }
});

// ── CoFlow Check-ins ──────────────────────────────────────────────────────────
app.get("/make-server-8dcd9693/coflow-checkins", async (c) => {
  return c.json(await getList("cr8w_coflow_checkins"));
});

app.post("/make-server-8dcd9693/coflow-checkins", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_coflow_checkins");
    const item = { ...body, id: Date.now(), created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_coflow_checkins", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create coflow checkin error:", e);
    return c.json({ error: `Failed to create coflow checkin: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/coflow-checkins/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList("cr8w_coflow_checkins");
    await setList("cr8w_coflow_checkins", list.filter((c: any) => String(c.id) !== String(id)));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Delete coflow checkin error:", e);
    return c.json({ error: `Failed to delete coflow checkin: ${e}` }, 500);
  }
});

// ── Well Notes (Notes from the Well — anonymous community exchange) ────────────
app.get("/make-server-8dcd9693/well-notes", async (c) => {
  return c.json(await getList("cr8w_well_notes"));
});

app.post("/make-server-8dcd9693/well-notes", async (c) => {
  try {
    const body = await c.req.json();
    const list = await getList("cr8w_well_notes");
    const item = { ...body, id: Date.now(), landed: 0, created_at: new Date().toISOString() };
    list.push(item);
    await setList("cr8w_well_notes", list);
    return c.json(item, 201);
  } catch (e) {
    console.log("Create well note error:", e);
    return c.json({ error: `Failed to create well note: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/well-notes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const list = await getList("cr8w_well_notes");
    const idx = list.findIndex((n: any) => String(n.id) === String(id));
    if (idx === -1) return c.json({ error: "Well note not found" }, 404);
    list[idx] = { ...list[idx], ...body, id: list[idx].id };
    await setList("cr8w_well_notes", list);
    return c.json(list[idx]);
  } catch (e) {
    console.log("Update well note error:", e);
    return c.json({ error: `Failed to update well note: ${e}` }, 500);
  }
});

// ── Google Calendar OAuth Token Exchange
app.post("/make-server-8dcd9693/gcal-token-exchange", async (c) => {
  try {
    const { code, code_verifier, redirect_uri, client_id } = await c.req.json();

    if (!code || !redirect_uri || !client_id) {
      return c.json({ error: "Missing required fields: code, redirect_uri, client_id" }, 400);
    }

    const clientSecret = Deno.env.get("GCAL_CLIENT_SECRET");
    if (!clientSecret) {
      console.log("GCAL_CLIENT_SECRET env var is not set");
      return c.json({ error: "Server misconfiguration: Google OAuth client secret not set" }, 500);
    }

    const params: Record<string, string> = {
      code,
      client_id: client_id,
      client_secret: clientSecret,
      redirect_uri,
      grant_type: "authorization_code",
    };
    if (code_verifier) {
      params.code_verifier = code_verifier;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.log("Google OAuth token exchange error:", tokenData.error, tokenData.error_description);
      return c.json({ error: tokenData.error, error_description: tokenData.error_description }, 400);
    }

    // Only return access_token (and optionally refresh_token / expires_in) — never echo the secret
    return c.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    });
  } catch (e) {
    console.log("GCal token exchange error:", e);
    return c.json({ error: `GCal token exchange failed: ${e}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVITE COUNTS (pushed from Google Sheets via Apps Script)
// ══════════════════════════════════════════════════════════════════════════════
const INVITE_COUNTS_KEY = "cr8w_invite_counts";

app.get("/make-server-8dcd9693/invite-counts", async (c) => {
  try {
    const raw = await kv.get(INVITE_COUNTS_KEY);
    if (!raw) return c.json({ confirmed: 0, pending: 0, declined: 0, maybe: 0, total: 0 });
    try {
      return c.json(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch {
      return c.json({ confirmed: 0, pending: 0, declined: 0, maybe: 0, total: 0 });
    }
  } catch (e) {
    console.log("Invite counts GET error:", e);
    return c.json({ error: `Failed to get invite counts: ${e}` }, 500);
  }
});

app.post("/make-server-8dcd9693/invite-counts", async (c) => {
  try {
    const body = await c.req.json();
    const counts = {
      confirmed: Number(body.confirmed) || 0,
      pending: Number(body.pending) || 0,
      declined: Number(body.declined) || 0,
      maybe: Number(body.maybe) || 0,
      total: Number(body.total) || 0,
      updated_at: new Date().toISOString(),
    };
    await kv.set(INVITE_COUNTS_KEY, JSON.stringify(counts));
    return c.json({ ok: true, ...counts });
  } catch (e) {
    console.log("Invite counts POST error:", e);
    return c.json({ error: `Failed to save invite counts: ${e}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS (generic JSON key-value config storage)
// ══════════════════════════════════════════════════════════════════════════════
const SETTINGS_PREFIX = "cr8w_settings_";

app.get("/make-server-8dcd9693/settings/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const raw = await kv.get(`${SETTINGS_PREFIX}${key}`);
    if (!raw) return c.json({ value: null });
    try {
      return c.json({ value: typeof raw === "string" ? JSON.parse(raw) : raw });
    } catch {
      return c.json({ value: raw });
    }
  } catch (e) {
    console.log("Settings GET error:", e);
    return c.json({ error: `Failed to get setting: ${e}` }, 500);
  }
});

app.put("/make-server-8dcd9693/settings/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const body = await c.req.json();
    await kv.set(`${SETTINGS_PREFIX}${key}`, JSON.stringify(body.value));
    return c.json({ ok: true });
  } catch (e) {
    console.log("Settings PUT error:", e);
    return c.json({ error: `Failed to save setting: ${e}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR EVENTS (synced from Google Calendar via Apps Script or manual POST)
// ══════════════════════════════════════════════════════════════════════════════
const CALENDAR_EVENTS_KEY = "cr8w_calendar_events";

app.get("/make-server-8dcd9693/calendar-events", async (c) => {
  try {
    return c.json(await getList(CALENDAR_EVENTS_KEY));
  } catch (e) {
    console.log("Calendar events GET error:", e);
    return c.json({ error: `Failed to get calendar events: ${e}` }, 500);
  }
});

app.post("/make-server-8dcd9693/calendar-events", async (c) => {
  try {
    const body = await c.req.json();
    const events = Array.isArray(body) ? body : (body.events || []);
    const normalized = events.map((ev: any, i: number) => ({
      id: ev.id || `gcal-${Date.now()}-${i}`,
      title: ev.title || "(No title)",
      start: ev.start || "",
      end: ev.end || "",
      location: ev.location || "",
      description: ev.description || "",
      creator: ev.creator || "",
      synced_at: new Date().toISOString(),
    }));
    await setList(CALENDAR_EVENTS_KEY, normalized);
    return c.json({ ok: true, count: normalized.length });
  } catch (e) {
    console.log("Calendar events POST error:", e);
    return c.json({ error: `Failed to save calendar events: ${e}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PARKING LOT (quick-capture items from Playground)
// ══════════════════════════════════════════════════════════════════════════════
const PARKING_LOT_KEY = "cr8w_parking_lot";

app.get("/make-server-8dcd9693/parking-lot", async (c) => {
  try {
    return c.json(await getList(PARKING_LOT_KEY));
  } catch (e) {
    console.log("Parking lot GET error:", e);
    return c.json({ error: `Failed to get parking lot items: ${e}` }, 500);
  }
});

app.post("/make-server-8dcd9693/parking-lot", async (c) => {
  try {
    const body = await c.req.json();
    // If body is an array, replace entire list; if single item, append
    if (Array.isArray(body)) {
      await setList(PARKING_LOT_KEY, body);
      return c.json({ ok: true, count: body.length });
    }
    // Single item append
    const existing = await getList(PARKING_LOT_KEY);
    const item = {
      id: body.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: body.text || "",
      category: body.category || "spark",
      author: body.author || "monny",
      created_at: body.created_at || new Date().toISOString(),
    };
    existing.unshift(item);
    await setList(PARKING_LOT_KEY, existing);
    return c.json({ ok: true, item });
  } catch (e) {
    console.log("Parking lot POST error:", e);
    return c.json({ error: `Failed to save parking lot item: ${e}` }, 500);
  }
});

app.delete("/make-server-8dcd9693/parking-lot/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await getList(PARKING_LOT_KEY);
    const filtered = existing.filter((item: any) => item.id !== id);
    await setList(PARKING_LOT_KEY, filtered);
    return c.json({ ok: true });
  } catch (e) {
    console.log("Parking lot DELETE error:", e);
    return c.json({ error: `Failed to delete parking lot item: ${e}` }, 500);
  }
});

Deno.serve(app.fetch);