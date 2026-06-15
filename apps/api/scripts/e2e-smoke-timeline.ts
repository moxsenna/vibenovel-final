import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const apiBase = "http://localhost:8787";

const projectId = "a0000000-0000-4000-8000-000000000101";

async function main() {
  console.log("Starting E2E Smoke Test for Sprint 17 Timeline & Mini-Arcs...");

  // 1. Authenticate with Supabase Auth
  console.log("Authenticating...");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "penulis@contoh.id",
    password: "vibenovel-local-dev-seed",
  });

  if (authError || !authData.session) {
    console.error("Login failed:", authError);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log("Logged in successfully! Token:", token.slice(0, 15) + "...");

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Helper function for API calls
  async function apiPost(path: string, body: any = {}) {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok) {
      throw new Error(`POST ${path} failed with status ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  async function apiGet(path: string) {
    const res = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers,
    });
    const json: any = await res.json();
    if (!res.ok) {
      throw new Error(`GET ${path} failed with status ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  // 2. Lock Foundation (Required before outline generation)
  console.log("Locking story foundation...");
  const lockFoundationRes = await apiPost(`/api/projects/${projectId}/foundation/lock`);
  console.log("Foundation locked response:", JSON.stringify(lockFoundationRes));

  // 3. Generate 10-Chapter Outline (Triggers mini-arcs creation)
  console.log("Generating 10-chapter outline...");
  const genOutlineRes = await apiPost(`/api/projects/${projectId}/outline/generate`, {
    regenerate: true,
    targetChapterCount: 10,
  });
  console.log("Outline generated response:", JSON.stringify(genOutlineRes));

  // 4. Verify Mini-Arcs table in DB directly
  console.log("Verifying mini_arcs table in the database...");
  const { data: miniArcs, error: miniArcsError } = await supabase
    .from("mini_arcs")
    .select("*")
    .eq("project_id", projectId);

  if (miniArcsError) {
    throw new Error(`Failed to query mini_arcs table: ${miniArcsError.message}`);
  }

  console.log("Mini-Arcs found in database:", JSON.stringify(miniArcs));
  assert.equal(miniArcs?.length, 2, "There must be exactly 2 mini-arcs generated (10 chapters / size 5).");
  console.log("PASS: Exactly 2 mini-arcs created successfully.");

  // 5. Lock the Outline
  console.log("Locking outline...");
  const lockOutlineRes = await apiPost(`/api/projects/${projectId}/outline/lock`);
  console.log("Outline locked response:", JSON.stringify(lockOutlineRes));

  // 6. Get Chapters list to get chapter outline IDs
  console.log("Fetching chapter outlines...");
  const chaptersRes = await apiGet(`/api/projects/${projectId}/outline/chapters`);
  const chapters = chaptersRes.data.chapters;
  console.log(`Found ${chapters.length} chapters.`);

  const ch1 = chapters.find((c: any) => c.chapterNumber === 1);
  const ch2 = chapters.find((c: any) => c.chapterNumber === 2);

  if (!ch1 || !ch2) {
    throw new Error("Could not find Chapter 1 or Chapter 2 outlines!");
  }

  console.log(`Bab 1 ID: ${ch1.id}, Bab 2 ID: ${ch2.id}`);

  // 7. Start Writing Session for Chapter 1
  console.log("Starting writing session for Chapter 1...");
  const session1Res = await apiPost(`/api/projects/${projectId}/write/sessions`, {
    chapterOutlineId: ch1.id,
  });
  const session1 = session1Res.data.session;
  console.log("Chapter 1 Session:", JSON.stringify(session1));

  // 8. List beats for session to get beat ID
  console.log("Listing beats for Chapter 1 session...");
  const beatsRes = await apiGet(`/api/projects/${projectId}/write/sessions/${session1.id}/beats`);
  const beats = beatsRes.data.beats;
  console.log(`Found ${beats.length} beats in session.`);
  const beat1 = beats[0];
  if (!beat1) {
    throw new Error("No beats found in Chapter 1 session!");
  }

  // 9. Save prose draft for beat 1
  console.log("Saving prose draft for Beat 1...");
  const saveProseRes = await apiPost(`/api/projects/${projectId}/write/beats/${beat1.id}/prose`, {
    proseText: "Teks narasi untuk Bab 1. Nadira melihat pesan yang dihapus di HP suaminya. Pikirannya dipenuhi kekhawatiran.",
  });
  console.log("Prose draft saved:", JSON.stringify(saveProseRes));

  // 10. Mark session ready for summary
  console.log("Marking session 1 ready for summary...");
  const readySummaryRes = await apiPost(`/api/projects/${projectId}/write/sessions/${session1.id}/ready-for-summary`);
  console.log("Ready for summary response:", JSON.stringify(readySummaryRes));

  // 11. Generate summary
  console.log("Generating summary for Chapter 1...");
  const genSummaryRes = await apiPost(`/api/projects/${projectId}/summary/generate`, {
    chapterOutlineId: ch1.id,
  });
  const summary = genSummaryRes.data.summary;
  const summaryItems = genSummaryRes.data.items;
  console.log("Generated Summary:", JSON.stringify(summary));
  console.log("Summary Items:", JSON.stringify(summaryItems));

  // 12. Approve summary (Triggers timeline event generation)
  console.log("Approving summary (should generate timeline event)...");
  const approveSummaryRes = await apiPost(`/api/projects/${projectId}/summary/${summary.id}/approve`);
  console.log("Summary approved response:", JSON.stringify(approveSummaryRes));

  // 13. Verify timeline_events in DB
  console.log("Checking timeline_events table in DB...");
  const { data: timelineEvents, error: timelineError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("project_id", projectId);

  if (timelineError) {
    throw new Error(`Failed to query timeline_events: ${timelineError.message}`);
  }

  console.log("Timeline events found in database:", JSON.stringify(timelineEvents));
  assert.equal(timelineEvents?.length, 1, "There should be exactly 1 timeline event for Chapter 1.");
  assert.equal(timelineEvents[0].chapter_outline_id, ch1.id, "Timeline event must correspond to Chapter 1.");
  console.log("PASS: Timeline event created successfully and matches Chapter 1.");

  // 14. Start Writing Session for Chapter 2
  console.log("Starting writing session for Chapter 2...");
  const session2Res = await apiPost(`/api/projects/${projectId}/write/sessions`, {
    chapterOutlineId: ch2.id,
  });
  const session2 = session2Res.data.session;
  console.log("Chapter 2 Session:", JSON.stringify(session2));

  // 15. Build context packet for Chapter 2 (verify no future leaks and recentTimeline contains past events)
  console.log("Building context packet for Chapter 2...");
  const packetRes = await apiPost(`/api/projects/${projectId}/write/context-packet`, {
    chapterOutlineId: ch2.id,
  });
  console.log("Context packet generated!");
  const logId = packetRes.data.packetLogId;

  // Retrieve the packet_json from context_packet_logs
  const { data: packetLog, error: packetLogError } = await supabase
    .from("context_packet_logs")
    .select("packet_json")
    .eq("id", logId)
    .single();

  if (packetLogError || !packetLog) {
    throw new Error(`Failed to retrieve packet log: ${packetLogError?.message}`);
  }

  const packetJson = packetLog.packet_json as any;
  console.log("Context Packet JSON Metadata:", JSON.stringify(packetJson.meta));
  console.log("Context Packet JSON Continuity RecentTimeline:", JSON.stringify(packetJson.continuity.recentTimeline));

  const recentTimeline = packetJson.continuity.recentTimeline;
  assert.ok(recentTimeline && recentTimeline.length > 0, "recentTimeline must not be empty");

  // Make sure it contains Chapter 1 event but NOT Chapter 2 or future events
  const hasCh1Event = recentTimeline.some((event: string) => event.includes("Bab 1"));
  const hasCh2Event = recentTimeline.some((event: string) => event.includes("Bab 2"));

  assert.ok(hasCh1Event, "recentTimeline must contain Bab 1 summary");
  assert.ok(!hasCh2Event, "recentTimeline must NOT leak Bab 2 summary (current chapter)");

  console.log("PASS: recentTimeline works correctly (contains past-only event, does not leak current/future events).");
  console.log("ALL E2E SMOKE VERIFICATIONS PASSED!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
