"use client";

import {
  ArrowRight,
  BarChart3,
  Building2,
  Clapperboard,
  Eye,
  EyeOff,
  MapPinned,
  UploadCloud,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CreatorPortal } from "@/components/CreatorPortal";
import { MarketplaceApp } from "@/components/MarketplaceApp";

type SessionResponse = {
  user: null | { id: string; email: string; accountType: "agent" | "creator" };
};

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [accountType, setAccountType] = useState<"agent" | "creator">("agent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("error");
  const [user, setUser] = useState<null | { id: string; email: string; accountType: "agent" | "creator" }>(null);

  const roleCopy = {
    agent: {
      title: "Create your agent workspace",
      description: "Launch campaigns for NYC rentals, upload listing videos, and keep every creator handoff organized.",
      summaryTitle: "Built for listing teams",
      summary:
        "Choose the creator page, send the video, and keep campaign progress visible from one dashboard.",
    },
    creator: {
      title: "Create your creator workspace",
      description: "List your TikTok page, receive incoming campaigns, download videos, and report performance after posting.",
      summaryTitle: "Built for creator partners",
      summary:
        "Claim your page, receive property videos, and update campaign traction without digging through messages.",
    },
  } as const;
  const selectedRoleCopy = roleCopy[accountType];

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
    setMessageTone("error");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          accountType: mode === "signup" ? accountType : undefined,
        }),
      });
      const payload = (await response.json()) as {
        user?: { id?: string; email?: string; accountType?: "agent" | "creator" };
        message?: string;
      };

      if (response.status === 202) {
        setMessageTone("info");
        setMessage(payload.message || "Check your email to confirm your account.");
        return;
      }

      if (!response.ok || !payload.user?.email) {
        throw new Error(payload.message || "Authentication failed.");
      }

      setUser({
        id: payload.user.id ?? "unknown",
        email: payload.user.email,
        accountType: payload.user.accountType === "creator" ? "creator" : "agent",
      });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-loading">
        <section>
          <p className="eyebrow">RentTok access</p>
          <h1>Loading your workspace</h1>
          <p>Checking your session and routing you to the right dashboard.</p>
        </section>
      </main>
    );
  }

  if (user) {
    return user.accountType === "creator" ? (
      <CreatorPortal user={user} />
    ) : (
      <MarketplaceApp user={user} />
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-stage">
        <section className="auth-story">
          <div className="brand auth-brand">
            <div className="brand-mark">RT</div>
            <div>
              <strong>RentTok</strong>
              <span>NYC rental video workflow</span>
            </div>
          </div>
          <div className="auth-story-copy">
            <p className="eyebrow">NYC creator network</p>
            <h1>Move rental videos from agents to creators without the inbox chaos.</h1>
            <p>
              Agents upload the listing, creators grab the video and post it, and both sides stay on the
              same dashboard from first handoff through reported results.
            </p>
          </div>
          <div className="auth-story-grid">
            <article className="auth-story-card">
              <span>
                <MapPinned size={18} />
              </span>
              <div>
                <strong>NYC-only creator pages</strong>
                <p>Keep the marketplace focused on local rental inventory and neighborhood-specific audiences.</p>
              </div>
            </article>
            <article className="auth-story-card">
              <span>
                <UploadCloud size={18} />
              </span>
              <div>
                <strong>Fast listing handoff</strong>
                <p>Agents can send the property video straight into a live campaign without extra back-and-forth.</p>
              </div>
            </article>
            <article className="auth-story-card">
              <span>
                <BarChart3 size={18} />
              </span>
              <div>
                <strong>Shared status tracking</strong>
                <p>Creators download, post, and report results while agents monitor campaign progress in one place.</p>
              </div>
            </article>
          </div>
          <div className="auth-story-tags" aria-label="Platform details">
            <span>NYC only</span>
            <span>Agent + creator dashboards</span>
            <span>Manual creator posting</span>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-top">
            <div className="auth-mode-toggle" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Sign up
              </button>
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Log in
              </button>
            </div>
            <div className="auth-panel-copy">
              <p className="eyebrow">RentTok access</p>
              <h2>{mode === "login" ? "Welcome back" : selectedRoleCopy.title}</h2>
              <p>
                {mode === "login"
                  ? "Use the email and password for your existing agent or creator dashboard."
                  : selectedRoleCopy.description}
              </p>
            </div>
          </div>
          <form className="booking-form auth-form" onSubmit={onSubmit}>
            {mode === "signup" ? (
              <fieldset className="auth-role-fieldset">
                <legend>Choose your role</legend>
                <div className="auth-role-grid">
                  <button
                    type="button"
                    className={`auth-role-card ${accountType === "agent" ? "active" : ""}`}
                    onClick={() => {
                      setAccountType("agent");
                      setMessage("");
                    }}
                  >
                    <span className="auth-role-icon">
                      <Building2 size={18} />
                    </span>
                    <span className="auth-role-copy">
                      <strong>Agent</strong>
                      <small>Book creator pages for rental listings and manage campaigns from one workspace.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`auth-role-card ${accountType === "creator" ? "active" : ""}`}
                    onClick={() => {
                      setAccountType("creator");
                      setMessage("");
                    }}
                  >
                    <span className="auth-role-icon">
                      <Clapperboard size={18} />
                    </span>
                    <span className="auth-role-copy">
                      <strong>Creator</strong>
                      <small>List your TikTok page, receive videos, and report post performance back to agents.</small>
                    </span>
                  </button>
                </div>
              </fieldset>
            ) : null}
            <label className="auth-field" htmlFor="auth-email">
              <span>Email</span>
              <input
                id="auth-email"
                autoComplete="email"
                placeholder={mode === "signup" ? "you@agency.com" : "you@example.com"}
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="auth-field" htmlFor="auth-password">
              <span className="auth-label-row">
                <span>Password</span>
                <small>{mode === "signup" ? "Minimum 6 characters" : "Use your existing password"}</small>
              </span>
              <span className="password-field auth-password-field">
                <input
                  id="auth-password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  placeholder={mode === "signup" ? "Create a secure password" : "Enter your password"}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {message ? (
              <p className={`error-text auth-message ${messageTone === "info" ? "info" : ""}`}>{message}</p>
            ) : null}
            <button className="primary-cta auth-submit" disabled={submitting} type="submit">
              <span>
                {submitting
                  ? "Please wait..."
                  : mode === "login"
                    ? "Enter dashboard"
                    : accountType === "agent"
                      ? "Create agent account"
                      : "Create creator account"}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="auth-panel-bottom">
            <div className="auth-summary">
              <span className="auth-summary-icon">
                {mode === "login" ? <Clapperboard size={18} /> : accountType === "agent" ? <Building2 size={18} /> : <Clapperboard size={18} />}
              </span>
              <div>
                <strong>{mode === "login" ? "One login, role-based routing" : selectedRoleCopy.summaryTitle}</strong>
                <p>
                  {mode === "login"
                    ? "We route you into the correct dashboard after sign-in, whether you are managing listings or posting them."
                    : selectedRoleCopy.summary}
                </p>
              </div>
            </div>
            <button
              className="text-cta auth-switch-link"
              type="button"
              onClick={() => {
                setMode((current) => (current === "login" ? "signup" : "login"));
                setMessage("");
              }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
