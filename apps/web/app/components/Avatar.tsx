"use client";

import { useEffect, useRef, useState } from "react";

interface AvatarProps {
    isTalking: boolean;
}

export function Avatar({ isTalking }: AvatarProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoError, setVideoError] = useState(false);
    const [videoReady, setVideoReady] = useState(false);

    // Preload and prepare video on mount
    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            console.log("Avatar: Video ref is null");
            return;
        }

        console.log("Avatar: Setting up video...", {
            src: video.src,
            currentSrc: video.currentSrc,
            readyState: video.readyState
        });

        const handleCanPlay = () => {
            console.log("✅ Video ready to play!", {
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
            setVideoReady(true);
        };

        const handleError = (e: any) => {
            console.error("❌ Video error:", {
                error: e,
                src: video.src,
                networkState: video.networkState,
                readyState: video.readyState,
                errorCode: video.error?.code,
                errorMessage: video.error?.message
            });
            setVideoError(true);
        };

        const handleLoadStart = () => {
            console.log("📥 Video load started");
        };

        const handleLoadedMetadata = () => {
            console.log("📊 Video metadata loaded", {
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        };

        video.addEventListener("canplay", handleCanPlay);
        video.addEventListener("error", handleError);
        video.addEventListener("loadstart", handleLoadStart);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);

        // Force load the video
        console.log("⏳ Forcing video load...");
        video.load();

        return () => {
            video.removeEventListener("canplay", handleCanPlay);
            video.removeEventListener("error", handleError);
            video.removeEventListener("loadstart", handleLoadStart);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        };
    }, []);

    // Handle play/pause based on isTalking
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoReady || videoError) return;

        if (isTalking) {
            console.log("Starting video playback");
            video.play().catch((err) => {
                console.error("Play failed:", err);
                setVideoError(true);
            });
        } else {
            console.log("Stopping video playback");
            video.pause();
            video.currentTime = 0;
        }
    }, [isTalking, videoReady, videoError]);

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Static Image - shown when not talking or video fails */}
            <img
                src="/image.png"
                alt="Study Buddy"
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isTalking && !videoError ? "opacity-0" : "opacity-100"
                    }`}
            />

            {/* Video - shown when talking */}
            {!videoError && (
                <video
                    ref={videoRef}
                    src="/IMG_2476.MOV"
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isTalking ? "opacity-100" : "opacity-0"
                        }`}
                />
            )}

            {/* Talking indicator */}
            {isTalking && !videoError && videoReady && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
                    <div className="flex gap-1">
                        <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-white/80">
                        Speaking... {!videoReady && "(loading video)"}
                    </span>
                </div>
            )}

            {/* Debug info - remove this after testing */}
            {videoError && (
                <div className="absolute top-4 left-4 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
                    Video failed to load
                </div>
            )}
        </div>
    );
}
