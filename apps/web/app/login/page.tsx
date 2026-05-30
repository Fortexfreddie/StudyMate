"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import { Checkbox } from "@/components/shared/Checkbox";
import { LoginIllustration } from "./components/LoginIllustration";
import { useAuth } from "@/components/providers/AuthProvider";
import { validateEmail, validatePassword } from "@/lib/validation";

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
    } catch {
      setErrors({ global: "Invalid email or password" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await login("student@futo.edu", "password123");
      router.push("/dashboard");
    } catch {
      setErrors({ global: "Google authentication failed" });
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

          {/* Divider */}
          <div className="flex items-center gap-3 w-full">
            <div className="h-[1px] flex-1 bg-border-subtle" />
            <span className="text-xs text-text-muted font-normal">
              or continue with
            </span>
            <div className="h-[1px] flex-1 bg-border-subtle" />
          </div>

          {/* Continue with Google */}
          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            icon={
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            }
          >
            Continue with Google
          </Button>
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
      </div>
    </main>
  );
}
