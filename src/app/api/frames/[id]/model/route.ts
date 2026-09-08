import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/frames/:id/model — modèle 3D (GLB) d'une monture (URL versionnée, cache long). */
export async function GET(_req: Request, ctx: RouteContext<"/api/frames/[id]/model">) {
  const { id } = await ctx.params;
  const model = await getStore().getFrameModel(id);
  if (!model) return new Response("Not found", { status: 404 });
  return new Response(model.bytes as BodyInit, {
    headers: {
      "Content-Type": model.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": new Date(model.updatedAt).toUTCString(),
    },
  });
}
