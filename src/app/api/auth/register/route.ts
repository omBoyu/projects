import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createUser } from "@/storage/database/users";

export async function POST(request: NextRequest) {
  try {
    const { username, password, turnstileToken } = await request.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供用户名和密码" },
        { status: 400 }
      );
    }

    if (typeof turnstileToken !== "string" || !turnstileToken) {
      return NextResponse.json(
        { success: false, error: "请完成验证码" },
        { status: 400 }
      );
    }

    const isHuman = await verifyTurnstileToken(request, turnstileToken);
    if (!isHuman) {
      return NextResponse.json(
        { success: false, error: "验证码验证失败，请重试" },
        { status: 400 }
      );
    }

    const user = await createUser(username, password);
    const response = NextResponse.json({ success: true, user });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
