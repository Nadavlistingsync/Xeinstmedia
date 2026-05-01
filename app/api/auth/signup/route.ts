import { NextResponse } from "next/server";
import {
  createSessionFromPassword,
  setAuthCookies,
} from "@/lib/supabase-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function isAlreadyExistsMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("exists") ||
    normalized.includes("registered") ||
    normalized.includes("duplicate")
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      accountType?: "agent" | "creator" | string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const accountType = body.accountType === "creator" ? "creator" : "agent";

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        account_type: accountType,
      },
    });

    if (createUser.error && !isAlreadyExistsMessage(createUser.error.message)) {
      return NextResponse.json(
        { message: createUser.error.message || "Could not sign up." },
        { status: 400 },
      );
    }

    const session = await createSessionFromPassword(email, password);
    if (!session.tokens) {
      return NextResponse.json(
        {
          message: "Could not log in after signup. Try logging in again.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      user: {
        id: session.user?.id ?? "",
        email: session.user?.email ?? email,
        accountType: session.user?.accountType ?? accountType,
      },
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
