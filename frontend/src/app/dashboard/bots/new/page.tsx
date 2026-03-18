"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateBot } from "@/hooks/use-bots";
import { useXAccounts } from "@/hooks/use-x-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, X } from "lucide-react";
import Link from "next/link";

const TONE_OPTIONS = [
  "neutral",
  "professional",
  "casual",
  "humorous",
  "sarcastic",
  "informative",
  "inspirational",
];

const EVENT_SOURCES = ["crypto", "news", "tech", "sports", "finance"];

export default function NewBotPage() {
  const router = useRouter();
  const createBot = useCreateBot();
  const { data: xAccounts } = useXAccounts();

  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [tone, setTone] = useState("neutral");
  const [language, setLanguage] = useState("en");
  const [postingFrequency, setPostingFrequency] = useState(4);
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [eventSubscriptions, setEventSubscriptions] = useState<
    { source: string; category: string }[]
  >([]);
  const [eventSource, setEventSource] = useState("");
  const [eventCategory, setEventCategory] = useState("");
  const [xAccountId, setXAccountId] = useState("");

  function addTopic() {
    const trimmed = topicInput.trim();
    if (trimmed && !topics.includes(trimmed) && topics.length < 20) {
      setTopics([...topics, trimmed]);
      setTopicInput("");
    }
  }

  function removeTopic(topic: string) {
    setTopics(topics.filter((t) => t !== topic));
  }

  function addEventSubscription() {
    if (
      eventSource &&
      eventCategory &&
      eventSubscriptions.length < 20 &&
      !eventSubscriptions.some(
        (e) => e.source === eventSource && e.category === eventCategory,
      )
    ) {
      setEventSubscriptions([
        ...eventSubscriptions,
        { source: eventSource, category: eventCategory },
      ]);
      setEventSource("");
      setEventCategory("");
    }
  }

  function removeEventSubscription(index: number) {
    setEventSubscriptions(eventSubscriptions.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createBot.mutate(
      {
        name,
        persona: persona || undefined,
        tone,
        language,
        postingFrequency,
        topics: topics.length > 0 ? topics : undefined,
        eventSubscriptions:
          eventSubscriptions.length > 0 ? eventSubscriptions : undefined,
        xAccountId: xAccountId || undefined,
      },
      {
        onSuccess: () => router.push("/dashboard/bots"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/bots" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Bot</h1>
          <p className="text-muted-foreground">
            Configure your new AI Twitter bot.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Define the identity and behavior of your bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bot Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CryptoInsights Bot"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona">Persona</Label>
              <Textarea
                id="persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="Describe the bot's personality. e.g., A knowledgeable crypto analyst who shares market insights with a balanced perspective..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This acts as the system prompt for AI content generation.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v ?? "neutral")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v ?? "en")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Posts/Day</Label>
                <Input
                  id="frequency"
                  type="number"
                  min={1}
                  max={100}
                  value={postingFrequency}
                  onChange={(e) =>
                    setPostingFrequency(parseInt(e.target.value) || 4)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Topics */}
        <Card>
          <CardHeader>
            <CardTitle>Content Topics</CardTitle>
            <CardDescription>
              Add topics your bot should generate content about (max 20).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g., Bitcoin, DeFi, NFTs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addTopic}
                disabled={topics.length >= 20}
              >
                Add
              </Button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <Badge key={topic} variant="secondary" className="gap-1 pr-1">
                    {topic}
                    <button
                      type="button"
                      onClick={() => removeTopic(topic)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Event Subscriptions</CardTitle>
            <CardDescription>
              Subscribe to event sources to trigger AI-generated tweets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={eventSource} onValueChange={(v) => setEventSource(v ?? "")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                placeholder="Category (e.g., price_alert)"
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addEventSubscription}
                disabled={
                  !eventSource ||
                  !eventCategory ||
                  eventSubscriptions.length >= 20
                }
              >
                Add
              </Button>
            </div>
            {eventSubscriptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {eventSubscriptions.map((sub, i) => (
                  <Badge key={i} variant="outline" className="gap-1 pr-1">
                    {sub.source}:{sub.category}
                    <button
                      type="button"
                      onClick={() => removeEventSubscription(i)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* X Account */}
        <Card>
          <CardHeader>
            <CardTitle>X Account</CardTitle>
            <CardDescription>
              Select which X account this bot posts from.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {xAccounts && xAccounts.length > 0 ? (
              <Select
                value={xAccountId}
                onValueChange={(v) => setXAccountId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an X account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {xAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      @{acc.xUsername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No X accounts connected.{" "}
                <Link
                  href="/dashboard/settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Connect one in Settings
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" render={<Link href="/dashboard/bots" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={createBot.isPending || !name.trim()}>
            {createBot.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Bot
          </Button>
        </div>
      </form>
    </div>
  );
}
