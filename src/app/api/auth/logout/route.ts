import { ENV } from "@/lib/env";
import { Cache } from "@/lib/cache";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (token) void Cache.delete(`session:${token}`);
    cookieStore.delete("access_token");
    return NextResponse.redirect(ENV.API_URI);
  } catch (error) {
    console.log("Logout Error", error);
    return NextResponse.json({ success: false, message: "Logout failed" }, { status: 500 });
  }
}
