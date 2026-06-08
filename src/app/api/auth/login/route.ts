import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { authenticateUser } from "@/storage/database/users";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { success: false, error: "请提供用户名和密码" },
      { status: 400 }
    );
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "用户名或密码错误" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true, user });
  setSessionCookie(response, user.id);
  return response;
}
