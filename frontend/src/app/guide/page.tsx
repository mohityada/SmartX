import Link from "next/link";
import {
  Bot,
  CalendarClock,
  ChevronRight,
  Key,
  LineChart,
  MessageSquareText,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { GuideHeaderActions, GuideCTAActions } from "./guide-header-actions";

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-24" />;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

const NAV_ITEMS = [
  { href: "#overview", label: "Overview" },
  { href: "#getting-started", label: "Getting Started" },
  { href: "#connect-x", label: "Connect X Account" },
  { href: "#create-bot", label: "Create a Bot" },
  { href: "#content-generation", label: "Content Generation" },
  { href: "#scheduling", label: "Scheduling" },
  { href: "#analytics", label: "Analytics" },
  { href: "#best-practices", label: "Best Practices" },
  { href: "#faq", label: "FAQ" },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              SX
            </span>
            <span className="text-lg font-semibold tracking-tight">
              SmartX
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <GuideHeaderActions />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        <div className="relative flex gap-10 py-12">
          {/* Sidebar Navigation */}
          <aside className="sticky top-28 hidden h-fit w-52 shrink-0 lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On this page
            </p>
            <nav className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1">
            {/* Hero */}
            <div className="mb-16">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Platform Guide
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                Everything you need to build, manage, and deploy AI-powered
                Twitter/X bots with SmartX. Follow this guide to go from
                sign-up to your first automated post.
              </p>
            </div>

            {/* Overview */}
            <SectionAnchor id="overview" />
            <section className="mb-16">
              <h2 className="text-2xl font-semibold tracking-tight">
                Overview
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                SmartX is a SaaS platform that lets you create intelligent
                Twitter/X bots powered by AI. Each bot monitors real-time
                events &mdash; trending topics, crypto prices, news, sports
                &mdash; and uses Claude AI to generate contextual, on-brand
                tweets that are automatically posted to your X account on a
                schedule you control.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Sparkles,
                    title: "AI-Powered Content",
                    desc: "Claude generates tweets tailored to your bot's persona, tone, and topic preferences.",
                  },
                  {
                    icon: CalendarClock,
                    title: "Smart Scheduling",
                    desc: "Configure posting intervals with built-in rate limiting to stay within X's API guidelines.",
                  },
                  {
                    icon: LineChart,
                    title: "Analytics Dashboard",
                    desc: "Track tweet performance, posting history, and bot activity from a unified dashboard.",
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-xl border bg-card p-5"
                  >
                    <feature.icon className="mb-3 h-5 w-5 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Getting Started */}
            <SectionAnchor id="getting-started" />
            <section className="mb-16">
              <h2 className="text-2xl font-semibold tracking-tight">
                Getting Started
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Set up your SmartX account in three simple steps.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex gap-4">
                  <StepNumber n={1} />
                  <div>
                    <h3 className="font-semibold">Create your account</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Visit the{" "}
                      <Link
                        href="/register"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        registration page
                      </Link>{" "}
                      and sign up with your email. Passwords must be at least 8
                      characters with a mix of uppercase, lowercase, digits, and
                      special characters.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <StepNumber n={2} />
                  <div>
                    <h3 className="font-semibold">Connect your X account</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Navigate to{" "}
                      <span className="font-medium text-foreground">
                        Settings
                      </span>{" "}
                      in the dashboard sidebar and authorize SmartX to post on
                      your behalf using X&apos;s OAuth 2.0 flow. Your tokens are
                      encrypted at rest.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <StepNumber n={3} />
                  <div>
                    <h3 className="font-semibold">Create your first bot</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Go to{" "}
                      <span className="font-medium text-foreground">
                        Bots &rarr; New Bot
                      </span>{" "}
                      and configure its name, persona, topics, and posting
                      schedule. Your bot will start generating content
                      immediately.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Connect X Account */}
            <SectionAnchor id="connect-x" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <Key className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Connect Your X Account
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    SmartX uses the official X (Twitter) OAuth 2.0 PKCE flow to
                    securely connect to your account. No passwords are stored
                    &mdash; only encrypted OAuth tokens.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-sm font-semibold">
                    Authorization Process
                  </h3>
                </div>
                <div className="space-y-4 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                  <div className="flex gap-3">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <p>
                      Open{" "}
                      <span className="font-medium text-foreground">
                        Dashboard &rarr; Settings
                      </span>{" "}
                      and click{" "}
                      <span className="font-medium text-foreground">
                        Connect X Account
                      </span>
                      .
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <p>
                      You will be redirected to X where you authorize SmartX to
                      read your profile and post tweets on your behalf.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <p>
                      After authorization, you are redirected back and your X
                      account appears as connected. You can revoke access at any
                      time from both SmartX and X&apos;s settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold text-foreground">
                    Security note:
                  </span>{" "}
                  <span className="text-muted-foreground">
                    All OAuth tokens are encrypted using AES-256-GCM before
                    storage. SmartX never has access to your X password.
                  </span>
                </p>
              </div>
            </section>

            {/* Create a Bot */}
            <SectionAnchor id="create-bot" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <Bot className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Create a Bot
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    Bots are the core of SmartX. Each bot has its own persona,
                    topics, tone, and posting schedule.
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <div className="rounded-xl border bg-card px-5 py-5">
                  <h3 className="text-sm font-semibold">Bot Configuration</h3>
                  <div className="mt-4 space-y-5">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        A descriptive name for your bot (e.g., &quot;Crypto
                        Market Watch&quot; or &quot;Tech News Daily&quot;). This
                        is for your reference only and is not visible publicly.
                      </p>
                    </div>
                    <div className="h-px bg-border" />
                    <div>
                      <p className="text-sm font-medium">Persona</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Define the character and voice of your bot. For example:
                        &quot;A concise, data-driven crypto analyst who focuses
                        on market trends and avoids hype.&quot; The AI uses this
                        to shape every generated tweet.
                      </p>
                    </div>
                    <div className="h-px bg-border" />
                    <div>
                      <p className="text-sm font-medium">Topics</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select the event categories your bot should monitor:
                        crypto prices, tech news, sports scores, RSS feeds, or
                        general trending topics. The bot only generates content
                        from events matching its topics.
                      </p>
                    </div>
                    <div className="h-px bg-border" />
                    <div>
                      <p className="text-sm font-medium">Tone</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose from Professional, Casual, Witty, Analytical, or
                        Enthusiastic. This controls the writing style of
                        generated tweets.
                      </p>
                    </div>
                    <div className="h-px bg-border" />
                    <div>
                      <p className="text-sm font-medium">Posting Schedule</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Set a cron-style interval for how often the bot should
                        post. The scheduler automatically queues tweets and
                        respects X&apos;s rate limits (17 tweets per 24 hours on the
                        free tier).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border bg-card px-5 py-4">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    After creating a bot, toggle it to{" "}
                    <span className="font-medium text-foreground">Active</span>{" "}
                    to start the automated pipeline: event ingestion, AI content
                    generation, and scheduled posting.
                  </p>
                </div>
              </div>
            </section>

            {/* Content Generation */}
            <SectionAnchor id="content-generation" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Content Generation
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    SmartX uses Claude AI to generate tweets that are
                    contextually relevant and on-brand for each bot.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border bg-card px-5 py-5">
                <h3 className="text-sm font-semibold">How It Works</h3>
                <ol className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      1
                    </span>
                    <p>
                      <span className="font-medium text-foreground">
                        Event Ingestion
                      </span>{" "}
                      &mdash; The platform continuously collects real-time events
                      from multiple sources (CoinGecko, RSS feeds, news APIs,
                      sports APIs) via background job queues.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      2
                    </span>
                    <p>
                      <span className="font-medium text-foreground">
                        AI Processing
                      </span>{" "}
                      &mdash; When the scheduler triggers, relevant events are
                      selected based on the bot&apos;s topic configuration. Claude
                      receives the event data along with the bot&apos;s persona and
                      tone to craft a tweet.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      3
                    </span>
                    <p>
                      <span className="font-medium text-foreground">
                        Content Filtering
                      </span>{" "}
                      &mdash; Generated content passes through a safety filter to
                      ensure compliance with X&apos;s terms of service before being
                      queued for posting.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      4
                    </span>
                    <p>
                      <span className="font-medium text-foreground">
                        Posting
                      </span>{" "}
                      &mdash; The tweet is published to X via the official API.
                      Success and failure statuses are tracked and visible in
                      your dashboard.
                    </p>
                  </li>
                </ol>
              </div>
            </section>

            {/* Scheduling */}
            <SectionAnchor id="scheduling" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Scheduling and Rate Limits
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    SmartX handles scheduling automatically with built-in
                    safeguards to keep your account safe.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-card px-5 py-5">
                  <h3 className="text-sm font-semibold">
                    Cron-based Scheduling
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Each bot runs on a configurable cron schedule. The default
                    interval posts roughly every 90 minutes, keeping your feed
                    active without overposting.
                  </p>
                </div>
                <div className="rounded-xl border bg-card px-5 py-5">
                  <h3 className="text-sm font-semibold">
                    Automatic Rate Limiting
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The platform enforces X&apos;s free-tier limit of 17 tweets per
                    24-hour window per account. Excess tweets are held in queue
                    and posted as capacity becomes available.
                  </p>
                </div>
                <div className="rounded-xl border bg-card px-5 py-5">
                  <h3 className="text-sm font-semibold">
                    Retry with Backoff
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    If a post fails due to a temporary X API error, the system
                    retries with exponential backoff (up to 3 attempts) before
                    marking the tweet as failed.
                  </p>
                </div>
                <div className="rounded-xl border bg-card px-5 py-5">
                  <h3 className="text-sm font-semibold">Queue Monitoring</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    All job queues (event ingestion, content generation, tweet
                    posting) are backed by Redis and BullMQ, providing reliable
                    processing and observability.
                  </p>
                </div>
              </div>
            </section>

            {/* Analytics */}
            <SectionAnchor id="analytics" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <LineChart className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Analytics
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    The analytics dashboard gives you a clear view of your
                    bot&apos;s performance and platform activity.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border bg-card px-5 py-5">
                <h3 className="text-sm font-semibold">Available Metrics</h3>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {[
                    {
                      label: "Total Tweets",
                      desc: "Count of all tweets posted across all bots.",
                    },
                    {
                      label: "Success Rate",
                      desc: "Percentage of tweets successfully posted vs. failed.",
                    },
                    {
                      label: "Active Bots",
                      desc: "Number of bots currently enabled and posting.",
                    },
                    {
                      label: "Posting History",
                      desc: "Chronological log of every tweet with status, content preview, and timestamps.",
                    },
                    {
                      label: "Event Volume",
                      desc: "Number of real-time events ingested per category over time.",
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="flex gap-3">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <p>
                        <span className="font-medium text-foreground">
                          {metric.label}
                        </span>{" "}
                        &mdash; {metric.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Best Practices */}
            <SectionAnchor id="best-practices" />
            <section className="mb-16">
              <div className="flex items-start gap-3">
                <Shield className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Best Practices
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    Follow these recommendations to get the most out of SmartX
                    while maintaining a healthy X account.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  {
                    title: "Write a detailed persona",
                    desc: "The more specific your bot's persona, the more consistent and engaging the AI-generated content will be. Include preferred vocabulary, topics to avoid, and the overall voice.",
                  },
                  {
                    title: "Start with a conservative schedule",
                    desc: "Begin with 8-10 tweets per day and increase gradually. This keeps your account in good standing and lets you evaluate content quality.",
                  },
                  {
                    title: "Review generated tweets regularly",
                    desc: "Check the Tweets page in your dashboard periodically. While the AI and content filter handle most cases, reviewing output helps you refine the persona over time.",
                  },
                  {
                    title: "Use focused topics",
                    desc: "Bots that cover 1-2 specific topics tend to produce better content than those covering everything. Create separate bots for different niches.",
                  },
                  {
                    title: "Monitor your analytics",
                    desc: "Use the analytics dashboard to identify which topics and tones perform best, then adjust your bot configuration accordingly.",
                  },
                  {
                    title: "Keep your X connection active",
                    desc: "OAuth tokens can expire. If you see posting failures, reconnect your X account from the Settings page.",
                  },
                ].map((practice) => (
                  <div
                    key={practice.title}
                    className="rounded-xl border bg-card px-5 py-4"
                  >
                    <p className="text-sm font-semibold">{practice.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {practice.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <SectionAnchor id="faq" />
            <section className="mb-16">
              <h2 className="text-2xl font-semibold tracking-tight">
                Frequently Asked Questions
              </h2>

              <div className="mt-6 space-y-4">
                {[
                  {
                    q: "How many bots can I create?",
                    a: "There is no hard limit on the number of bots. However, all bots share the same X account's rate limits, so plan your posting schedules accordingly.",
                  },
                  {
                    q: "Is my X account safe?",
                    a: "Yes. SmartX uses OAuth 2.0 with PKCE and stores all tokens encrypted with AES-256-GCM. The platform never accesses your X password. You can revoke access at any time.",
                  },
                  {
                    q: "What happens if the AI generates inappropriate content?",
                    a: "All generated tweets pass through a content safety filter before posting. The filter checks for harmful, misleading, or policy-violating content and blocks it automatically.",
                  },
                  {
                    q: "Can I edit a tweet before it posts?",
                    a: "Currently, tweets are generated and posted automatically. You can review posted tweets in the Tweets dashboard and adjust the bot's persona or tone to improve future output.",
                  },
                  {
                    q: "What event sources are supported?",
                    a: "SmartX ingests from CoinGecko (crypto prices), RSS feeds, news APIs, and sports APIs. Additional sources can be configured via environment variables.",
                  },
                  {
                    q: "What happens when I hit the rate limit?",
                    a: "The platform automatically queues excess tweets and posts them as capacity becomes available within the 24-hour window. No tweets are lost.",
                  },
                  {
                    q: "Can I use multiple X accounts?",
                    a: "Each SmartX user account connects to one X account. To manage multiple X accounts, create separate SmartX accounts.",
                  },
                ].map((faq) => (
                  <div
                    key={faq.q}
                    className="rounded-xl border bg-card px-5 py-4"
                  >
                    <p className="text-sm font-semibold">{faq.q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="mb-20 rounded-xl border bg-card px-8 py-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Ready to build your first bot?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Create a free account, connect your X profile, and have your
                first AI-powered tweet live in minutes.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <GuideCTAActions />
              </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 text-center text-sm text-muted-foreground">
              <p>SmartX &mdash; AI Twitter Bot Builder Platform</p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
