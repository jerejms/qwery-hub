import { NextResponse } from "next/server";
import { syncAll } from "@/server/integrations/sync";

export async function POST(req: Request) {
  const { canvasToken, moduleCodes, nusmodsShareLink } = await req.json();

  try {
    const data = await syncAll({ canvasToken, moduleCodes, nusmodsShareLink });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "sync failed" },
      { status: 500 }
    );
  }
}
