// canvas.ts - Server-only Canvas helpers

export type CanvasAssignment = {
  id: number;
  title: string;
  moduleCode: string;
  dueDate: string | null;
  completed: boolean;
  url: string;
};

export async function fetchCanvasTodo(canvasToken: string) {
  const res = await fetch("https://canvas.nus.edu.sg/api/v1/users/self/todo", {
    method: "GET",
    headers: { Authorization: `Bearer ${canvasToken}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Canvas token invalid or Canvas API unavailable");
  return res.json();
}

export async function fetchCanvasAssignments(canvasToken: string): Promise<CanvasAssignment[]> {
  const data = await fetchCanvasTodo(canvasToken);
  // Canvas API /todo endpoint returns an array directly, not { items: [...] }
  const items = Array.isArray(data) ? data : (data.items || []);
  return items
    .filter((item: any) => item.assignment) // Only include items with assignment data
    .map((item: any) => ({
      id: item.assignment?.id || item.id,
      title: item.assignment?.name || item.title || 'Untitled Assignment',
      moduleCode: item.course?.code || item.course?.name || item.context_name || item.course_code || "",
      dueDate: item.assignment?.due_at || item.due_at || null,
      completed: item.complete_at != null,
      url: item.assignment?.html_url || item.html_url || null,
    }));
}