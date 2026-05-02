"use client";

import {
  BarChart3,
  Check,
  Clock3,
  Download,
  FileVideo,
  LayoutDashboard,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  displayName: string;
  price: string;
  deliveryDays: string;
  niche: string;
  audience: string;
  tags: string;
  contentNotes: string;
  followers: string;
  avgViews: string;
  avgLikes: string;
  avgComments: string;
};

type CampaignDraft = {
  views: string;
  likes: string;
  comments: string;
  tiktokPostId: string;
  publishMessage: string;
};

type NewPageDraft = {
  handle: string;
  displayName: string;
  price: string;
  followers: string;
  avgViews: string;
  avgLikes: string;
  avgComments: string;
};

function getInitials(email: string) {
  const [name] = email.split("@");
  return name.slice(0, 2).toUpperCase() || "CR";
}

function createPageDraft(page: TikTokPage): PageDraft {
  return {
    displayName: page.displayName,
    price: String(page.price || 0),
    deliveryDays: String(page.deliveryDays || 3),
    niche: page.niche || "Rental Listings",
    audience: page.audience || "",
    tags: page.tags.join(", "),
    contentNotes: page.contentNotes.join(", "),
    followers: String(page.followers || 0),
    avgViews: String(page.avgViews || 0),
    avgLikes: String(page.avgLikes || 0),
    avgComments: String(page.avgComments || 0),
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

const emptyNewPageDraft: NewPageDraft = {
  handle: "@xeinstrentalsnyc",
  displayName: "",
  price: "",
  followers: "",
  avgViews: "",
  avgLikes: "",
  avgComments: "",
};

export function CreatorPortal({ user }: CreatorPortalProps) {
  const [pages, setPages] = useState<TikTokPage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [newPage, setNewPage] = useState<NewPageDraft>(emptyNewPageDraft);
  const [listingBusy, setListingBusy] = useState(false);
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
    if (!selectedPageId && pages[0]) {
      setSelectedPageId(pages[0].id);
    }

    setPageDrafts((current) => {
      const next = { ...current };
      for (const page of pages) {
        next[page.id] = next[page.id] ?? createPageDraft(page);
      }
      return next;
    });

    setCampaignDrafts((current) => {
      const next = { ...current };
      for (const campaign of campaigns) {
        next[campaign.id] = next[campaign.id] ?? createCampaignDraft(campaign);
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

  async function createPageListing() {
    setListingBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/creator/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: newPage.handle,
          displayName: newPage.displayName,
          price: Number(newPage.price || 0),
          followers: Number(newPage.followers || 0),
          avgViews: Number(newPage.avgViews || 0),
          avgLikes: Number(newPage.avgLikes || 0),
          avgComments: Number(newPage.avgComments || 0),
        }),
      });
      const payload = (await response.json()) as {
        page?: TikTokPage;
        message?: string;
        note?: string;
      };

      if (!response.ok || !payload.page) {
        throw new Error(payload.message || "Could not list creator page.");
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
      setNewPage(emptyNewPageDraft);
      setMessage(payload.note || `${payload.page.handle} is now listed for agents.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not list creator page.");
    } finally {
      setListingBusy(false);
    }
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
          displayName: draft.displayName,
          price: Number(draft.price || 0),
          deliveryDays: Number(draft.deliveryDays || 3),
          niche: draft.niche,
          audience: draft.audience,
          tags: draft.tags,
          contentNotes: draft.contentNotes,
          followers: Number(draft.followers || 0),
          avgViews: Number(draft.avgViews || 0),
          avgLikes: Number(draft.avgLikes || 0),
          avgComments: Number(draft.avgComments || 0),
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

  function updatePageDraft(pageId: string, field: keyof PageDraft, value: string) {
    setPageDrafts((current) => ({
      ...current,
      [pageId]: {
        ...current[pageId],
        [field]: value,
      },
    }));
  }

  function updateCampaignDraft(
    campaignId: string,
    field: keyof CampaignDraft,
    value: string,
  ) {
    setCampaignDrafts((current) => ({
      ...current,
      [campaignId]: {
        ...current[campaignId],
        [field]: value,
      },
    }));
  }

  async function downloadCampaignVideo(campaign: Campaign) {
    if (!campaign.videoStoragePath) {
      setMessage("No video is attached to this campaign yet.");
      return;
    }

    window.open(
      `/api/uploads/video-file?path=${encodeURIComponent(campaign.videoStoragePath)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
          <span>Listed Creator Pages</span>
          <strong>{pages.length}/{MAX_CREATOR_ACCOUNTS}</strong>
          <button type="button" onClick={() => void createPageListing()} disabled={listingBusy}>
            {listingBusy ? "Listing..." : "Add Page"}
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
            void createPageListing();
          }}
        >
          <div className="form-heading">
            <strong>List Your Page</strong>
            <Sparkles size={16} />
          </div>
          <p className="form-note">
            Manual mode for now: claim your TikTok handle here, set your price, and
            download each listing video from your creator queue.
          </p>
          <label>
            TikTok Handle
            <input
              value={newPage.handle}
              onChange={(event) =>
                setNewPage((current) => ({ ...current, handle: event.target.value }))
              }
              placeholder="@xeinstrentalsnyc"
            />
          </label>
          <label>
            Page Name
            <input
              value={newPage.displayName}
              onChange={(event) =>
                setNewPage((current) => ({ ...current, displayName: event.target.value }))
              }
              placeholder="Xeinst Rentals NYC"
            />
          </label>
          <label>
            Post Price
            <input
              inputMode="numeric"
              value={newPage.price}
              onChange={(event) =>
                setNewPage((current) => ({ ...current, price: event.target.value }))
              }
              placeholder="250"
            />
          </label>
          <div className="compact-form">
            <label>
              Followers
              <input
                inputMode="numeric"
                value={newPage.followers}
                onChange={(event) =>
                  setNewPage((current) => ({ ...current, followers: event.target.value }))
                }
                placeholder="12000"
              />
            </label>
            <label>
              Avg. Views
              <input
                inputMode="numeric"
                value={newPage.avgViews}
                onChange={(event) =>
                  setNewPage((current) => ({ ...current, avgViews: event.target.value }))
                }
                placeholder="4800"
              />
            </label>
            <label>
              Avg. Likes
              <input
                inputMode="numeric"
                value={newPage.avgLikes}
                onChange={(event) =>
                  setNewPage((current) => ({ ...current, avgLikes: event.target.value }))
                }
                placeholder="210"
              />
            </label>
            <label>
              Avg. Comments
              <input
                inputMode="numeric"
                value={newPage.avgComments}
                onChange={(event) =>
                  setNewPage((current) => ({ ...current, avgComments: event.target.value }))
                }
                placeholder="18"
              />
            </label>
          </div>
          <button disabled={listingBusy} type="submit">
            {listingBusy ? "Saving..." : "List Page"}
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
              <span>Listed Pages</span>
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
            <p className="eyebrow">
              No pages listed yet. Add your handle in the sidebar so agents can book
              you and send over listing videos.
            </p>
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
                        Page Name
                        <input
                          value={pageDrafts[selectedPage.id]?.displayName ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "displayName", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Post Price
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.price ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "price", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Delivery Days
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.deliveryDays ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "deliveryDays", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Followers
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.followers ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "followers", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Avg. Views
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.avgViews ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "avgViews", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Avg. Likes
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.avgLikes ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "avgLikes", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Avg. Comments
                        <input
                          inputMode="numeric"
                          value={pageDrafts[selectedPage.id]?.avgComments ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "avgComments", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Niche
                        <input
                          value={pageDrafts[selectedPage.id]?.niche ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "niche", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Audience
                        <input
                          value={pageDrafts[selectedPage.id]?.audience ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "audience", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={pageDrafts[selectedPage.id]?.tags ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "tags", event.target.value)
                          }
                        />
                      </label>
                      <label className="campaign-edit-wide">
                        Requirements
                        <input
                          value={pageDrafts[selectedPage.id]?.contentNotes ?? ""}
                          onChange={(event) =>
                            updatePageDraft(selectedPage.id, "contentNotes", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="full-panel nested-panel">
                    <div className="section-title compact-title">
                      <div>
                        <p className="eyebrow">Reported Stats</p>
                        <h1>{selectedPage.displayName}</h1>
                      </div>
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
                    <p className="form-note">
                      These are creator-reported page stats for now. The booking flow is
                      manual: agents upload the video here, then you download it and post
                      it on TikTok yourself.
                    </p>
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
            <p className="eyebrow">
              No campaign requests yet. Once agents book your page, you’ll download
              the video from here and post it manually.
            </p>
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
                            updateCampaignDraft(campaign.id, "tiktokPostId", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Views
                        <input
                          inputMode="numeric"
                          value={draft.views}
                          onChange={(event) =>
                            updateCampaignDraft(campaign.id, "views", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Likes
                        <input
                          inputMode="numeric"
                          value={draft.likes}
                          onChange={(event) =>
                            updateCampaignDraft(campaign.id, "likes", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Comments
                        <input
                          inputMode="numeric"
                          value={draft.comments}
                          onChange={(event) =>
                            updateCampaignDraft(campaign.id, "comments", event.target.value)
                          }
                        />
                      </label>
                      <label className="campaign-edit-wide">
                        Update Note
                        <input
                          value={draft.publishMessage}
                          onChange={(event) =>
                            updateCampaignDraft(campaign.id, "publishMessage", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div className="campaign-inline-status">
                      <strong>{campaign.postedOn || "Not posted yet"}</strong>
                      <span>
                        {engagementRate > 0
                          ? `${percent(engagementRate)} est. engagement`
                          : "Performance pending"}
                      </span>
                    </div>

                    <div className="queue-actions">
                      {campaign.videoStoragePath ? (
                        <button type="button" onClick={() => void downloadCampaignVideo(campaign)}>
                          <Download size={16} />
                          Download Video
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
