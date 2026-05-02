import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";

function AdminLogin() {
  // State para malaman kung nasa "Login" mode o "Signup" mode tayo
  const [isLogin, setIsLogin] = useState(true);
  
  // Mga state para sa form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  
  // Ito yung gagamitin natin pang-lipat ng page mamaya
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else {
          setSuccessMessage("Logged in successfully.");
          const existingCompanyId = localStorage.getItem('companyId');
          if (existingCompanyId) {
            navigate('/dashboard');
          } else {
            setShowCompanyForm(true);
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else {
          setSuccessMessage("Account created. Set up your company profile.");
          setShowCompanyForm(true);
        }
      }
    } catch (error) {
      setErrorMessage("Something went wrong. Please try again.");
      console.error("Supabase auth error:", error);
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
      const payload = {
        name: companyName,
        location: companyLocation,
        initials: buildInitials(companyName),
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

      localStorage.setItem('companyId', createdCompany.id);
      setSuccessMessage("Company created.");
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error.message || "Failed to create company.");
    } finally {
      setLoading(false);
    }
  };

  if (showCompanyForm) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 px-4">
        <Card className="w-full max-w-md shadow-lg border-zinc-200">
          <CardHeader className="space-y-2 text-center flex flex-col items-center mt-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Set Up Your Company</CardTitle>
            <CardDescription>Enter your company details to continue.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Company Name</label>
                <Input
                  type="text"
                  placeholder="TechNova Solutions"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Company Location</label>
                <Input
                  type="text"
                  placeholder="Makati City"
                  value={companyLocation}
                  onChange={(e) => setCompanyLocation(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Description</label>
                <Input
                  type="text"
                  placeholder="B2B Software provider and IT consulting services."
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  required
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="text-sm text-green-600">{successMessage}</p>
              )}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? "Please wait..." : "Create Company"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 px-4">
      
      {/* Back to Chat button (pansamantala para madali bumalik) */}
      <Button 
        variant="ghost" 
        className="absolute top-4 left-4"
        onClick={() => navigate('/')}
      >
        ← Back to Chat
      </Button>

      <Card className="w-full max-w-md shadow-lg border-zinc-200">
        <CardHeader className="space-y-2 text-center flex flex-col items-center mt-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isLogin ? "Welcome Back" : "Create an Account"}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? "Mag-login para i-manage ang AI assistant ng kumpanya mo." 
              : "I-setup ang AI support agent ng negosyo mo ngayon."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Email Address</label>
              <Input 
                type="email" 
                placeholder="admin@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Password</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t pt-4 text-sm text-zinc-600">
          {isLogin ? "Wala pang account? " : "May account ka na? "}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="ml-1 text-blue-600 hover:underline font-medium"
          >
            {isLogin ? "Mag-Sign Up" : "Mag-Log In"}
          </button>
        </CardFooter>
      </Card>
      
    </div>
  );
}

export default AdminLogin;