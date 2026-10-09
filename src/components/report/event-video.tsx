"use client";
import { useState } from "react";
import { Play, ArrowUpRight } from "lucide-react";
import { eventVideo } from "@/lib/domain/event-video";

export function EventVideo({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const video = eventVideo(url);
  if (!video) return null;
  return (
    <div className="event-video">
      <div className="event-video-stage">
        {playing ? (
          <iframe
            src={video.embed}
            title={title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : (
          <button
            className="event-play"
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${title}を${video.provider}で再生`}
          >
            <span className="event-play-icon">
              <Play size={26} fill="currentColor" />
            </span>
            <span>
              {title}
              <small>{video.provider} · クリックして再生</small>
            </span>
          </button>
        )}
      </div>
      <a
        className="event-video-link"
        href={video.watch}
        target="_blank"
        rel="noopener noreferrer"
      >
        {video.provider}で動画を開く
        <ArrowUpRight size={14} />
      </a>
      <p className="event-video-notice">
        再生すると{video.provider}に接続します。
      </p>
    </div>
  );
}
