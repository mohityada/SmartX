"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBot, useUpdateBot, useToggleBot, useBotActivity } from "@/hooks/use-bots";
import { useXAccounts } from "@/hooks/use-x-accounts";
import type { Bot, BotActivityLog, XAccountWithCount } from "@/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, X, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const TONE_OPTIONS = [
  "neutral",
  "professional",
  "casual",
  "humorous",
  "sarcastic",
  "informative",
  "inspirational",
];

function BotEditForm({
  bot,
  activityLogs,
  xAccounts,
}: {
  bot: Bot;
  activityLogs?: BotActivityLog[];
  xAccounts?: XAccountWithCount[];
}) {
  const router = useRouter();
  const updateBot = useUpdateBot(bot.id);
  const toggleBot = useToggleBot();

  const [name, setName] = useState(bot.name);
  const [persona, setPersona] = useState(bot.persona ?? "");
  const [tone, setTone] = useState(bot.tone);
  const [language, setLanguage] = useState(bot.language);
  const [postingFrequency, setPostingFrequency] = useState(bot.postingFrequency);
  const [scheduleStartHour, setScheduleStartHour] = useState(bot.scheduleStartHour ?? 8);
  const [scheduleEndHour, setScheduleEndHour] = useState(bot.scheduleEndHour ?? 23);
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>(bot.topics.map((t) => t.topic));
  const [xAccountId, setXAccountId] = useState<string>(bot.xAccountId ?? "");

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateBot.mutate(
      {
        name,
        persona: persona || undefined,
        tone,
        language,
        postingFrequency,
        scheduleStartHour,
        scheduleEndHour,
        topics,
        xAccountId: xAccountId || undefined,
      },
      {
        onSuccess: () => toast.success("Bot updated"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/bots" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{bot.name}</h1>
            <p className="text-muted-foreground">
              Created{" "}
              {formatDistanceToNow(new Date(bot.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {bot.isActive ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={bot.isActive}
            onCheckedChange={() =>
              toggleBot.mutate({ id: bot.id, isActive: bot.isActive })
            }
            disabled={toggleBot.isPending}
          />
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-4">
          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bot Configuration</CardTitle>
                <CardDescription>
                  Update your bot&apos;s settings and behavior.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Bot Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    rows={4}
                    placeholder="Describe the bot's personality..."
                  />
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startHour">Schedule Start Hour (UTC)</Label>
                    <Input
                      id="startHour"
                      type="number"
                      min={0}
                      max={23}
                      value={scheduleStartHour}
                      onChange={(e) =>
                        setScheduleStartHour(parseInt(e.target.value) || 0)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Earliest hour the bot will post (0-23)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endHour">Schedule End Hour (UTC)</Label>
                    <Input
                      id="endHour"
                      type="number"
                      min={1}
                      max={24}
                      value={scheduleEndHour}
                      onChange={(e) =>
                        setScheduleEndHour(parseInt(e.target.value) || 23)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Latest hour the bot will post (1-24)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Topics</CardTitle>
                <CardDescription>
                  Content topics for AI generation (max 20).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="Add a topic..."
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
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
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

            {/* X Account Linking */}
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
                      <SelectValue placeholder="Select an X account" />
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

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => router.push("/dashboard/bots")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateBot.isPending || !name.trim()}
              >
                {updateBot.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent bot actions and events</CardDescription>
            </CardHeader>
            <CardContent>
              {!activityLogs?.length ? (
                <p className="text-sm text-muted-foreground py-4">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.action}</p>
                        {log.metadata && (
                          <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.id as string;

  const { data: bot, isLoading } = useBot(botId);
  const { data: activityLogs } = useBotActivity(botId);
  const { data: xAccounts } = useXAccounts();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Bot not found</p>
        <Button variant="outline" className="mt-4" render={<Link href="/dashboard/bots" />}>
          Back to Bots
        </Button>
      </div>
    );
  }

  return (
    <BotEditForm
      key={bot.id}
      bot={bot}
      activityLogs={activityLogs}
      xAccounts={xAccounts}
    />
  );
}
