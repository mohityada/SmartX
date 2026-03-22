"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Invalid verification link — no token found.",
  );

  useEffect(() => {
    if (!token) return;

    authApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Verification failed. The link may have expired.",
        );
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            SX
          </div>
          {status === "loading" && (
            <>
              <CardTitle className="text-2xl">Verifying email...</CardTitle>
              <CardDescription>Please wait a moment</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mt-2" />
              <CardTitle className="text-2xl">Email verified!</CardTitle>
              <CardDescription>
                Your email has been confirmed. You can now use all SmartX
                features.
              </CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive mt-2" />
              <CardTitle className="text-2xl">Verification failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          {status === "loading" && (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <Button className="w-full" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          )}
          {status === "error" && (
            <>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard/settings")}
              >
                Resend verification email
              </Button>
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Back to sign in
              </Link>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
