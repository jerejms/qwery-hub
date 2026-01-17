import { NextResponse } from "next/server";
import { getTimetableFromShareLink } from "@/server/integrations/nusmods";
import { fetchCanvasAssignments } from "@/server/integrations/canvas";

export async function POST(req: Request) {
  try {
    const { canvasToken, nusmodsShareLink } = await req.json();
    const semester = 2; // hardcoded

    // Always initialize arrays
    let modules: any[] = [];
    let assignments: any[] = [];

    // Fetch NUSMods modules if link is provided
    if (nusmodsShareLink) {
      try {
        modules = await getTimetableFromShareLink(nusmodsShareLink, semester);
      } catch (err: any) {
        console.warn("NUSMods fetch failed:", err.message);
        modules = [];
      }
    }

    // Fetch Canvas assignments if token is provided
    if (canvasToken) {
      try {
        assignments = await fetchCanvasAssignments(canvasToken);
      } catch (err: any) {
        console.warn("Canvas fetch failed:", err.message);
        assignments = [];
      }
    }

    // Return arrays AND counts for frontend convenience
    return NextResponse.json({
      modules,
      assignments,
      modulesCount: modules.length,
      tasksCount: assignments.length,
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message ?? "sync failed",
        modules: [],
        assignments: [],
        modulesCount: 0,
        tasksCount: 0,
      },
      { status: 500 }
    );
  }
}