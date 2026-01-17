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
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
            {/* Idle image */}
            <img
                src="/image.png"
                alt="Assistant idle"
                className={`absolute max-w-full max-h-full object-contain transition-opacity duration-700 ease-in-out ${isTalking ? "opacity-0" : "opacity-100"
                    }`}
                draggable={false}
            />

            {/* Talking video */}
            <video
                ref={videoRef}
                src="/IMG_2476.MOV"
                loop
                muted
                playsInline
                className={`absolute max-w-full max-h-full object-contain transition-opacity duration-700 ease-in-out ${isTalking ? "opacity-100" : "opacity-0"
                    }`}
            />
        </div>
    );
}