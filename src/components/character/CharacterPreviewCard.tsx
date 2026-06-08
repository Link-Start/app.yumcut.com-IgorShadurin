"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pause, Play, RotateCcw, Star, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicCharacter } from './catalog';

export function CharacterPreviewCard({
  item,
  showName = true,
  showFooterOverlay = true,
  showPlaybackButton = false,
  showFavoriteButton = false,
  isFavorited = false,
  favoriteSubmitting = false,
  onToggleFavorite,
  href,
  className,
}: {
  item: PublicCharacter;
  showName?: boolean;
  showFooterOverlay?: boolean;
  showPlaybackButton?: boolean;
  showFavoriteButton?: boolean;
  isFavorited?: boolean;
  favoriteSubmitting?: boolean;
  onToggleFavorite?: () => void;
  href?: string;
  className?: string;
}) {
  const isClickable = Boolean(href);
  const hasVideoPreview = typeof item.previewVideoUrl === 'string' && item.previewVideoUrl.trim().length > 0;
  const previewHasAudio = item.previewVideoHasAudio !== false;
  const [videoActivated, setVideoActivated] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pendingHoverPlay, setPendingHoverPlay] = useState(false);
  const [manualPlaybackPinned, setManualPlaybackPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const prevFavoritedRef = useRef(isFavorited);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPreview = () => {
    if (!hasVideoPreview) return;
    setHovering(true);
    setVideoActivated(true);
    setPendingHoverPlay(true);
  };

  const stopPreview = () => {
    if (!hasVideoPreview) return;
    setHovering(false);
    setPendingHoverPlay(false);
    if (manualPlaybackPinned) return;
    const node = videoRef.current;
    if (!node) return;
    node.pause();
    node.currentTime = 0;
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!hasVideoPreview) return;
    if (!videoActivated || !hovering || !pendingHoverPlay) return;
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    const tryPlay = async () => {
      if (disposed) return;
      video.currentTime = 0;
      try {
        await video.play();
        if (!disposed) {
          setIsPlaying(true);
          setPendingHoverPlay(false);
        }
      } catch {
        if (!disposed) {
          setIsPlaying(false);
          setPendingHoverPlay(false);
        }
      }
    };

    if (video.readyState >= 2) {
      setVideoReady(true);
      void tryPlay();
      return () => {
        disposed = true;
      };
    }

    const onReady = () => {
      setVideoReady(true);
      void tryPlay();
    };

    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.load();

    return () => {
      disposed = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
    };
  }, [hasVideoPreview, hovering, pendingHoverPlay, videoActivated]);

  useEffect(() => {
    if (prevFavoritedRef.current === isFavorited) return;
    prevFavoritedRef.current = isFavorited;
    setFavoriteAnimating(true);
    const timer = setTimeout(() => setFavoriteAnimating(false), 260);
    return () => clearTimeout(timer);
  }, [isFavorited]);

  const toggleManualPlayback = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!hasVideoPreview) return;
    const node = videoRef.current;
    if (!node) {
      setVideoActivated(true);
      setHovering(true);
      setPendingHoverPlay(true);
      setManualPlaybackPinned(true);
      return;
    }

    if (!node.paused) {
      node.pause();
      setManualPlaybackPinned(false);
      setIsPlaying(false);
      return;
    }

    setVideoActivated(true);
    setManualPlaybackPinned(true);
    setHovering(true);
    setPendingHoverPlay(true);
  };

  const restartPreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!hasVideoPreview) return;
    const node = videoRef.current;
    if (!node) {
      setVideoActivated(true);
      setHovering(true);
      setPendingHoverPlay(true);
      setManualPlaybackPinned(true);
      return;
    }
    node.currentTime = 0;
    setVideoActivated(true);
    setHovering(true);
    setPendingHoverPlay(true);
    setManualPlaybackPinned(true);
  };

  const toggleAudio = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!hasVideoPreview || !previewHasAudio) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    const node = videoRef.current;
    if (node) {
      node.muted = nextMuted;
      if (!nextMuted && node.paused) {
        setVideoActivated(true);
        setHovering(true);
        setPendingHoverPlay(true);
        setManualPlaybackPinned(true);
      }
    }
  };

  const shouldShowVideoLayer = (hovering || manualPlaybackPinned) && videoActivated;

  const handleToggleFavorite = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (favoriteSubmitting) return;
    onToggleFavorite?.();
  };

  const body = (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white',
        'focus-within:ring-2 focus-within:ring-blue-500',
        isClickable && 'cursor-pointer',
        className,
      )}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
    >
      <div className="relative aspect-[9/16] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewImageUrl}
          alt={`${item.name} preview`}
          loading="lazy"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            videoReady && shouldShowVideoLayer && (isPlaying || manualPlaybackPinned) ? 'opacity-0' : 'opacity-100',
          )}
        />

        {hasVideoPreview && videoActivated ? (
          <video
            ref={videoRef}
            src={item.previewVideoUrl!}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-150',
              shouldShowVideoLayer ? 'opacity-100' : 'opacity-0',
            )}
          />
        ) : null}

        {showPlaybackButton && hasVideoPreview ? (
          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleManualPlayback}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] bg-[#1a1b1f]/74 text-white/84 backdrop-blur transition hover:bg-cyan-300/[0.18] hover:text-cyan-50"
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              type="button"
              onClick={restartPreview}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] bg-[#1a1b1f]/74 text-white/84 backdrop-blur transition hover:bg-cyan-300/[0.18] hover:text-cyan-50"
              aria-label="Restart preview"
            >
              <RotateCcw className="size-4" />
            </button>
            {previewHasAudio ? (
              <button
                type="button"
                onClick={toggleAudio}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] bg-[#1a1b1f]/74 text-white/84 backdrop-blur transition hover:bg-cyan-300/[0.18] hover:text-cyan-50"
                aria-label={isMuted ? 'Enable audio' : 'Disable audio'}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            ) : null}
          </div>
        ) : null}

        {showFavoriteButton ? (
          <div className="absolute right-2 top-2 z-20">
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1a1b1f]/74 text-white/84 backdrop-blur transition-colors duration-250 hover:bg-amber-300/[0.18] hover:text-amber-50"
              aria-label={isFavorited ? 'Remove favorite' : 'Add favorite'}
              disabled={favoriteSubmitting}
            >
              <Star
                className={cn(
                  'size-4 transition-all duration-250 ease-out',
                  isFavorited ? 'fill-current text-amber-300' : '',
                  favoriteAnimating && isFavorited ? 'scale-125 rotate-[12deg]' : '',
                  favoriteAnimating && !isFavorited ? 'scale-90 -rotate-[12deg]' : '',
                )}
              />
            </button>
          </div>
        ) : null}

        {showFooterOverlay ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
        ) : null}

        {showName ? (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white">
            <div className="truncate text-sm font-semibold leading-none">{item.name}</div>
          </div>
        ) : null}
      </div>
    </article>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block cursor-pointer" aria-label={`Open ${item.name} character page`}>
      {body}
    </Link>
  );
}
