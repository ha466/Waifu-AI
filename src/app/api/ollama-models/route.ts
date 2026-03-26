export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = url.searchParams.get("baseUrl") || "http://localhost:11434";

  try {
    const res = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = await res.json();
    const models = (data.models ?? []).map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }));
    return Response.json(models);
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to fetch Ollama models" },
      { status: 502 },
    );
  }
}
