import React, { useCallback, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";

const getCompanyStorageKey = (id) => `companyId:${id}`;

function AuthShell({ children, showBack, onBack }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[.75fr_1fr]">
        <div className="hidden lg:flex flex-col justify-between border-r border-white/10 bg-linear-to-b from-zinc-900 via-zinc-950 to-zinc-900 px-12 py-10">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/40">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SupportIQ</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight text-white">
              Your AI,
              <span className="block text-blue-400 font-serif italic">trained</span>
              <span className="block">on your company.</span>
            </h1>
            <p className="max-w-md text-sm text-zinc-400">
              Upload documents, set up your profile, and let your AI handle customer support automatically.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Companies", value: "4" },
                { label: "Satisfaction", value: "98%" },
                { label: "AI Support", value: "24/7" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-lg font-semibold text-white">{item.value}</p>
                  <p className="text-xs text-zinc-400">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              All systems operational
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center px-6 py-12 lg:px-12">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-6 top-6 text-sm text-zinc-400 hover:text-white"
            >
              {"<- Back to Chat"}
            </button>
          )}
          <div className="w-full max-w-xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLogin() {
  // Track whether the form is in login or signup mode
  const [isLogin, setIsLogin] = useState(true);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [userId, setUserId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyInitials, setCompanyInitials] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);
  
  // Used for navigation
  const navigate = useNavigate();

  const handlePostAuthNavigation = useCallback((id) => {
    if (!id) return;
    const existingCompanyId = localStorage.getItem(getCompanyStorageKey(id));
    if (existingCompanyId) {
      navigate('/dashboard');
      return;
    }

    setShowCompanyForm(true);
  }, [navigate]);

  React.useEffect(() => {
    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Unable to read Supabase session:', error);
        return;
      }

      if (data?.session?.user) {
        const currentUserId = data.session.user.id;
        setUserId(currentUserId);
        handlePostAuthNavigation(currentUserId);
      }
    };

    syncSession();
  }, [handlePostAuthNavigation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setWarningMessage('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data?.user && !data.user.email_confirmed_at) {
          setWarningMessage("Please confirm your email before signing in.");
        } else {
          const currentUserId = data?.user?.id || '';
          if (currentUserId) {
            setUserId(currentUserId);
          }
          setSuccessMessage("Logged in successfully.");
          handlePostAuthNavigation(currentUserId);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          const normalizedMessage = error.message?.toLowerCase() || "";
          if (normalizedMessage.includes("already") || normalizedMessage.includes("registered") || normalizedMessage.includes("exists")) {
            setWarningMessage("Account already exists.");
          } else {
            setErrorMessage(error.message);
          }
        } else {
          const hasExistingIdentity = data?.user?.identities?.length > 0;
          if (!hasExistingIdentity) {
            setWarningMessage("Account already exists.");
            setIsLogin(true);
            return;
          }
          if (data?.user && !data.user.email_confirmed_at) {
            setWarningMessage("Please confirm your email to finish setting up your account.");
            setIsLogin(true);
            return;
          }
          const currentUserId = data?.user?.id || '';
          if (currentUserId) {
            setUserId(currentUserId);
          }
          setSuccessMessage("Account created. Set up your company profile.");
          handlePostAuthNavigation(currentUserId);
        }
      }
    } catch (error) {
      setErrorMessage("Something went wrong. Please try again.");
      console.error("Supabase auth error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setWarningMessage('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      }
    } catch (error) {
      setErrorMessage('Unable to start OAuth sign-in.');
      console.error('Supabase OAuth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildInitials = (name) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!userId) {
        throw new Error("Unable to identify your account. Please log in again.");
      }

      const payload = {
        name: companyName,
        location: companyLocation,
        initials: companyInitials || buildInitials(companyName),
        description: companyDescription,
      };

      const response = await fetch("http://localhost:8000/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create company.");
      }

      const result = await response.json();
      const createdCompany = Array.isArray(result.response) ? result.response[0] : null;

      if (!createdCompany?.id) {
        throw new Error("Company created but no ID returned.");
      }

      localStorage.setItem(getCompanyStorageKey(userId), createdCompany.id);
      setSuccessMessage("Company created.");
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error.message || "Failed to create company.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => {
      setResetCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setWarningMessage('');

    if (!email) {
      setErrorMessage("Please enter your email first.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage("Password reset email sent. Check your inbox.");
        setResetCooldown(60);
      }
    } catch {
      setErrorMessage("Unable to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (showCompanyForm) {
    return (
      <AuthShell showBack onBack={() => navigate('/')}>
        <div className="space-y-8">
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">1</span>
              <span className="text-emerald-300">Account</span>
            </div>
            <span className="h-px flex-1 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40">2</span>
              <span className="text-white">Company</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">COMPANY SETUP</p>
            <h2 className="text-4xl font-semibold text-white">Set up your company.</h2>
            <p className="text-sm text-zinc-400">Enter your company details to continue.</p>
          </div>

          <form onSubmit={handleCompanySubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Company Name</label>
              <Input
                type="text"
                placeholder="TechNova Solutions"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Company Location</label>
              <Input
                type="text"
                placeholder="Makati City"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Initials</label>
              <Input
                type="text"
                placeholder="TN"
                value={companyInitials}
                onChange={(e) => setCompanyInitials(e.target.value)}
                maxLength={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Description</label>
              <Input
                type="text"
                placeholder="B2B Software provider and IT consulting services."
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}
            {warningMessage && (
              <p className="text-sm text-amber-400">{warningMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm text-emerald-400">{successMessage}</p>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? "Please wait..." : "Create Company"}
            </Button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell showBack onBack={() => navigate('/')}>
      <div className="space-y-8">
        {isLogin ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">ADMIN ACCESS</p>
            <h2 className="text-4xl font-semibold text-white">Welcome back.</h2>
            <p className="text-sm text-zinc-400">Sign in to manage your company AI assistant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40">1</span>
                <span className="text-white">Account</span>
              </div>
              <span className="h-px flex-1 bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-zinc-500 ring-1 ring-white/10">2</span>
                <span>Company</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-blue-400">CREATE ACCOUNT</p>
              <h2 className="text-4xl font-semibold text-white">Get started for free.</h2>
              <p className="text-sm text-zinc-400">Create an account to start setting up your AI assistant.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Email Address</label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Password</label>
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
            />
          </div>
          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-blue-400 hover:underline"
                disabled={loading || resetCooldown > 0}
              >
                {resetCooldown > 0 ? `Try again in ${resetCooldown}s` : "Forgot password?"}
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}
          {warningMessage && (
            <p className="text-sm text-amber-400">{warningMessage}</p>
          )}
          {successMessage && (
            <p className="text-sm text-emerald-400">{successMessage}</p>
          )}

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {isLogin && (
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.2-4.6-50.4H272v95.4h147.4c-6.3 34.1-25 62.9-53.4 82.2v68.1h86.3c50.6-46.6 80.2-115.2 80.2-195.3z"/>
              <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178-65.3l-86.3-68.1c-24.1 16.2-55 25.8-91.7 25.8-70.6 0-130.4-47.8-151.8-112.2H31.2v70.6C75.7 475.8 167.9 544.3 272 544.3z"/>
              <path fill="#FBBC05" d="M120.2 322.5c-10.8-32.4-10.8-67.3 0-99.7V152.2H31.2c-39.5 77.2-39.5 168.4 0 245.6l89-75.3z"/>
              <path fill="#EA4335" d="M272 107.1c39.5 0 75 13.6 103 40.5l77.2-77.2C405.6 24 344.6 0 272 0 167.9 0 75.7 68.5 31.2 169.9l89 75.3C141.6 154.9 201.4 107.1 272 107.1z"/>
            </svg>
            <span>Continue with Google</span>
          </Button>
        )}

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="text-center text-sm text-zinc-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMessage('');
              setSuccessMessage('');
              setWarningMessage('');
            }}
            className="ml-1 text-blue-400 hover:underline font-medium"
          >
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

export default AdminLogin;