import React, { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'


import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import AdminLogin from './pages/CompanyLogin';
import AuthCallback from './pages/AuthCallback';
import CompanyDashboard from './pages/CompanyDashboard';

import {Button} from "@/components/ui/button"
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Building2, MapPin, Menu, X, Moon, Sun } from "lucide-react";
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// const MOCK_COMPANIES = [
//   { id: "company_123", name: "TechNova Solutions", location: "Makati City", initials: "TN", description: "B2B Software provider and IT consulting services." },
//   { id: "company_456", name: "GreenLeaf Organics", location: "Quezon City", initials: "GL", description: "Retailer of organic food and sustainable products." },
// ];

function ClientChat(){
  
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("supportiq-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [chatHistoryByCompany, setChatHistoryByCompany] = useState({});
  const defaultGreeting = { sender: "ai", text: "Hi! how can I help you?" };

  const fetchCompanies = async () => {
    try {
      setCompaniesLoading(true);
      setCompaniesError("");

      const response = await fetch(`${API_BASE}/api/companies`);
      if (!response.ok) {
        throw new Error("Hindi ma-load ang listahan ng companies.");
      }

      const data = await response.json();
      const companyList = Array.isArray(data) ? data : [];
      setCompanies(companyList);
      setSelectedCompany((prev) => {
        if (prev && companyList.some((company) => company.id === prev.id)) {
          return prev;
        }
        return companyList.length > 0 ? companyList[0] : null;
      });
    } catch (error) {
      setCompanies([]);
      setSelectedCompany(null);
      setCompaniesError(error.message || "May error sa pagkuha ng company data.");
      console.error("Error fetching companies:", error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const activeCompany = selectedCompany ?? {
    id: "no-companies",
    name: "No companies available",
    initials: "--",
    location: "",
    description: "No company has been added yet.",
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("supportiq-theme", theme);
  }, [theme]);

  const textareaRef = React.useRef(null)
  const chatEndRef = React.useRef(null)

  const handleSendMessages = async () => {
    if (!message.trim() || !selectedCompany || isSending) return;

    const outgoing = message;
    setChatHistoryByCompany((prev) => {
      const companyId = selectedCompany.id;
      const history = prev[companyId] || [defaultGreeting];
      return {
        ...prev,
        [companyId]: [...history, { sender: "user", text: outgoing }],
      };
    });
    setMessage("");

    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.blur()
    }

    try {
      setIsSending(true);
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          user_message: outgoing,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Chat request failed.");
      }

      const data = await response.json();
      setChatHistoryByCompany((prev) => {
        const companyId = selectedCompany.id;
        const history = prev[companyId] || [defaultGreeting];
        return {
          ...prev,
          [companyId]: [...history, { sender: "ai", text: data.reply || "" }],
        };
      });
    } catch (error) {
      setChatHistoryByCompany((prev) => {
        const companyId = selectedCompany.id;
        const history = prev[companyId] || [defaultGreeting];
        return {
          ...prev,
          [companyId]: [...history, { sender: "ai", text: "Sorry, something went wrong." }],
        };
      });
      console.error("Chat error:", error);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [selectedCompany, chatHistoryByCompany])

  if (companiesLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (companiesError) {
    return (
      <div className="flex flex-col gap-3 items-center justify-center h-screen text-center px-6">
        <p className="text-base text-zinc-800 dark:text-zinc-200">{companiesError}</p>
        <Button onClick={fetchCompanies} variant="outline">Subukan ulit</Button>
      </div>
    );
  }

  const handleInputChange = (e) => {
    setMessage(e.target.value)
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessages()
    }
  }

  return (
    <div className = "flex flex-col min-h-[100svh] bg-zinc-200 dark:bg-zinc-950">
      {/* navbar */}
      <nav className="flex items-center justify-between px-4 md:px-20 py-4 mb-2 h-14 bg-zinc-50 border border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
          <Building2 className="w-6 h-6"/>
          <span className="text-sm font-bold">SupportIQ</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          {/* 3. NILAGYAN NATIN NG onClick ANG ADMIN LOGIN BUTTON */}
          <Button onClick={() => navigate('/admin')} variant="outline" size='sm'>Register your Company</Button>
        </div>
      </nav>
            
      {/* MAIN CONTENT */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 top-14 bg-black/30 md:hidden z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`fixed md:relative left-0 top-14 md:top-auto bottom-0 w-64 md:w-1/5 md:h-[calc(100svh-4rem)] md:ml-3 md:mr-3 flex flex-col bg-zinc-50 dark:bg-zinc-900 rounded-xl overflow-hidden z-40 transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <ScrollArea className="flex-1 h-full">
            <div className="p-2 space-y-1">
              {companies.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  No companies available
                </div>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company)
                      setSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                          ${selectedCompany?.id === company.id ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                    <Avatar>
                      <AvatarFallback className={selectedCompany?.id === company.id ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'}>
                        {company.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className={`text-sm font-medium truncate ${selectedCompany?.id === company.id ? 'text-blue-900 dark:text-blue-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {company.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{company.location}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-1 min-h-0 h-full flex flex-col bg-zinc-100 dark:bg-zinc-900 md:h-[calc(100svh-4rem)] md:rounded-xl md:mr-3 md:w-11/20">
          <div className="p-4 border-b border-zinc-400 dark:border-zinc-700 shrink-0 flex items-center gap-3 rounded-t-full">
             <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100 text-xs">{activeCompany.initials}</AvatarFallback>
             </Avatar>
             <div>
               <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chat with {activeCompany.name} AI</h3>
             </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-4 overflow-hidden">
            <div className="space-y-4 w-full max-w-none md:max-w-3xl md:mx-auto">
              {selectedCompany ? (
                (chatHistoryByCompany[selectedCompany.id] || [defaultGreeting]).map((chat, idx) => (
                  <div key={idx} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm wrap-break-word overflow-hidden ${
                      chat.sender === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-md text-right' 
                        : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 shadow-md rounded-bl-none text-left'
                    }`}> {chat.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full min-h-60 items-center justify-center text-center">
                  <div className="max-w-md space-y-3 rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-8 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No companies available</p>
                    <p className="text-sm">The chat page is still available, but there is no company to chat with yet.</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 bg-zinc-300 dark:bg-zinc-800 rounded-b-xl shrink-0">
            <div className="w-full max-w-none md:max-w-3xl md:mx-auto flex items-center gap-2">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here.. (Shift+Enter for newline)"
                className="px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 w-full  max-h-50 h-auto resize-none overflow-hidden border border-transparent focus:border-black dark:focus:border-zinc-500 focus:outline-none focus:ring-0 py-1"
              />
              <Button
                onClick={handleSendMessages}
                size="icon"
                className="rounded-full flex items-center justify-center w-10 h-10 p-2"
                disabled={isSending || !selectedCompany}
              >
                <Send className="w-6 h-6 block" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="h-[calc(100svh-4rem)] w-1/4 bg-zinc-50 dark:bg-zinc-900 p-6 hidden lg:block rounded-xl">
            {!selectedCompany ? (
              <CardContent className="p-0 text-sm text-zinc-600 dark:text-zinc-300 text-center">
                <p>No companies available.</p>
              </CardContent>
            ) : (
            <>
            <CardHeader className="p-0 text-center flex flex-col items-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarFallback className="text-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                  {selectedCompany.initials}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-xl dark:text-zinc-100">{selectedCompany.name}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-1 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                <MapPin className="w-3 h-3 text-red-600" /> {selectedCompany.location}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 mt-6 text-sm text-zinc-600 dark:text-zinc-300 text-center">
              <p>{selectedCompany.description}</p>
            </CardContent>
            </>
            )}
        </div>
      </div>
    </div>
  )
}


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClientChat />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<CompanyDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;