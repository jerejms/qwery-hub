import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { canvasToken, moduleCodes, nusmodsShareLink } = await req.json();

  // Mock values so the UI works today.
  const tasksCount = canvasToken ? 5 : 0;
  const modulesCount = Array.isArray(moduleCodes) ? moduleCodes.length : 0;

  return NextResponse.json({ tasksCount, modulesCount });
}
