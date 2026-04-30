import { NextResponse } from "next/server";
import {
  createSessionFromPassword,
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

    const session = await createSessionFromPassword(body.email, body.password);
    if (!session.ok || !session.tokens) {
      return NextResponse.json(
        { message: session.message || "Could not log in." },
        { status: 401 },
      );
    }

    const email = session.user?.email ?? body.email;
    const response = NextResponse.json({
      user: { id: session.user?.id ?? "", email },
    });
    setAuthCookies(response, session.tokens);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not log in.",
      },
      { status: 500 },
    );
  }
}
