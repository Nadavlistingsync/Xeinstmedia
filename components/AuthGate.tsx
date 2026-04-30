"use client";

import { FormEvent, useEffect, useState } from "react";
import { MarketplaceApp } from "@/components/MarketplaceApp";

type SessionResponse = {
  user: null | { id: string; email: string };
};

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<null | { id: string; email: string }>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as SessionResponse;
        setUser(payload.user);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        user?: { id?: string; email?: string };
        message?: string;
      };

      if (response.status === 202) {
        setMessage(payload.message || "Check your email to confirm your account.");
        return;
      }

      if (!response.ok || !payload.user?.email) {
        throw new Error(payload.message || "Authentication failed.");
      }

      setUser({
        id: payload.user.id ?? "unknown",
        email: payload.user.email,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="checkout-complete"><section><p>Loading session...</p></section></main>;
  }

  if (user) {
    return <MarketplaceApp user={user} />;
  }

  return (
    <main className="checkout-complete">
      <section>
        <p className="eyebrow">RentTok Access</p>
        <h1>{mode === "login" ? "Log In" : "Sign Up"}</h1>
        <p>Use your email and password to access the NYC marketplace.</p>
        <form className="booking-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {message ? <p className="error-text">{message}</p> : null}
          <button className="primary-cta" disabled={submitting} type="submit">
            {submitting ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
        <button
          className="text-cta"
          type="button"
          onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </section>
    </main>
  );
}
