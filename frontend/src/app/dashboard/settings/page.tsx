"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { usersApi, xAccountsApi, authApi } from "@/lib/api";
import { useXAccounts, useDisconnectXAccount } from "@/hooks/use-x-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Twitter, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getStoredTokens } from "@/lib/api";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();

  const { data: xAccounts, isLoading: xAccountsLoading } = useXAccounts();
  const disconnectXAccount = useDisconnectXAccount();

  // Handle X OAuth callback redirect params
  useEffect(() => {
    const xAuth = searchParams.get("x_auth");
    const username = searchParams.get("username");
    const reason = searchParams.get("reason");

    if (xAuth === "success" && username) {
      toast.success(`Connected X account @${username}`);
      // Clean URL params
      window.history.replaceState({}, "", "/dashboard/settings");
    } else if (xAuth === "error") {
      toast.error(
        reason === "access_denied"
          ? "X authorization was cancelled"
          : "Failed to connect X account. Please try again.",
      );
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await usersApi.updateMe({
        displayName: displayName || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      setUser(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account profile and preferences.
        </p>
      </div>

      {/* Profile */}
      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user?.displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Direct link to an image file.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Email Verified
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={user?.emailVerified ? "default" : "secondary"}>
                {user?.emailVerified ? "Verified" : "Unverified"}
              </Badge>
              {!user?.emailVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await authApi.resendVerification();
                      toast.success("Verification email sent — check your inbox");
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to send verification email",
                      );
                    }
                  }}
                >
                  Resend
                </Button>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Account Created
            </span>
            <span className="text-sm">
              {user?.createdAt
                ? format(new Date(user.createdAt), "PP")
                : "—"}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">User ID</span>
            <code className="text-xs text-muted-foreground">
              {user?.id ?? "—"}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Connected X Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected X Accounts</CardTitle>
              <CardDescription>
                Link your X (Twitter) accounts to enable automated posting.
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                const tokens = getStoredTokens();
                if (!tokens?.accessToken) {
                  toast.error("Please log in first");
                  return;
                }
                // Redirect to backend OAuth endpoint with JWT token as query param
                // The authorize endpoint requires auth, so we open it with the token
                const authorizeUrl = xAccountsApi.getAuthorizeUrl();
                window.location.href = `${authorizeUrl}?access_token=${tokens.accessToken}`;
              }}
            >
              <Twitter className="mr-2 h-4 w-4" />
              Connect X Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {xAccountsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !xAccounts?.length ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Twitter className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No X accounts connected yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect an account to start posting tweets from your bots.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {xAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-medium text-sm">
                      @
                    </div>
                    <div>
                      <p className="font-medium">@{account.xUsername}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {account._count.bots} bot{account._count.bots !== 1 ? "s" : ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Connected {format(new Date(account.createdAt), "PP")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        window.open(
                          `https://x.com/${account.xUsername}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => disconnectXAccount.mutate(account.id)}
                      disabled={disconnectXAccount.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
