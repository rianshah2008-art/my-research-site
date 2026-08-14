import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Garmin credentials not configured. Set GARMIN_EMAIL and GARMIN_PASSWORD.",
        demo: true,
      },
      { status: 200 }
    );
  }

  try {
    const scriptPath = path.join(process.cwd(), "backend", "garmin_sync.py");
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}"`,
      {
        env: {
          ...process.env,
          GARMIN_EMAIL: email,
          GARMIN_PASSWORD: password,
        },
        timeout: 120000,
      }
    );

    if (stderr && !stdout.includes("SUCCESS")) {
      console.error("Garmin sync stderr:", stderr);
    }

    return NextResponse.json({
      success: true,
      message: "Garmin data synced successfully",
      output: stdout.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync failed";
    console.error("Garmin sync error:", message);
    return NextResponse.json(
      { success: false, message: `Garmin sync failed: ${message}` },
      { status: 500 }
    );
  }
}
