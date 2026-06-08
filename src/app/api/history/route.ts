import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listTravelRecords } from "@/storage/database/travel-records";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "请先登录" },
      { status: 401 }
    );
  }

  try {
    const data = await listTravelRecords(user.id, limit);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "查询历史记录失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
