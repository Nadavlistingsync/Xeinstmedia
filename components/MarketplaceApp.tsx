"use client";
import {
  BarChart3,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  Eye,
  FileVideo,
  Filter,
  Home,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  MoreVertical,
  PlaySquare,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { compactNumber, currency, percent, todayLabel } from "@/lib/format";
import { MAX_CREATOR_ACCOUNTS } from "@/lib/limits";
import type { Campaign, CampaignStatus, TikTokPage } from "@/lib/types";

type AppView = "marketplace" | "campaigns" | "creator";
type BookingStep = "details" | "upload" | "review";

const navItems = [
  { id: "marketplace", label: "Marketplace", icon: Home },
  { id: "campaigns", label: "My Campaigns", icon: LayoutDashboard },
  { id: "creator", label: "Creator Queue", icon: Inbox },
] as const;

const secondaryNav = [
  { label: "Messages", icon: MessageCircle },
  { label: "Payments", icon: WalletCards },
  { label: "Saved Pages", icon: Bookmark },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

const statusOrder: CampaignStatus[] = [
  "Video Upload",
  "Creator Approval",
  "Posted",
  "Completed",
];

function buildPath(data: number[], width = 316, height = 150) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const spread = max - min || 1;
  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / spread) * (height - 18) - 9;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function PageAvatar({ page, size = "md" }: { page: TikTokPage; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`page-avatar ${size}`} aria-hidden="true">
      <span>{page.avatarLabel}</span>
      <small>Rentals</small>
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`status-badge ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function getUserInitials(email: string) {
  const [name] = email.split("@");
  const segments = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "");

  return segments.join("") || name.slice(0, 2).toUpperCase() || "RT";
}

type MarketplaceAppProps = {
  user: {
    id: string;
    email: string;
  };
};

export function MarketplaceApp({ user }: MarketplaceAppProps) {
  const [pages, setPages] = useState<TikTokPage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [dataMessage, setDataMessage] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>("details");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [agentEmail, setAgentEmail] = useState(user.email);
  const [videoName, setVideoName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const selectedPage = pages.find((page) => page.id === selectedId) ?? pages[0] ?? null;

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setDataMessage("");

      try {
        const [pagesResponse, campaignsResponse] = await Promise.all([
          fetch("/api/pages"),
          fetch("/api/campaigns"),
        ]);

        const pagesPayload = (await pagesResponse.json()) as {
          pages?: TikTokPage[];
          message?: string;
        };
        const campaignsPayload = (await campaignsResponse.json()) as {
          campaigns?: Campaign[];
          message?: string;
        };

        if (!pagesResponse.ok || !campaignsResponse.ok) {
          throw new Error(
            pagesPayload.message ||
              campaignsPayload.message ||
              "Could not load Supabase data.",
          );
        }

        const nextPages = pagesPayload.pages ?? [];
        setPages(nextPages);
        setCampaigns(campaignsPayload.campaigns ?? []);
        setSelectedId(nextPages[0]?.id ?? "");

        if (nextPages.length === 0) {
          setDataMessage(
            "No TikTok pages found in Supabase yet. Add records to tiktok_pages to populate the marketplace.",
          );
        }
      } catch (error) {
        setDataMessage(
          error instanceof Error
            ? error.message
            : "Could not connect to Supabase.",
        );
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, []);

  const filteredPages = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return pages
      .filter((page) => {
        if (savedOnly && !page.saved) {
          return false;
        }

        if (!normalized) {
          return true;
        }

        return [
          page.handle,
          page.displayName,
          page.market,
          page.niche,
          ...page.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => b.engagementRate - a.engagementRate);
  }, [pages, query, savedOnly]);

  async function toggleSaved(pageId: string) {
    const current = pages.find((page) => page.id === pageId);
    if (!current) return;

    try {
      const response = await fetch("/api/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pageId,
          saved: !current.saved,
        }),
      });
      const payload = (await response.json()) as { page?: TikTokPage; message?: string };
      if (!response.ok || !payload.page) {
        throw new Error(payload.message || "Could not update saved state.");
      }

      setPages((items) =>
        items.map((item) => (item.id === pageId ? payload.page! : item)),
      );
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : "Could not update page.");
    }
  }

  function startUploadFlow() {
    if (!selectedPage) {
      return;
    }

    if (!campaignTitle.trim()) {
      setBookingError("Add a listing title before continuing.");
      return;
    }

    if (!agentEmail.trim()) {
      setBookingError("Agent email is required.");
      return;
    }

    setBookingError("");
    setBookingStep("upload");
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setVideoName(file.name);
      setVideoFile(file);
    } else {
      setVideoName("");
      setVideoFile(null);
    }
  }

  async function sendCampaignToCreator() {
    if (!selectedPage || !videoFile) {
      setBookingError("Upload the listing video before sending the campaign.");
      return;
    }

    setBookingBusy(true);
    setBookingError("");

    try {
      const formData = new FormData();
      formData.set("file", videoFile);
      const uploadResponse = await fetch("/api/uploads/video", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = (await uploadResponse.json()) as {
        storagePath?: string;
        fileName?: string;
        fileSize?: number;
        message?: string;
      };

      if (!uploadResponse.ok || !uploadPayload.storagePath || !uploadPayload.fileName) {
        throw new Error(uploadPayload.message || "Could not upload listing video.");
      }

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campaignTitle.trim(),
          pageId: selectedPage.id,
          status: "Creator Approval",
          paymentStatus: "Paid",
          paidAmount: 0,
          videoName: uploadPayload.fileName,
          videoStoragePath: uploadPayload.storagePath,
          videoDuration: "0:30",
        }),
      });
      const payload = (await response.json()) as {
        campaign?: Campaign;
        message?: string;
      };
      if (!response.ok || !payload.campaign) {
        throw new Error(payload.message || "Could not create campaign.");
      }

      setCampaigns((current) => [payload.campaign!, ...current]);
      setBookingStep("review");
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : "Could not create campaign.",
      );
    } finally {
      setBookingBusy(false);
    }
  }

  function closeBooking() {
    setBookingOpen(false);
    setBookingStep("details");
    setVideoName("");
    setVideoFile(null);
    setBookingError("");
  }

  function markPosted(campaignId: string) {
    void (async () => {
      try {
        const response = await fetch("/api/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: campaignId,
            status: "Posted",
            postedOn: todayLabel(),
          }),
        });
        const payload = (await response.json()) as {
          campaign?: Campaign;
          message?: string;
        };
        if (!response.ok || !payload.campaign) {
          throw new Error(payload.message || "Could not mark campaign posted.");
        }

        setCampaigns((current) =>
          current.map((campaign) =>
            campaign.id === campaignId ? payload.campaign! : campaign,
          ),
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error ? error.message : "Could not update campaign.",
        );
      }
    })();
  }

  function releaseCampaign(campaignId: string) {
    void (async () => {
      try {
        const response = await fetch("/api/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: campaignId,
            status: "Completed",
          }),
        });
        const payload = (await response.json()) as {
          campaign?: Campaign;
          message?: string;
        };
        if (!response.ok || !payload.campaign) {
          throw new Error(payload.message || "Could not release campaign.");
        }

        setCampaigns((current) =>
          current.map((campaign) =>
            campaign.id === campaignId ? payload.campaign! : campaign,
          ),
        );
      } catch (error) {
        setDataMessage(
          error instanceof Error ? error.message : "Could not update campaign.",
        );
      }
    })();
  }

  async function openCampaignVideo(campaign: Campaign) {
    if (!campaign.videoStoragePath) {
      setDataMessage("No video is attached to this campaign yet.");
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
      setDataMessage(
        error instanceof Error ? error.message : "Could not open campaign video.",
      );
    }
  }

  return (
    <main className="app-shell campaign-only-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RT</div>
          <div>
            <strong>RentTok</strong>
            <span>Agent Dashboard</span>
          </div>
        </div>

        <div className="wallet-panel">
          <span>Active Campaigns</span>
          <strong>{campaigns.length}</strong>
          <button type="button" onClick={() => setBookingOpen(true)}>
            New Campaign
          </button>
        </div>

        <div className="agent-card">
          <div className="agent-photo" aria-hidden="true" />
          <div>
            <strong>{user.email}</strong>
            <span>Signed-in account</span>
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

        <div className="creator-onboard">
          <div className="form-heading">
            <strong>Available Creator Pages</strong>
            <Sparkles size={16} />
          </div>
          <p className="form-note">Creators manage their own TikTok pages. Agents book from the active listings below.</p>
          <div className="page-list-compact">
            {filteredPages.slice(0, 5).map((page) => (
              <button
                key={page.id}
                type="button"
                className={selectedId === page.id ? "compact-page-row active" : "compact-page-row"}
                onClick={() => setSelectedId(page.id)}
              >
                <span>
                  <strong>{page.handle}</strong>
                  <small>{compactNumber(page.followers)} followers</small>
                </span>
                <em>{currency(page.price)}</em>
              </button>
            ))}
          </div>
          {filteredPages.length === 0 ? <p>No creator pages are live yet.</p> : null}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Agent Workspace</p>
            <h1>My Campaigns Dashboard</h1>
          </div>
          <div className="account-actions">
            <div className="user-pill">
              <span>{getUserInitials(user.email)}</span>
              {user.email}
            </div>
          </div>
        </header>

        {loadingData ? <p className="eyebrow">Loading Supabase data...</p> : null}
        {!loadingData && dataMessage ? <p className="eyebrow">{dataMessage}</p> : null}

        <section className="full-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Booking</p>
              <h1>New Campaign</h1>
            </div>
            {!bookingOpen ? (
              <button
                onClick={() => {
                  setBookingOpen(true);
                  setBookingStep("details");
                  if (!campaignTitle.trim() && selectedPage) {
                    setCampaignTitle(`${selectedPage.displayName} Listing`);
                  }
                }}
                type="button"
              >
                <Plus size={17} />
                Start Booking
              </button>
            ) : null}
          </div>

          {!bookingOpen ? (
            <p className="eyebrow">
              Start a booking to upload a listing video and send it directly to a creator.
            </p>
          ) : (
            <>
              <div className="booking-form">
                <label>
                  Creator page
                  <select
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {filteredPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.handle} · {currency(page.price)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <BookingPanel
                agentEmail={agentEmail}
                bookingBusy={bookingBusy}
                bookingError={bookingError}
                bookingStep={bookingStep}
                campaignTitle={campaignTitle}
                page={selectedPage}
                videoName={videoName}
                onAgentEmailChange={setAgentEmail}
                onCampaignTitleChange={setCampaignTitle}
                onContinue={startUploadFlow}
                onClose={closeBooking}
                onSendCampaign={sendCampaignToCreator}
                onVideoChange={handleVideoChange}
              />
            </>
          )}
        </section>

        <CampaignsView
          campaigns={campaigns}
          pages={pages}
          onMarkPosted={markPosted}
          onRelease={releaseCampaign}
          onOpenVideo={openCampaignVideo}
        />
      </section>
    </main>
  );
}

function MarketplaceView({
  filteredPages,
  selectedPage,
  campaigns,
  onSelectPage,
  onToggleSaved,
  onOpenBooking,
  onOpenVideo,
}: {
  filteredPages: TikTokPage[];
  selectedPage: TikTokPage | null;
  campaigns: Campaign[];
  onSelectPage: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onOpenBooking: () => void;
  onOpenVideo: (campaign: Campaign) => void;
}) {
  return (
    <div className="market-layout">
      <section className="creator-table">
        <div className="table-head">
          <span>TikTok Page</span>
          <span>Followers</span>
          <span>Avg. Views</span>
          <span>Eng. Rate</span>
          <span>Niche</span>
          <span>Market</span>
          <span>
            Price
            <ChevronsUpDown size={14} />
          </span>
        </div>
        <div className="table-body">
          {filteredPages.map((page) => (
            <article
              className={page.id === selectedPage?.id ? "creator-row selected" : "creator-row"}
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPage(page.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="creator-cell">
                <PageAvatar page={page} />
                <span>
                  <strong>{page.handle}</strong>
                  <small>{page.displayName}</small>
                  {page.topPerformer ? <em>Top Performer</em> : null}
                </span>
              </span>
              <span>{compactNumber(page.followers)}</span>
              <span>{compactNumber(page.avgViews)}</span>
              <span>{percent(page.engagementRate)}</span>
              <span>
                <mark>{page.niche}</mark>
              </span>
              <span>{page.market}</span>
              <span className="price-cell">
                {currency(page.price)}
                <button
                  aria-label={page.saved ? "Remove saved page" : "Save page"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleSaved(page.id);
                  }}
                  type="button"
                >
                  {page.saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                </button>
              </span>
            </article>
          ))}
        </div>
        {filteredPages.length === 0 ? (
          <footer className="table-footer">
            <span>No creator pages in Supabase yet.</span>
            <div />
          </footer>
        ) : null}
        {filteredPages.length > 0 ? (
          <footer className="table-footer">
            <span>Showing 1-{filteredPages.length} of {filteredPages.length} results</span>
            <div>
              <button type="button">1</button>
            </div>
          </footer>
        ) : null}
      </section>

      <section className="campaign-preview">
        <div className="section-title">
          <div>
            <p className="eyebrow">Agent dashboard</p>
            <h1>My Campaigns</h1>
          </div>
          <button onClick={onOpenBooking} type="button">
            <Plus size={17} />
            New Booking
          </button>
        </div>
        <CampaignPipeline campaigns={campaigns} />
        <CampaignTable
          campaigns={campaigns.slice(0, 4)}
          compact
          onMarkPosted={() => undefined}
          onRelease={() => undefined}
          onOpenVideo={onOpenVideo}
        />
      </section>
    </div>
  );
}

function CampaignsView({
  campaigns,
  pages,
  onMarkPosted,
  onRelease,
  onOpenVideo,
}: {
  campaigns: Campaign[];
  pages: TikTokPage[];
  onMarkPosted: (campaignId: string) => void;
  onRelease: (campaignId: string) => void;
  onOpenVideo: (campaign: Campaign) => void;
}) {
  const totalViews = campaigns.reduce((total, campaign) => total + (campaign.views ?? 0), 0);
  const averageEngagement =
    campaigns
      .filter((campaign) => campaign.engagementRate)
      .reduce((total, campaign) => total + (campaign.engagementRate ?? 0), 0) /
    Math.max(1, campaigns.filter((campaign) => campaign.engagementRate).length);

  return (
    <section className="full-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Agent workspace</p>
          <h1>Campaign Dashboard</h1>
        </div>
        <button type="button">
          <SlidersHorizontal size={17} />
          Export
        </button>
      </div>
      <div className="dashboard-metrics">
        <Metric label="Total Views" value={compactNumber(totalViews)} />
        <Metric label="Active Pages" value={String(new Set(campaigns.map((campaign) => campaign.pageId)).size)} />
        <Metric label="Campaigns" value={String(campaigns.length)} />
        <Metric label="Avg. Engagement" value={percent(Number.isFinite(averageEngagement) ? averageEngagement : 0)} />
      </div>
      <CampaignPipeline campaigns={campaigns} />
      <CampaignTable
        campaigns={campaigns}
        onMarkPosted={onMarkPosted}
        onRelease={onRelease}
        onOpenVideo={onOpenVideo}
      />
      <div className="insight-strip">
        <Eye size={18} />
        <span>
          {pages[0]
            ? `Best current fit: ${pages[0].handle} is pacing above average for luxury rental videos in New York.`
            : "Connect at least one TikTok page to start campaign recommendations."}
        </span>
      </div>
    </section>
  );
}

function CreatorQueueView({
  campaigns,
  onMarkPosted,
  onRelease,
  onOpenVideo,
}: {
  campaigns: Campaign[];
  onMarkPosted: (campaignId: string) => void;
  onRelease: (campaignId: string) => void;
  onOpenVideo: (campaign: Campaign) => void;
}) {
  const queued = campaigns.filter((campaign) =>
    ["Creator Approval", "Posted"].includes(campaign.status),
  );

  return (
    <section className="full-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">TikTok owner view</p>
          <h1>Creator Queue</h1>
        </div>
        <button type="button">
          <Clock3 size={17} />
          SLA 2.8 days
        </button>
      </div>
      <div className="queue-list">
        {queued.map((campaign) => (
          <article className="queue-item" key={campaign.id}>
            <div>
              <span className="queue-icon">
                <FileVideo size={18} />
              </span>
              <div>
                <h3>{campaign.title}</h3>
                <p>{campaign.creatorHandle} · {currency(campaign.paidAmount)} paid</p>
              </div>
            </div>
            <StatusBadge status={campaign.status} />
            <div className="queue-actions">
              {campaign.videoStoragePath ? (
                <button onClick={() => onOpenVideo(campaign)} type="button">
                  <FileVideo size={16} />
                  View Video
                </button>
              ) : null}
              {campaign.status === "Creator Approval" ? (
                <button onClick={() => onMarkPosted(campaign.id)} type="button">
                  <Send size={16} />
                  Mark Posted
                </button>
              ) : null}
              {campaign.status === "Posted" ? (
                <button onClick={() => onRelease(campaign.id)} type="button">
                  <Check size={16} />
                  Mark Complete
                </button>
              ) : null}
              <button aria-label="More actions" type="button">
                <MoreVertical size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CampaignPipeline({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="pipeline">
      {statusOrder.map((status, index) => {
        const count = campaigns.filter((campaign) => campaign.status === status).length;
        const icons = [Upload, Inbox, PlaySquare, CheckCircle2];
        const Icon = icons[index];
        return (
          <div className="pipeline-step" key={status}>
            <span>
              <Icon size={18} />
            </span>
            <div>
              <strong>{status}</strong>
              <small>{count}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignTable({
  campaigns,
  compact,
  onMarkPosted,
  onRelease,
  onOpenVideo,
}: {
  campaigns: Campaign[];
  compact?: boolean;
  onMarkPosted: (campaignId: string) => void;
  onRelease: (campaignId: string) => void;
  onOpenVideo: (campaign: Campaign) => void;
}) {
  return (
    <div className={compact ? "campaign-table compact" : "campaign-table"}>
      <div className="campaign-head">
        <span>Campaign</span>
        <span>Creator</span>
        <span>Status</span>
        <span>Video</span>
        <span>Posted On</span>
        <span>Views</span>
        <span>Likes</span>
        <span>Comments</span>
        <span>Eng. Rate</span>
        <span />
      </div>
      {campaigns.map((campaign) => (
        <div className="campaign-row" key={campaign.id}>
          <span>
            <strong>{campaign.title}</strong>
            <small>Campaign ID: {campaign.id}</small>
          </span>
          <span>
            <strong>{campaign.creatorHandle}</strong>
            <small>{campaign.creatorName}</small>
          </span>
          <span>
            <StatusBadge status={campaign.status} />
          </span>
          <span>
            {campaign.videoName ? (
              <button
                className="video-chip"
                type="button"
                onClick={() => onOpenVideo(campaign)}
                disabled={!campaign.videoStoragePath}
              >
                <FileVideo size={16} />
                {campaign.videoDuration ?? "0:30"}
              </button>
            ) : (
              "—"
            )}
          </span>
          <span>{campaign.postedOn ?? "—"}</span>
          <span>{campaign.views ? compactNumber(campaign.views) : "—"}</span>
          <span>{campaign.likes ? compactNumber(campaign.likes) : "—"}</span>
          <span>{campaign.comments ? compactNumber(campaign.comments) : "—"}</span>
          <span>{campaign.engagementRate ? percent(campaign.engagementRate) : "—"}</span>
          <span className="row-actions">
            {!compact && campaign.status === "Creator Approval" ? (
              <button onClick={() => onMarkPosted(campaign.id)} type="button">Post</button>
            ) : null}
            {!compact && campaign.status === "Posted" ? (
              <button onClick={() => onRelease(campaign.id)} type="button">Complete</button>
            ) : null}
            <button aria-label="More campaign actions" type="button">
              <MoreVertical size={16} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function BookingPanel({
  agentEmail,
  bookingBusy,
  bookingError,
  bookingStep,
  campaignTitle,
  page,
  videoName,
  onAgentEmailChange,
  onCampaignTitleChange,
  onContinue,
  onClose,
  onSendCampaign,
  onVideoChange,
}: {
  agentEmail: string;
  bookingBusy: boolean;
  bookingError: string;
  bookingStep: BookingStep;
  campaignTitle: string;
  page: TikTokPage | null;
  videoName: string;
  onAgentEmailChange: (value: string) => void;
  onCampaignTitleChange: (value: string) => void;
  onContinue: () => void;
  onClose: () => void;
  onSendCampaign: () => void | Promise<void>;
  onVideoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!page) {
    return (
      <div className="booking-panel">
        <div className="booking-head">
          <strong>Book creator post</strong>
        </div>
        <p className="error-text">Select a creator page from Supabase before starting the request.</p>
      </div>
    );
  }

  return (
    <div className="booking-panel">
      <div className="booking-head">
        <strong>Book creator post</strong>
        <button aria-label="Close booking" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>

      <div className="booking-steps">
        {(["details", "upload", "review"] as BookingStep[]).map((step, index) => (
          <span className={bookingStep === step ? "current" : ""} key={step}>
            {index + 1}
          </span>
        ))}
      </div>

      {bookingStep === "details" ? (
        <div className="booking-form">
          <label>
            Listing title
            <input
              value={campaignTitle}
              onChange={(event) => onCampaignTitleChange(event.target.value)}
              placeholder="Chelsea 1BR Walkthrough"
            />
          </label>
          <label>
            Agent email
            <input
              type="email"
              value={agentEmail}
              onChange={(event) => onAgentEmailChange(event.target.value)}
            />
          </label>
          <div className="booking-summary">
            <span>Creator</span>
            <strong>{page.handle}</strong>
            <span>Delivery</span>
            <strong>{page.deliveryDays}-{page.deliveryDays + 1} days</strong>
            <span>Workflow</span>
            <strong>Manual creator post</strong>
          </div>
          {bookingError ? <p className="error-text">{bookingError}</p> : null}
          <button className="primary-cta" disabled={bookingBusy} onClick={onContinue} type="button">
            <Upload size={18} />
            Continue to Upload
          </button>
        </div>
      ) : null}

      {bookingStep === "upload" ? (
        <div className="upload-step">
          <label className="upload-drop">
            <Upload size={22} />
            <strong>{videoName || "Upload listing video"}</strong>
            <span>MP4, MOV, or WebM. Creator downloads this from their dashboard.</span>
            <input accept="video/mp4,video/quicktime,video/webm" onChange={onVideoChange} type="file" />
          </label>
          {bookingError ? <p className="error-text">{bookingError}</p> : null}
          <button
            className="primary-cta"
            disabled={!videoName || bookingBusy}
            onClick={onSendCampaign}
            type="button"
          >
            <Send size={18} />
            {bookingBusy ? "Sending..." : "Send to Creator"}
          </button>
        </div>
      ) : null}

      {bookingStep === "review" ? (
        <div className="review-step">
          <CheckCircle2 size={24} />
          <strong>Campaign sent to creator</strong>
          <p>The agent dashboard now tracks approval, posting, views, likes, and comments.</p>
          <button className="secondary-cta" onClick={onClose} type="button">
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
