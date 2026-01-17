"use client";

import { useEffect, useRef } from "react";

interface AvatarProps {
    isTalking: boolean;
}

export function Avatar({ isTalking }: AvatarProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isTalking) {
            video.currentTime = 0;
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isTalking]);

    return (
        <div className="pointer-events-none">
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                {/* Avatar frame */}
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Idle image */}
                    <img
                        src="/image.png"
                        alt="Assistant idle"
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out
                ${isTalking ? "opacity-0" : "opacity-100"}
            `}
                        draggable={false}
                    />

                    {/* Talking video */}
                    <video
                        ref={videoRef}
                        src="/IMG_2476.MOV"
                        loop
                        muted
                        playsInline
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out
                ${isTalking ? "opacity-100" : "opacity-0"}
            `}
                    />
                </div>
            </div>
        </div>
    );
}