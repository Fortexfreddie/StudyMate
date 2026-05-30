"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import { Checkbox } from "@/components/shared/Checkbox";
import { SignupIllustration } from "./components/SignupIllustration";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  validateEmail,
  validatePassword,
  validateFullName,
  validateConfirmPassword,
} from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
    global?: string;
  }>({});
  
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const tempErrors: typeof errors = {};
    
    const fullNameErr = validateFullName(fullName);
    if (fullNameErr) tempErrors.fullName = fullNameErr;

    const emailErr = validateEmail(email);
    if (emailErr) tempErrors.email = emailErr;

    const passwordErr = validatePassword(password);
    if (passwordErr) tempErrors.password = passwordErr;

    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) tempErrors.confirmPassword = confirmErr;

    if (!agreeTerms) {
      tempErrors.agreeTerms = "You must agree to the Terms and Privacy Policy";
    }

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
      await signup(email, password, fullName);
      router.push("/dashboard");
    } catch {
      setErrors({ global: "Registration failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signup("student@futo.edu", "password123", "Esther");
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
        
        {/* Header Back Button */}
        <div className="w-full flex justify-start mb-2">
          <Link
            href="/"
            className="flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle text-white hover:bg-white/5 hover:border-white/20 transition duration-200"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
        </div>

        {/* Responsive Custom Illustration */}
        <div className="w-full flex justify-center mb-1 transition-transform duration-300 hover:scale-105">
          <SignupIllustration />
        </div>

        {/* Typography */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1.5">
            Create Your Account
          </h1>
          <p className="text-sm text-text-muted">
            Start learning smarter with AI assistance
          </p>
        </div>

        {/* Responsive Form Card */}
        <div className="w-full rounded-3xl bg-card-bg border border-border-subtle p-5 sm:p-6 md:p-8 shadow-xl shadow-black/50 flex flex-col gap-5">
          {errors.global && (
            <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3 leading-snug">
              {errors.global}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={<User className="h-4.5 w-4.5" />}
              error={errors.fullName}
              disabled={isLoading}
              autoComplete="name"
            />

            <Input
              type="email"
              placeholder="Email Address"
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
              autoComplete="new-password"
            />

            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="h-4.5 w-4.5" />}
              error={errors.confirmPassword}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Checkbox
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              error={!!errors.agreeTerms}
              disabled={isLoading}
              label={
                <>
                  I agree to the{" "}
                  <span className="text-brand-primary hover:underline cursor-pointer">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="text-brand-primary hover:underline cursor-pointer">
                    Privacy Policy
                  </span>
                </>
              }
            />
            {errors.agreeTerms && (
              <span className="text-xs text-error-text -mt-2 px-1 font-medium">
                {errors.agreeTerms}
              </span>
            )}

            <Button type="submit" loading={isLoading} className="mt-2 shadow-lg shadow-brand-primary/10">
              Create Account
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

          {/* Third Party Login (Google) */}
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

        {/* Login Link */}
        <p className="mt-8 text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-brand-primary hover:underline font-semibold"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
