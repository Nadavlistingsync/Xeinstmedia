import { NextResponse } from "next/server";
import {
  createSessionFromSignup,
  setAuthCookies,
} from "@/lib/supabase-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 },
      );
    }

    const session = await createSessionFromSignup(body.email, body.password);
    if (!session.ok) {
      return NextResponse.json(
        { message: session.message || "Could not sign up." },
        { status: 400 },
      );
    }

    if (!session.tokens) {
      return NextResponse.json(
        {
          message:
            "Account created. Check your inbox to confirm email, then log in.",
        },
        { status: 202 },
      );
    }

    const response = NextResponse.json({
      user: { id: session.user?.id ?? "", email: session.user?.email ?? body.email },
    });
    setAuthCookies(response, session.tokens);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not sign up.",
      },
      { status: 500 },
    );
  }
}
