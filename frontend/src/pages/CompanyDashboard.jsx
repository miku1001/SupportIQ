import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

function CompanyDashboard() {
  const [companyId, setCompanyId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedId = localStorage.getItem("companyId") || "";
    setCompanyId(storedId);
  }, []);

  useEffect(() => {
    if (!companyId) return;
    fetchUploads(companyId);
  }, [companyId]);

  const fetchUploads = async (id) => {
    try {
      setUploadsLoading(true);
      const response = await fetch(`http://localhost:8000/api/uploads?company_id=${id}`);
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

      const response = await fetch("http://localhost:8000/api/upload", {
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
        `http://localhost:8000/api/uploads/${uploadId}?company_id=${companyId}`,
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

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Company Dashboard</h1>
            <p className="text-sm text-zinc-600">Upload documents to train your AI.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>Go to Chat</Button>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>PDF or TXT files only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Company ID</label>
                <Input type="text" value={companyId} readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Choose File</label>
                <Input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>

              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? "Uploading..." : "Upload"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm mt-6">
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>Manage your uploaded documents.</CardDescription>
          </CardHeader>
          <CardContent>
            {uploadsLoading ? (
              <p className="text-sm text-zinc-600">Loading uploads...</p>
            ) : uploads.length === 0 ? (
              <p className="text-sm text-zinc-600">No uploads yet.</p>
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{upload.filename}</p>
                      <p className="text-xs text-zinc-500">{upload.created_at}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
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
  );
}

export default CompanyDashboard;
