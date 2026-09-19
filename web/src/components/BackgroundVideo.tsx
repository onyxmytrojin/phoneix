"use client";

import { useEffect, useRef } from "react";

const VIDEO_PATH = "/media/hero_vid_yellow_v3.mp4";

export default function BackgroundVideo({ className = "bg-video" }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // 0.1s (was 0.01s) — each seek is a real decode-side cost even on the
  // densely-keyframed re-encode (see globals.css .bg-video comment for the
  // GPUTask profiling that found this). At 0.01s, essentially any
  // perceptible mouse movement exceeded the threshold, so a fresh seek
  // fired on nearly every rAF tick during natural cursor movement — the
  // dominant remaining source of scroll-transition jank after the
  // will-change and video re-encode fixes. 0.1s cuts seek frequency
  // substantially (measured: eliminates frames over 50ms in a scripted
  // scroll+mouse-movement test) while staying fine-grained enough that the
  // scrub still feels responsive — a 0.1s step is ~13px of cursor movement
  // across a typical hero width, well under what reads as "steppy".
  const SEEK_THRESHOLD = 0.1;

  const requestSeek = () => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return;

    const diff = Math.abs(video.currentTime - targetTimeRef.current);
    if (diff > SEEK_THRESHOLD) {
      isSeekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    }
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;
    const video = videoRef.current;
    if (!video) return;

    const diff = Math.abs(video.currentTime - targetTimeRef.current);
    if (diff > SEEK_THRESHOLD) {
      isSeekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    }
  };

  // Absolute mapping: cursor at the far left = time 0 (character looking
  // left, smiling — toward the cursor), cursor at the far right = end of
  // the clip. Deterministic by position, not by how the mouse got there.
  const setTargetFromX = (clientX: number) => {
    const duration = videoRef.current?.duration || durationRef.current;
    if (!duration || isNaN(duration)) return;

    const fraction = Math.min(Math.max(clientX / window.innerWidth, 0), 1);
    targetTimeRef.current = fraction * duration;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setTargetFromX(e.clientX);

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      setTargetFromX(e.touches[0].clientX);
    };

    // Mouse/touch events can fire far more often than the video can decode
    // seeks (or than the screen even repaints) — updating targetTimeRef on
    // every event but only *seeking* once per animation frame keeps input
    // sampling cheap while capping seek requests to a rate the video can
    // actually keep up with, instead of queuing up a backlog of stale seeks.
    const tick = () => {
      requestSeek();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchstart", handleTouchMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      durationRef.current = videoRef.current.duration;
      targetTimeRef.current = 0;
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div id="hero-bg-video" className={className}>
      <video
        ref={videoRef}
        src={VIDEO_PATH}
        muted
        playsInline
        preload="auto"
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        className="bg-video-inner"
      />
    </div>
  );
}
