"use client";

import { useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import { useTheme } from "@/shared/hooks/useTheme";

export default function ImportThemeModal({ isOpen, onClose }) {
  const { addCustomTheme, setTheme } = useTheme();
  const [jsonInput, setJsonInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("json");

  const processThemePayload = (payload) => {
    try {
      // Basic validation
      if (!payload.id || !payload.name || !payload.colors || !payload.type) {
        throw new Error("Invalid theme format. Must include id, name, type, and colors.");
      }

      // Mark it as a custom theme
      const customTheme = {
        ...payload,
        isCustom: true,
        category: "custom"
      };

      addCustomTheme(customTheme);
      setTheme(customTheme.id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to parse theme data.");
    }
  };

  const handleJsonSubmit = () => {
    setError("");
    try {
      const payload = JSON.parse(jsonInput);
      processThemePayload(payload);
    } catch (err) {
      setError("Invalid JSON format. Please check your syntax.");
    }
  };

  const handleGithubSubmit = async () => {
    if (!githubUrl) return;
    setError("");
    setIsLoading(true);

    try {
      // Convert standard github URL to raw.githubusercontent.com if needed
      let fetchUrl = githubUrl;
      if (githubUrl.includes("github.com")) {
        fetchUrl = githubUrl
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/");
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error("Failed to fetch theme from URL");
      
      const payload = await res.json();
      processThemePayload(payload);
    } catch (err) {
      setError("Could not fetch valid JSON from the provided URL.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Custom Theme"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-muted">
          Add a custom theme by pasting a JSON payload or fetching directly from a community GitHub repository URL.
        </p>

        {/* Custom Tabs */}
        <div className="flex p-1 bg-surface-2 rounded-lg border border-border">
          <button
            onClick={() => setActiveTab("json")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "json" 
                ? "bg-surface shadow-sm text-text-main" 
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Paste JSON
          </button>
          <button
            onClick={() => setActiveTab("github")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "github" 
                ? "bg-surface shadow-sm text-text-main" 
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Fetch from GitHub
          </button>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <p>{error}</p>
          </div>
        )}

        {activeTab === "json" ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{
  "id": "my-custom-theme",
  "name": "My Custom Theme",
  "type": "dark",
  "colors": {
    "--color-bg": "#000000",
    "--color-brand-500": "#ff0000"
  }
}'
                className="w-full h-48 bg-surface-2 border border-border rounded-lg p-3 text-sm font-mono text-text-main placeholder:text-text-subtle focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none custom-scrollbar"
                spellCheck={false}
              />
            </div>
            <Button onClick={handleJsonSubmit} className="w-full" disabled={!jsonInput.trim()}>
              Import from JSON
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              label="Raw JSON URL"
              placeholder="https://raw.githubusercontent.com/..."
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              helperText="Paste a link to a raw .json file hosted on GitHub or any public URL."
            />
            <Button 
              onClick={handleGithubSubmit} 
              className="w-full" 
              disabled={!githubUrl.trim() || isLoading}
            >
              {isLoading ? "Fetching..." : "Fetch and Import"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}