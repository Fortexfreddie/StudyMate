"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import { Checkbox } from "@/components/shared/Checkbox";
import { LoginIllustration } from "./components/LoginIllustration";
import { useAuth } from "@/components/providers/AuthProvider";
import { validateEmail, validatePassword } from "@/lib/validation";
import { ApiClientError } from "@/lib/api";

// Banner shown when the user landed on /login because their session ended. Reads
// `?reason=` set by AuthProvider's global auth-expired handler. Wrapped in
// Suspense by the parent since useSearchParams opts the route into CSR bailout.
function SessionNotice() {
  const params = useSearchParams();
  const reason = params.get("reason");
  if (reason !== "suspended" && reason !== "expired") return null;

  const message =
    reason === "suspended"
      ? "Your account has been suspended. Please contact support if you believe this is a mistake."
      : "Your session has expired. Please log in again.";

  return (
    <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3 leading-snug">
      {message}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    global?: string;
  }>({});
  
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const tempErrors: typeof errors = {};

    const emailErr = validateEmail(email);
    if (emailErr) tempErrors.email = emailErr;

    const passwordErr = validatePassword(password);
    if (passwordErr) tempErrors.password = passwordErr;

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.detail : "Invalid email or password";
      setErrors({ global: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-bg-main flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-[420px] flex flex-col items-center">

        {/* Responsive Custom SVG Illustration */}
        <div className="w-full flex justify-center mb-1 transition-transform duration-300 hover:scale-105">
          <LoginIllustration />
        </div>

        {/* Header Typography */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1.5">
            Welcome Back
          </h1>
          <p className="text-sm text-text-muted">
            Continue studying smarter with AI
          </p>
        </div>

        {/* Responsive Login Card */}
        <div className="w-full rounded-3xl bg-card-bg border border-border-subtle p-5 sm:p-6 md:p-8 shadow-xl shadow-black/50 flex flex-col gap-5">
          <Suspense fallback={null}>
            <SessionNotice />
          </Suspense>

          {errors.global && (
            <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3 leading-snug">
              {errors.global}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4.5 w-4.5" />}
              error={errors.email}
              disabled={isLoading}
              autoComplete="email"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4.5 w-4.5" />}
              error={errors.password}
              disabled={isLoading}
              autoComplete="current-password"
            />

            {/* Checkbox and Forgot Password Link */}
            <div className="flex items-center justify-between gap-4 w-full">
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
                label="Remember Me"
                className="w-auto"
              />
              <Link
                href="/forgot-password"
                className="text-xs text-brand-primary hover:underline font-normal whitespace-nowrap"
              >
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" loading={isLoading} className="mt-2 shadow-lg shadow-brand-primary/10">
              Login
            </Button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="mt-8 text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-brand-primary hover:underline font-semibold"
          >
            Sign Up
          </Link>
        </p>

        <p className="mt-4 text-[11px] text-text-muted text-center">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-brand-primary hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brand-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
