import React, { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'


import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import AdminLogin from './pages/CompanyLogin';
import CompanyDashboard from './pages/CompanyDashboard';

import {Button} from "@/components/ui/button"
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Building2, MapPin, Menu, X } from "lucide-react";
import './App.css'

// const MOCK_COMPANIES = [
//   { id: "company_123", name: "TechNova Solutions", location: "Makati City", initials: "TN", description: "B2B Software provider and IT consulting services." },
//   { id: "company_456", name: "GreenLeaf Organics", location: "Quezon City", initials: "GL", description: "Retailer of organic food and sustainable products." },
// ];

function ClientChat(){
  
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [chatHistoryByCompany, setChatHistoryByCompany] = useState({});
  const defaultGreeting = { sender: "ai", text: "Hi! how can I help you?" };

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/companies");
        const data = await response.json();
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompany(data[0]);
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      }
    };
    fetchCompanies();
  }, []);

  const textareaRef = React.useRef(null)

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
      const response = await fetch("http://localhost:8000/api/chat", {
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

  if (!selectedCompany) {
    return <div className="flex items-center justify-center h-screen">Kinukuha ang data sa Supabase...</div>;
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
    <div className = "flex flex-col h-screen bg-zinc-200">
      {/* navbar */}
      <nav className="flex items-center justify-between px-4 md:px-20 py-4 mb-2 shadow-sm h-14 bg-zinc-50 border border-zinc-400">
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

        {/* 3. NILAGYAN NATIN NG onClick ANG ADMIN LOGIN BUTTON */}
        <Button onClick={() => navigate('/admin')} variant="outline" size='sm'>Admin Login</Button>
      </nav>
            
      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 top-14 bg-black/30 md:hidden z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`fixed md:relative left-0 top-14 md:top-auto bottom-0 w-64 md:w-1/5 md:h-[88vh] md:ml-3 md:mr-3 flex flex-col bg-zinc-50 rounded-xl overflow-hidden z-40 transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <ScrollArea className="flex-1 h-full">
            <div className="p-2 space-y-1">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick = {() => {
                    setSelectedCompany(company)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left
                        ${selectedCompany?.id === company.id ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-zinc-100'}`}
                >
                  <Avatar>
                    <AvatarFallback className={selectedCompany?.id === company.id ? 'bg-blue-600 text-white' : ''}>
                      {company.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className={`text-sm font-medium truncate ${selectedCompany?.id === company.id ? 'text-blue-900' : 'text-zinc-900'}`}>
                      {company.name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{company.location}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-1 h-full flex flex-col bg-zinc-100 md:h-[88vh] md:rounded-xl md:mr-3 md:w-11/20">
          <div className="p-4 border-b border-zinc-400 shrink-0 flex items-center gap-3 rounded-t-full">
             <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{selectedCompany.initials}</AvatarFallback>
             </Avatar>
             <div>
               <h3 className="text-sm font-semibold text-zinc-900">Chat with {selectedCompany.name} AI</h3>
             </div>
          </div>

          <ScrollArea className="flex-1 p-4 overflow-hidden">
            <div className="space-y-4 max-w-3xl mx-auto">
              {(chatHistoryByCompany[selectedCompany.id] || [defaultGreeting]).map((chat, idx) => (
                <div key={idx} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm break-words overflow-hidden ${
                    chat.sender === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md' 
                      : 'bg-zinc-200 text-zinc-800 shadow-md rounded-bl-none'
                  }`}> {chat.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 bg-zinc-300 rounded-b-xl shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here.. (Shift+Enter for newline)"
                className="px-3 rounded-xl bg-zinc-50 w-full min-h-[10px] max-h-[200px] h-auto resize-none overflow-hidden border border-transparent focus:border-black focus:outline-none focus:ring-0 py-2"
              />
              <Button
                onClick={handleSendMessages}
                size="icon"
                className="rounded-full flex items-center justify-center w-10 h-10 p-2"
                disabled={isSending}
              >
                <Send className="w-6 h-6 block" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="h-[88vh] w-1/4 bg-zinc-50 p-6 hidden lg:block rounded-xl">
            <CardHeader className="p-0 text-center flex flex-col items-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarFallback className="text-2xl bg-zinc-100 text-zinc-600">
                  {selectedCompany.initials}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-xl">{selectedCompany.name}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-1 mt-1 text-sm text-zinc-600">
                <MapPin className="w-3 h-3 text-red-600" /> {selectedCompany.location}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 mt-6 text-sm text-zinc-600 text-center">
              <p>{selectedCompany.description}</p>
            </CardContent>
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
        <Route path="/dashboard" element={<CompanyDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;