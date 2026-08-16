import { readFile } from "fs/promises";
import path from "path";

function projectRefFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname; // ydrqbxahsjhtcriggyfh.supabase.co
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

export async function loadGarminMigrationSql(): Promise<string> {
  const migratePath = path.join(
    process.cwd(),
    "supabase",
    "migrate_garmin_vitals.sql"
  );
  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");

  try {
    return await readFile(migratePath, "utf8");
  } catch {
    return await readFile(schemaPath, "utf8");
  }
}

/**
 * Apply SQL via Supabase Management API (requires SUPABASE_ACCESS_TOKEN).
 * Docs: POST /v1/projects/{ref}/database/query
 */
export async function applyGarminMigrationViaManagementApi(): Promise<{
  success: boolean;
  message: string;
  skipped?: boolean;
}> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!accessToken) {
    return {
      success: false,
      skipped: true,
      message:
        "SUPABASE_ACCESS_TOKEN not set — skipped auto-migration. Sync will sanitize payloads instead.",
    };
  }

  if (!projectRef) {
    return {
      success: false,
      message:
        "Could not resolve SUPABASE_PROJECT_REF from NEXT_PUBLIC_SUPABASE_URL",
    };
  }

  const sql = await loadGarminMigrationSql();

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    return {
      success: false,
      message: `Management API migration failed (${res.status}): ${body}`,
    };
  }

  return {
    success: true,
    message: `Applied garmin_vitals migration to project ${projectRef}`,
  };
}

/** Reload PostgREST schema cache via SQL notify (Management API). */
export async function reloadPostgrestSchema(): Promise<void> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!accessToken || !projectRef) return;

  await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
    }
  );
}
