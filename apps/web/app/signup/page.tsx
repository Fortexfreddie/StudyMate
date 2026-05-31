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
