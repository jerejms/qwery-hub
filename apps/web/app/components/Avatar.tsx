"use client";

import { useEffect, useRef, useState } from "react";

type MoodType = "stressed" | "normal" | "happy";

interface AvatarProps {
    isTalking: boolean;
    mood?: MoodType;
}

export function Avatar({ isTalking, mood = "normal" }: AvatarProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoError, setVideoError] = useState(false);
    const [videoReady, setVideoReady] = useState(false);

    // Note: Initial video setup is now handled by the videoSrc useEffect below

    // Handle play/pause based on isTalking
    useEffect(() => {
        const video = videoRef.current;
        
        console.log("Play/pause check:", {
            hasVideo: !!video,
            videoReady,
            videoError,
            isTalking,
            currentSrc: video?.currentSrc
        });
        
        if (!video || !videoReady || videoError) return;

        if (isTalking) {
            console.log("🎬 Starting video playback:", video.currentSrc);
            video.play().catch((err) => {
                console.error("❌ Play failed:", err);
                setVideoError(true);
            });
        } else {
            console.log("⏸️ Stopping video playback");
            video.pause();
            video.currentTime = 0;
        }
    }, [isTalking, videoReady, videoError]);

    // Determine asset paths based on mood
    const [imageSrc, setImageSrc] = useState("/image.png");
    const [videoSrc, setVideoSrc] = useState("/IMG_2476.MOV");

    // Update assets when mood changes
    useEffect(() => {
        console.log("Avatar mood changed to:", mood);
        
        let newImage = "/image.png";
        let newVideo = "/IMG_2476.MOV";
        
        switch (mood) {
            case "stressed":
                newImage = "/stress.png";
                newVideo = "/stress_video.mp4";
                break;
            case "happy":
                // Use normal image as fallback until happy image is added
                newImage = "/image.png";
                // Use normal video as fallback until happy video is added
                newVideo = "/IMG_2476.MOV";
                break;
            case "normal":
            default:
                newImage = "/image.png";
                newVideo = "/IMG_2476.MOV";
                break;
        }
        
        console.log("Loading new image:", newImage);
        
        // Check if mood-specific image exists, fallback if not
        const img = new Image();
        img.onload = () => {
            console.log("Image loaded successfully:", newImage);
            setImageSrc(newImage);
        };
        img.onerror = () => {
            console.log("Image failed to load, using fallback:", newImage);
            setImageSrc("/image.png");
        };
        img.src = newImage;

        // Update video source
        setVideoSrc(newVideo);
    }, [mood]);

    // Reload video when source changes
    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            console.error("⚠️ Video ref is null when trying to change source!");
            return;
        }

        console.log("Video source changing from", video.currentSrc, "to", videoSrc);
        
        // IMPORTANT: Reset error state FIRST before changing source
        setVideoReady(false);
        setVideoError(false);
        
        // Set up event listeners for the new video
        const handleCanPlay = () => {
            console.log("✅ New video ready to play!", videoSrc);
            setVideoReady(true);
        };

        const handleError = (e: any) => {
            console.error("❌ Video load error:", {
                error: e,
                src: videoSrc,
                errorCode: video.error?.code,
                errorMessage: video.error?.message,
                networkState: video.networkState
            });
            
            // Mark error but don't block - static image will show
            console.log("⚠️ Video unavailable, static image will be displayed");
            setVideoError(true);
            setVideoReady(false);
        };

        const handleLoadStart = () => {
            console.log("📥 Loading video:", videoSrc);
        };

        video.addEventListener("canplay", handleCanPlay);
        video.addEventListener("error", handleError);
        video.addEventListener("loadstart", handleLoadStart);
        
        // Update the video source and reload
        try {
            video.src = videoSrc;
            video.load();
            console.log("✅ Video source set and loading:", videoSrc);
        } catch (err) {
            console.error("❌ Failed to set video source:", err);
            setVideoError(true);
        }

        return () => {
            video.removeEventListener("canplay", handleCanPlay);
            video.removeEventListener("error", handleError);
            video.removeEventListener("loadstart", handleLoadStart);
        };
    }, [videoSrc]);

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Mood indicator badge */}
            <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full backdrop-blur-sm transition-colors duration-300 opacity-80 ${
                mood === "stressed" 
                    ? "bg-red-500" 
                    : "bg-green-500"
            }`}>
                <span className="text-xs text-white font-semibold">
                    {mood === "stressed" && "😡 Angry"}
                    {mood === "normal" && "😊 Calm"}
                    {mood === "happy" && "🎉 Happy"}
                </span>
            </div>

            {/* Static Image - shown when not talking or video fails */}
            <img
                src={imageSrc}
                alt="Study Buddy"
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isTalking && !videoError ? "opacity-0" : "opacity-100"
                    }`}
            />

            {/* Video - shown when talking (always rendered to maintain ref) */}
            <video
                ref={videoRef}
                src={videoSrc}
                loop
                muted
                playsInline
                preload="auto"
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                    isTalking && !videoError && videoReady ? "opacity-100" : "opacity-0"
                }`}
            />

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
