"use client";

import { useState } from "react";
import { useTheme } from "@/shared/hooks/useTheme";
import { THEMES } from "@/shared/constants/themes";
import { cn } from "@/shared/utils/cn";
import Modal from "./Modal";
import ImportThemeModal from "./ImportThemeModal";

export default function ThemeToggle({ className, variant = "default" }) {
  const { isDark, themeId, customThemes, setTheme, removeCustomTheme } = useTheme();
  const [showGallery, setShowGallery] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const variants = {
    default: cn(
      "flex items-center justify-center size-10 rounded-full",
      "text-text-muted hover:text-text-main",
      "hover:bg-surface-2 transition-colors"
    ),
    card: cn(
      "flex items-center justify-center size-11 rounded-full",
      "bg-surface/60 hover:bg-surface",
      "border border-border",
      "backdrop-blur-md shadow-sm hover:shadow-[var(--shadow-warm)]",
      "text-text-muted hover:text-brand-500",
      "transition-all group"
    ),
  };

  const categories = ["custom", ...new Set(THEMES.map(t => t.category))];
  
  const allThemes = [...customThemes, ...THEMES];

  return (
    <>
      <button
        onClick={() => setShowGallery(true)}
        className={cn(variants[variant], className)}
        aria-label="Open Theme Gallery"
        title="Open Theme Gallery"
      >
        <span
          className={cn(
            "material-symbols-outlined text-[22px]",
            variant === "card" && "transition-transform duration-300 group-hover:rotate-12"
          )}
        >
          palette
        </span>
      </button>

      <Modal
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        title="Theme Gallery"
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto scroll-thin-x pr-2 pb-4">
          {categories.map(category => {
            const categoryThemes = allThemes.filter(t => t.category === category || (category === "custom" && t.isCustom));
            
            if (categoryThemes.length === 0) return null;

            return (
              <div key={category} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                    {category}
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {categoryThemes.map((theme) => {
                    const isActive = themeId === theme.id;
                    
                    return (
                      <div key={theme.id} className="relative group">
                        <button
                          onClick={() => setTheme(theme.id)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border text-left transition-all w-full",
                            isActive
                              ? "border-primary bg-primary/5 shadow-[0_0_0_1px_var(--color-primary)]"
                              : "border-border hover:border-text-subtle hover:bg-surface-2"
                          )}
                        >
                          <div 
                            className="w-full h-16 rounded-md shadow-inner flex overflow-hidden border border-border"
                            style={{ backgroundColor: theme.colors["--color-bg"] }}
                          >
                            <div className="w-1/3 h-full flex flex-col border-r border-border/10" style={{ backgroundColor: theme.colors["--color-surface-2"] }}>
                               <div className="h-2 m-1.5 rounded-sm opacity-50" style={{ backgroundColor: theme.colors["--color-text-main"] }}></div>
                               <div className="h-2 m-1.5 mt-0 rounded-sm opacity-30" style={{ backgroundColor: theme.colors["--color-text-main"] }}></div>
                            </div>
                            <div className="flex-1 p-2 flex flex-col gap-1.5">
                               <div className="h-2 w-1/2 rounded-sm" style={{ backgroundColor: theme.colors["--color-text-main"] }}></div>
                               <div className="h-4 w-full rounded" style={{ backgroundColor: theme.colors["--color-surface"] }}></div>
                               <div className="h-3 w-3 rounded-full mt-auto self-end" style={{ backgroundColor: theme.colors["--color-brand-500"] }}></div>
                            </div>
                          </div>
                          <div className="flex flex-col w-full">
                            <span className="text-xs font-medium text-text-main truncate">{theme.name}</span>
                            <span className="text-[10px] text-text-muted uppercase tracking-wide">{theme.type}</span>
                          </div>
                        </button>
                        
                        {theme.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomTheme(theme.id);
                            }}
                            className="absolute -top-2 -right-2 bg-danger text-white rounded-full size-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Delete custom theme"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          <div className="mt-4 p-4 rounded-xl border border-border bg-surface-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div>
                <p className="text-sm font-medium text-text-main">Want to build your own theme?</p>
                <p className="text-xs text-text-muted mt-1">You can add custom JSON themes directly or fetch from community GitHub repos.</p>
             </div>
             <button 
               onClick={() => setShowImport(true)}
               className="px-3 py-1.5 bg-surface border border-border rounded shadow-sm text-xs font-medium hover:bg-surface-3 transition-colors shrink-0 flex items-center gap-2"
             >
               <span className="material-symbols-outlined text-[16px]">download</span>
               Import Theme
             </button>
          </div>
        </div>
      </Modal>

      {showImport && (
        <ImportThemeModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}
