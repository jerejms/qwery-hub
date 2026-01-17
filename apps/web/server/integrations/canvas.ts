// Server-only helpers for Canvas

export async function fetchCanvasTodo(canvasToken: string) {
  const res = await fetch("https://canvas.nus.edu.sg/api/v1/users/self/todo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${canvasToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Canvas token invalid or Canvas API unavailable");
  }

  return res.json();
}
