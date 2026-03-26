import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    // Create a unique folder based on timestamp to avoid overwriting
    const uniqueFolderName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const destDir = path.join(process.cwd(), "public", "model", "custom", uniqueFolderName);

    await mkdir(destDir, { recursive: true });

    // Write zip
    const zipPath = path.join(destDir, "model.zip");
    await writeFile(zipPath, buffer);

    // Extract using AdmZip
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);

    // Find model3.json
    const { readdir } = await import("fs/promises");
    const findModel3Json = async (dir: string): Promise<string | null> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = await findModel3Json(fullPath);
          if (found) return found;
        } else if (entry.name.endsWith(".model3.json")) {
          return fullPath;
        }
      }
      return null;
    };

    const model3Path = await findModel3Json(destDir);
    if (!model3Path) {
      return Response.json({ error: "No .model3.json found in ZIP" }, { status: 400 });
    }

    // Convert to public-relative path
    const publicRoot = path.join(process.cwd(), "public");
    const relativePath = "/" + path.relative(publicRoot, model3Path).replace(/\\/g, "/");
    
    // Original name minus .zip
    const modelName = file.name.replace(/\.zip$/i, "");

    return Response.json({ path: relativePath, name: modelName });
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
