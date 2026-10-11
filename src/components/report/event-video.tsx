"use client";
import { useState } from "react";
import Image from "next/image";
import { Play, ArrowUpRight, X } from "lucide-react";
import { eventVideo } from "@/lib/domain/event-video";

export function EventVideo({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [failedPoster, setFailedPoster] = useState("");
  const video = eventVideo(url);
  if (!video) return null;
  return (
    <div className="event-video">
      <div className={`event-video-stage ${playing ? "is-playing" : ""}`}>
        {playing ? (
          <>
            <iframe
              src={video.embed}
              title={title}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
            <button
              type="button"
              className="event-video-close"
              aria-label="動画を閉じて表紙に戻る"
              onClick={() => setPlaying(false)}
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            className="event-play"
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${title}を${video.provider}で再生`}
          >
            {video.poster && failedPoster !== video.poster && (
              <Image
                src={video.poster}
                alt=""
                fill
                sizes="(max-width: 700px) 100vw, (max-width: 1200px) 60vw, 720px"
                className="event-poster"
                onError={() => setFailedPoster(video.poster!)}
              />
            )}
            <span className="event-video-scrim" aria-hidden="true" />
            <span className="event-video-overline" aria-hidden="true">
              PRORIUM / EVENT FILM
            </span>
            <span className="event-play-icon" aria-hidden="true">
              <Play size={26} fill="currentColor" />
            </span>
            <span className="event-video-caption">
              <span className="event-video-title">{title}</span>
              <span className="event-video-mobile-label">映像を見る</span>
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
        再生時に{video.provider}のプレーヤーを読み込みます。
      </p>
    </div>
  );
}
