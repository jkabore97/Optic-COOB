import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/frames/:id/image — photo d'une monture du catalogue (URL versionnée, cache long). */
export async function GET(_req: Request, ctx: RouteContext<"/api/frames/[id]/image">) {
  const { id } = await ctx.params;
  const image = await getStore().getFrameImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(image.bytes as BodyInit, {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": new Date(image.updatedAt).toUTCString(),
    },
  });
}
