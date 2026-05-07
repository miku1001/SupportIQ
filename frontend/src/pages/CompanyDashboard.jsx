import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Building2, Moon, Sun } from "lucide-react";

const getCompanyStorageKey = (id) => `companyId:${id}`;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function CompanyDashboard() {
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("supportiq-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const navigate = useNavigate();

  const fetchUploads = async (id) => {
    try {
      setUploadsLoading(true);
      const response = await fetch(`${API_BASE}/api/uploads?company_id=${id}`);
      if (!response.ok) {
        throw new Error("Failed to load uploads.");
      }
      const data = await response.json();
      setUploads(data || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load uploads.");
    } finally {
      setUploadsLoading(false);
    }
  };

  const fetchCompanyName = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/companies/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load company details.");
      }
      const data = await response.json();
      setCompanyName(data?.name || "");
    } catch (error) {
      setCompanyName("");
      setErrorMessage(error.message || "Failed to load company details.");
    }
  };

  useEffect(() => {
    if (!companyId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUploads(companyId);
    fetchCompanyName(companyId);
  }, [companyId]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("supportiq-theme", theme);
  }, [theme]);

  useEffect(() => {
    const syncUser = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session?.user) {
          navigate("/admin");
          return;
        }

        const currentUserId = data.session.user.id;
        const storedId = localStorage.getItem(getCompanyStorageKey(currentUserId)) || "";
        if (!storedId) {
          navigate("/admin");
          return;
        }
        setCompanyId(storedId);
      } finally {
        setCheckingSession(false);
      }
    };

    syncUser();
  }, [navigate]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      const storedId = localStorage.getItem(getCompanyStorageKey(session.user.id)) || "";
      if (storedId) {
        setCompanyId(storedId);
      }
      setCheckingSession(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!companyId) {
      setErrorMessage("Missing company ID. Please set up your company.");
      return;
    }

    if (!file) {
      setErrorMessage("Please choose a file first.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("company_id", companyId);
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed.");
      }

      const result = await response.json();
      setMessage(result.message || "File uploaded successfully.");
      setFile(null);
      fetchUploads(companyId);
    } catch (error) {
      setErrorMessage(error.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/uploads/${uploadId}?company_id=${companyId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Delete failed.");
      }

      setUploads((prev) => prev.filter((item) => item.id !== uploadId));
      setMessage("Upload deleted.");
    } catch (error) {
      setErrorMessage(error.message || "Delete failed.");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("companyId");
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase sign-out failed:", error);
    }
    navigate("/admin");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#f6f2ec] text-zinc-900 dark:bg-[#0f1117] dark:text-zinc-100" />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f2ec] text-zinc-900 dark:bg-[#0f1117] dark:text-zinc-100">
      <nav className="flex items-center justify-between px-4 md:px-20 py-4 h-14 bg-zinc-50 border border-zinc-400 dark:bg-[#151822] dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
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
          <Button onClick={handleLogout} variant="outline" size="sm">Logout</Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-4 pb-8">

        <div className="rounded-2xl bg-gradient-to-r from-[#0b0d13] via-[#1b2a5b] to-[#1f3b8f] text-white px-6 py-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <h2 className="text-2xl font-semibold leading-tight">Company Dashboard</h2>
              <p className="text-sm leading-snug text-white/80">Upload documents to train your AI assistant.</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold leading-none">{uploads.length}</div>
              <div className="text-xs uppercase tracking-wide text-white/70">Documents uploaded</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="rounded-2xl border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#151822]">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-zinc-100">File Upload</CardTitle>
              <CardDescription className="text-zinc-500 dark:text-zinc-400">PDF or TXT files only · Max 10MB per file</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Company</label>
                  <Input
                    type="text"
                    value={companyName || "Loading company..."}
                    readOnly
                    className="bg-zinc-50 text-zinc-900 dark:bg-[#0f1117] dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Choose File</label>
                  <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center dark:border-zinc-700 dark:bg-[#0f1117]">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to upload <span className="text-zinc-500 dark:text-zinc-400">or drag and drop</span></p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">PDF or TXT files only</p>
                    <Input
                      type="file"
                      accept=".pdf,.txt"
                      className="mt-4 text-zinc-900 dark:text-zinc-100"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                {message && <p className="text-sm text-green-600">{message}</p>}

                <Button type="submit" className="w-full bg-[#2f5bf2] hover:bg-[#244ad1] text-white" disabled={loading}>
                  {loading ? "Uploading..." : "Upload Document"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#151822]">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-zinc-100">Uploaded Files</CardTitle>
              <CardDescription className="text-zinc-500 dark:text-zinc-400">Manage your uploaded documents.</CardDescription>
            </CardHeader>
            <CardContent>
              {uploadsLoading ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading uploads...</p>
              ) : uploads.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No uploads yet.</p>
              ) : (
                <div className="space-y-3">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-[#0f1117]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                          <span className="text-xs font-semibold">PDF</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{upload.filename}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{upload.created_at}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                        onClick={() => handleDeleteUpload(upload.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CompanyDashboard;
