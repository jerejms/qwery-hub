import { fetchCanvasTodo } from "./canvas";
import { extractModuleCodes, parseNusmodsShareLink } from "./nusmods";

export async function syncAll(args: {
  canvasToken?: string;
  moduleCodes?: string[];
  nusmodsShareLink?: string;
}) {
  const canvasToken = args.canvasToken?.trim() ?? "";
  const nusmodsShareLink = args.nusmodsShareLink?.trim() ?? "";

  const moduleCodes =
    args.moduleCodes?.length
      ? args.moduleCodes
      : nusmodsShareLink
      ? extractModuleCodes(nusmodsShareLink)
      : [];

  const selections = nusmodsShareLink ? parseNusmodsShareLink(nusmodsShareLink) : [];

  const tasks = canvasToken ? await fetchCanvasTodo(canvasToken) : [];

  return {
    tasksCount: Array.isArray(tasks) ? tasks.length : 0,
    modulesCount: moduleCodes.length,
    moduleCodes,
    selections, // ✅ add this
    lastUpdated: new Date().toISOString(),
  };
}
