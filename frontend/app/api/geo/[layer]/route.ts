const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Proxy server-side hacia FastAPI: el mapa (Client Component) necesita
// cambiar de capa sin recargar la página, pero llamar a FastAPI directo
// desde el browser requeriría CORS. Este route handler evita eso —
// el fetch real lo sigue haciendo el servidor de Next.js.
export async function GET(_request: Request, ctx: { params: Promise<{ layer: string }> }) {
  const { layer } = await ctx.params;
  const upstream = await fetch(`${API_BASE_URL}/geo/${layer}`, {
    next: { revalidate: 3600 },
  });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
