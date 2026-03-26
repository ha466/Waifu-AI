import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import prisma from '~/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const destDir = path.join(process.cwd(), "public", "backgrounds");

    if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });

    const filePath = path.join(destDir, uniqueFileName);
    await writeFile(filePath, buffer);

    const relativePath = `/backgrounds/${uniqueFileName}`;
    
    // Save to DB
    const asset = await prisma.asset.create({
      data: {
        type: "background",
        name: file.name,
        path: relativePath
      }
    });

    return Response.json(asset);
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({ where: { type: "background" }, orderBy: { createdAt: "desc" }});
    return Response.json(assets);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

import { unlink } from "fs/promises";

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "Missing ID" }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.type !== "background") return Response.json({ error: "Not found" }, { status: 404 });

    const filePath = path.join(process.cwd(), "public", asset.path);
    if (existsSync(filePath)) await unlink(filePath);

    await prisma.asset.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
