"use client";

import { useEffect, useState } from "react";

interface WelcomeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeOverlay({ isOpen, onClose }: WelcomeOverlayProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 overflow-y-auto ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-8 md:p-12 transition-all duration-300 my-auto ${
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
          aria-label="Close welcome overlay"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Welcome heading */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Welcome to qwery-hub
          </h1>
          <p className="text-xl text-white/60">Your AI study buddy</p>
        </div>

        {/* Key Features */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white/80 mb-4">
            What you can do:
          </h2>
          <div className="grid gap-3">
            <FeatureItem
              icon="💬"
              title="AI Study Buddy"
              description="Chat interface for studying assistance"
            />
            <FeatureItem
              icon="🔊"
              title="Voice + Animated Avatar"
              description="Press the volume button to enable voice responses with talking avatar"
              highlight
            />
            <FeatureItem
              icon="✨"
              title="Smart Task Recommendations"
              description="'Right Now' widget suggests what to work on next"
            />
            <FeatureItem
              icon="🔗"
              title="Canvas & NUSMods Sync"
              description="Auto-sync assignments and class schedule"
            />
          </div>
        </div>

        {/* How to Use */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">How to use:</h2>
          <ol className="space-y-3 text-white/80">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-sm font-semibold">
                1
              </span>
              <span>
                Click the{" "}
                <span className="inline-flex items-center px-2 py-1 rounded bg-white/10 text-sm mx-1">
                  🔊
                </span>{" "}
                button to enable voice responses and avatar animation
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-sm font-semibold">
                2
              </span>
              <span>
                Click{" "}
                <span className="font-semibold text-white">Connect</span> to
                sync your Canvas assignments and NUSMods schedule
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-sm font-semibold">
                3
              </span>
              <span>
                Ask questions in the chat or click{" "}
                <span className="font-semibold text-white">Prompt</span> in the
                Right Now widget for task recommendations
              </span>
            </li>
          </ol>
        </div>

        {/* Get Started button */}
        <button
          onClick={onClose}
          className="w-full py-4 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 font-semibold text-lg transition-all duration-200 hover:scale-[1.02]"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
}

function FeatureItem({
  icon,
  title,
  description,
  highlight,
}: FeatureItemProps) {
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
        highlight
          ? "border-white/20 bg-white/5"
          : "border-white/10 bg-transparent"
      }`}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}
