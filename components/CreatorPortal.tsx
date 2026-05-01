"use client";

import {
  BarChart3,
  Check,
  Clock3,
  ExternalLink,
  FileVideo,
  LayoutDashboard,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { compactNumber, currency, percent, todayLabel } from "@/lib/format";
import { MAX_CREATOR_ACCOUNTS } from "@/lib/limits";
import type { Campaign, TikTokPage } from "@/lib/types";

type CreatorPortalProps = {
  user: {
    id: string;
    email: string;
    accountType: "agent" | "creator";
  };
};

type PageDraft = {
  price: string;
  deliveryDays: string;
  niche: string;
  audience: string;
  tags: string;
  contentNotes: string;
};

type CampaignDraft = {
  views: string;
  likes: string;
  comments: string;
  tiktokPostId: string;
  publishMessage: string;
};

function getInitials(email: string) {
  const [name] = email.split("@");
  return name.slice(0, 2).toUpperCase() || "CR";
}

function createPageDraft(page: TikTokPage): PageDraft {
  return {
    price: String(page.price || 0),
    deliveryDays: String(page.deliveryDays || 3),
    niche: page.niche || "Rental Listings",
    audience: page.audience || "",
    tags: page.tags.join(", "),
    contentNotes: page.contentNotes.join(", "),
  };
}

function createCampaignDraft(campaign: Campaign): CampaignDraft {
  return {
    views: campaign.views ? String(campaign.views) : "",
    likes: campaign.likes ? String(campaign.likes) : "",
    comments: campaign.comments ? String(campaign.comments) : "",
    tiktokPostId: campaign.tiktokPostId ?? "",
    publishMessage: campaign.publishMessage ?? "",
  };
}

export function CreatorPortal({ user }: CreatorPortalProps) {
  const [pages, setPages] = useState<TikTokPage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("@xeinstrentalsnyc");
  const [creatorPrice, setCreatorPrice] = useState("");
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [pageDrafts, setPageDrafts] = useState<Record<string, PageDraft>>({});
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, CampaignDraft>>({});
  const [savingPageId, setSavingPageId] = useState("");
  const [savingCampaignId, setSavingCampaignId] = useState("");

  const selectedPage =
    pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tiktokStatus = params.get("tiktok_connect");
    const tiktokMessage = params.get("message");
    const connectedHandle = params.get("handle");

    if (!tiktokStatus) {
      return;
    }

    if (connectedHandle) {
      setCreatorHandle(connectedHandle);
    }

    setMessage(
      tiktokMessage ||
        (tiktokStatus === "success"
          ? "TikTok account connected."
          : "TikTok connection failed."),
    );

    params.delete("tiktok_connect");
    params.delete("message");
    params.delete("handle");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedPageId && pages[0]) {
      setSelectedPageId(pages[0].id);
    }

    setPageDrafts((current) => {
      const next = { ...current };
      for (const page of pages) {
        if (!next[page.id]) {
          next[page.id] = createPageDraft(page);
        }
      }
      return next;
    });

    setCampaignDrafts((current) => {
      const next = { ...current };
      for (const campaign of campaigns) {
        if (!next[campaign.id]) {
          next[campaign.id] = createCampaignDraft(campaign);
        }
      }
      return next;
    });
  }, [pages, campaigns, selectedPageId]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await fetch("/api/creator/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as {
        pages?: TikTokPage[];
        campaigns?: Campaign[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Could not load creator dashboard.");
      }

      const nextPages = payload.pages ?? [];
      setPages(nextPages);
      setCampaigns(payload.campaigns ?? []);
      if (nextPages[0]) {
        setSelectedPageId((current) => current || nextPages[0].id);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load creator dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function pullMetrics() {
    setCreatorBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/tiktok/creator-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: creatorHandle,
          price: Number(creatorPrice || 0),
        }),
      });
      const payload = (await response.json()) as {
        page?: TikTokPage;
        message?: string;
        note?: string;
        connectPath?: string;
      };

      if (response.status === 412 && payload.connectPath) {
        window.location.assign(payload.connectPath);
        return;
      }

      if (!response.ok || !payload.page) {
        throw new Error(payload.message || "Could not import TikTok metrics.");
      }

      setPages((current) => {
        const next = [payload.page!, ...current.filter((page) => page.id !== payload.page!.id)];
        return next;
      });
      setSelectedPageId(payload.page.id);
      setPageDrafts((current) => ({
        ...current,
        [payload.page!.id]: createPageDraft(payload.page!),
      }));
      setMessage(payload.note || `Imported live metrics for ${payload.page.handle}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import TikTok metrics.",
      );
    } finally {
      setCreatorBusy(false);
    }
  }

  function startTikTokConnect() {
    const normalized = creatorHandle.trim() || "@xeinstrentalsnyc";
    window.location.assign(
      `/api/tiktok/connect/start?handle=${encodeURIComponent(normalized)}`,
    );
  }

  async function savePageSettings() {
    if (!selectedPage) {
      return;
    }

    const draft = pageDrafts[selectedPage.id];
    if (!draft) {
      return;
    }

    setSavingPageId(selectedPage.id);
    setMessage("");

    try {
      const response = await fetch("/api/creator/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPage.id,
          price: Number(draft.price || 0),
          deliveryDays: Number(draft.deliveryDays || 3),
          niche: draft.niche,
          audience: draft.audience,
          tags: draft.tags,
          contentNotes: draft.contentNotes,
        }),
      });
      const payload = (await response.json()) as {
        page?: TikTokPage;
        message?: string;
      };

      if (!response.ok || !payload.page) {
        throw new Error(payload.message || "Could not save creator page.");
      }

      setPages((current) =>
        current.map((page) => (page.id === payload.page!.id ? payload.page! : page)),
      );
      setPageDrafts((current) => ({
        ...current,
        [payload.page!.id]: createPageDraft(payload.page!),
      }));
      setMessage(`Updated ${payload.page.handle}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save creator page.");
    } finally {
      setSavingPageId("");
    }
  }

  async function openCampaignVideo(campaign: Campaign) {
    if (!campaign.videoStoragePath) {
      setMessage("No video is attached to this campaign yet.");
      return;
    }

    try {
      const response = await fetch(
        `/api/uploads/video-url?path=${encodeURIComponent(campaign.videoStoragePath)}`,
      );
      const payload = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Could not open campaign video.");
      }

      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open campaign video.");
    }
  }

  async function updateCampaign(campaignId: string, patch: Record<string, unknown>) {
    setSavingCampaignId(campaignId);
    setMessage("");
    try {
      const response = await fetch("/api/creator/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaignId, ...patch }),
      });
      const payload = (await response.json()) as {
        campaign?: Campaign;
        message?: string;
      };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.message || "Could not update creator campaign.");
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === payload.campaign!.id ? payload.campaign! : campaign,
        ),
      );
      setCampaignDrafts((current) => ({
        ...current,
        [payload.campaign!.id]: createCampaignDraft(payload.campaign!),
      }));
      setMessage(`Updated campaign ${payload.campaign.title}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update creator campaign.",
      );
    } finally {
      setSavingCampaignId("");
    }
  }

  const activeRequests = campaigns.filter(
    (campaign) => campaign.status === "Creator Approval",
  ).length;
  const postedCount = campaigns.filter((campaign) => campaign.status === "Posted").length;
  const totalViews = campaigns.reduce((sum, campaign) => sum + (campaign.views ?? 0), 0);

  return (
    <main className="app-shell campaign-only-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RT</div>
          <div>
            <strong>RentTok</strong>
            <span>Creator Studio</span>
          </div>
        </div>

        <div className="wallet-panel">
          <span>Connected TikTok Pages</span>
          <strong>{pages.length}/{MAX_CREATOR_ACCOUNTS}</strong>
          <button type="button" onClick={startTikTokConnect}>
            Add Creator Page
          </button>
        </div>

        <div className="agent-card">
          <div className="agent-photo" aria-hidden="true" />
          <div>
            <strong>{user.email}</strong>
            <span>Creator account</span>
          </div>
          <button
            type="button"
            className="secondary-cta"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.reload();
              });
            }}
          >
            Log out
          </button>
        </div>

        <form
          className="creator-onboard"
          onSubmit={(event) => {
            event.preventDefault();
            void pullMetrics();
          }}
        >
          <div className="form-heading">
            <strong>Connect TikTok</strong>
            <Sparkles size={16} />
          </div>
          <p className="form-note">Connect your TikTok page, then pull live metrics into your listing.</p>
          <label>
            TikTok Handle
            <input
              value={creatorHandle}
              onChange={(event) => setCreatorHandle(event.target.value)}
              placeholder="@xeinstrentalsnyc"
            />
          </label>
          <label>
            Starting Post Price
            <input
              inputMode="numeric"
              value={creatorPrice}
              onChange={(event) => setCreatorPrice(event.target.value)}
              placeholder="250"
            />
          </label>
          <button className="secondary-cta" type="button" onClick={startTikTokConnect}>
            Connect TikTok
          </button>
          <button disabled={creatorBusy} type="submit">
            {creatorBusy ? "Pulling metrics..." : "Pull Metrics"}
          </button>
          {message ? <p>{message}</p> : null}
        </form>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Creator Workspace</p>
            <h1>Creator Dashboard</h1>
          </div>
          <div className="user-pill">
            <span>{getInitials(user.email)}</span>
            {user.email}
          </div>
        </header>

        {loading ? <p className="eyebrow">Loading creator workspace...</p> : null}

        <div className="dashboard-metrics">
          <div className="metric-card">
            <LayoutDashboard size={18} />
            <div>
              <strong>{pages.length}</strong>
              <span>Connected Pages</span>
            </div>
          </div>
          <div className="metric-card">
            <Clock3 size={18} />
            <div>
              <strong>{activeRequests}</strong>
              <span>Awaiting Post</span>
            </div>
          </div>
          <div className="metric-card">
            <Send size={18} />
            <div>
              <strong>{postedCount}</strong>
              <span>Posted Campaigns</span>
            </div>
          </div>
          <div className="metric-card">
            <BarChart3 size={18} />
            <div>
              <strong>{compactNumber(totalViews)}</strong>
              <span>Total Views Tracked</span>
            </div>
          </div>
        </div>

        <section className="full-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Your Pages</p>
              <h1>TikTok Listings</h1>
            </div>
          </div>

          {pages.length === 0 ? (
            <p className="eyebrow">No TikTok pages connected yet. Connect one to start receiving campaign requests.</p>
          ) : (
            <>
              <div className="page-grid">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={page.id === selectedPage?.id ? "page-card active" : "page-card"}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <div className="page-card-head">
                      <div>
                        <strong>{page.handle}</strong>
                        <span>{page.displayName}</span>
                      </div>
                      <span>{currency(page.price)}</span>
                    </div>
                    <div className="page-card-stats">
                      <span>{compactNumber(page.followers)} followers</span>
                      <span>{compactNumber(page.avgViews)} avg views</span>
                      <span>{percent(page.engagementRate)} engagement</span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedPage ? (
                <div className="split-grid">
                  <div className="full-panel nested-panel">
                    <div className="section-title compact-title">
                      <div>
                        <p className="eyebrow">Listing Settings</p>
                        <h1>{selectedPage.handle}</h1>
                      </div>
                      <button
                        type="button"
                        onClick={() => void savePageSettings()}
                        disabled={savingPageId === selectedPage.id}
                      >
                        <Check size={16} />
                        {savingPageId === selectedPage.id ? "Saving..." : "Save"}
                      </button>
                    </div>

                    <div className="compact-form">
                      <label>
                        Post Price
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.price ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                price: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Delivery Days
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.deliveryDays ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                deliveryDays: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Niche
                        <input
                          value={pageDrafts[selectedPage.id]?.niche ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                niche: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Audience
                        <input
                          value={pageDrafts[selectedPage.id]?.audience ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                audience: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={pageDrafts[selectedPage.id]?.tags ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                tags: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Requirements
                        <input
                          value={pageDrafts[selectedPage.id]?.contentNotes ?? ""}
                          onChange={(event) =>
                            setPageDrafts((current) => ({
                              ...current,
                              [selectedPage.id]: {
                                ...current[selectedPage.id],
                                contentNotes: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="full-panel nested-panel">
                    <div className="section-title compact-title">
                      <div>
                        <p className="eyebrow">Live Stats</p>
                        <h1>{selectedPage.displayName}</h1>
                      </div>
                      <button type="button" onClick={() => void pullMetrics()}>
                        <Plus size={16} />
                        Refresh Metrics
                      </button>
                    </div>
                    <div className="dashboard-metrics mini-metrics">
                      <div className="metric">
                        <strong>{compactNumber(selectedPage.followers)}</strong>
                        <span>Followers</span>
                      </div>
                      <div className="metric">
                        <strong>{compactNumber(selectedPage.avgViews)}</strong>
                        <span>Avg. Views</span>
                      </div>
                      <div className="metric">
                        <strong>{percent(selectedPage.engagementRate)}</strong>
                        <span>Engagement</span>
                      </div>
                      <div className="metric">
                        <strong>{compactNumber(selectedPage.avgLikes)}</strong>
                        <span>Avg. Likes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="full-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Incoming Campaigns</p>
              <h1>Creator Queue</h1>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <p className="eyebrow">No campaign requests yet. Once agents book your page, they’ll show up here.</p>
          ) : (
            <div className="queue-list">
              {campaigns.map((campaign) => {
                const draft = campaignDrafts[campaign.id] ?? createCampaignDraft(campaign);
                const views = Number(draft.views || 0);
                const likes = Number(draft.likes || 0);
                const comments = Number(draft.comments || 0);
                const engagementRate =
                  views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0;

                return (
                  <article className="queue-item queue-item-stacked" key={campaign.id}>
                    <div>
                      <span className="queue-icon">
                        <FileVideo size={18} />
                      </span>
                      <div>
                        <h3>{campaign.title}</h3>
                        <p>
                          {campaign.creatorHandle} · {currency(campaign.paidAmount)} paid
                        </p>
                      </div>
                    </div>

                    <div className="campaign-inline-status">
                      <strong>{campaign.status}</strong>
                      <span>{campaign.paymentStatus}</span>
                    </div>

                    <div className="campaign-edit-grid">
                      <label>
                        TikTok Post ID
                        <input
                          value={draft.tiktokPostId}
                          onChange={(event) =>
                            setCampaignDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...draft,
                                tiktokPostId: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Views
                        <input
                          inputMode="numeric"
                          value={draft.views}
                          onChange={(event) =>
                            setCampaignDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...draft,
                                views: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Likes
                        <input
                          inputMode="numeric"
                          value={draft.likes}
                          onChange={(event) =>
                            setCampaignDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...draft,
                                likes: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Comments
                        <input
                          inputMode="numeric"
                          value={draft.comments}
                          onChange={(event) =>
                            setCampaignDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...draft,
                                comments: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="campaign-edit-wide">
                        Update Note
                        <input
                          value={draft.publishMessage}
                          onChange={(event) =>
                            setCampaignDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...draft,
                                publishMessage: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="campaign-inline-status">
                      <strong>{campaign.postedOn || "Not posted yet"}</strong>
                      <span>
                        {engagementRate > 0 ? `${percent(engagementRate)} est. engagement` : "Performance pending"}
                      </span>
                    </div>

                    <div className="queue-actions">
                      {campaign.videoStoragePath ? (
                        <button type="button" onClick={() => void openCampaignVideo(campaign)}>
                          <ExternalLink size={16} />
                          View Video
                        </button>
                      ) : null}
                      {campaign.status === "Creator Approval" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void updateCampaign(campaign.id, {
                              status: "Posted",
                              postedOn: todayLabel(),
                              tiktokPostId: draft.tiktokPostId,
                              publishMessage: draft.publishMessage,
                              views,
                              likes,
                              comments,
                              engagementRate,
                            })
                          }
                          disabled={savingCampaignId === campaign.id}
                        >
                          <Send size={16} />
                          {savingCampaignId === campaign.id ? "Saving..." : "Mark Posted"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void updateCampaign(campaign.id, {
                            views,
                            likes,
                            comments,
                            engagementRate,
                            tiktokPostId: draft.tiktokPostId,
                            publishMessage: draft.publishMessage,
                          })
                        }
                        disabled={savingCampaignId === campaign.id}
                      >
                        <BarChart3 size={16} />
                        Update Metrics
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
