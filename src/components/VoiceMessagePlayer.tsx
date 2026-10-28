import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isMe: boolean;
  isHumorMode?: boolean;
  isLoveMode?: boolean;
  isMidnightMode?: boolean;
}

// Generate realistic pseudo-waveform heights based on audio length/seed
function generateWaveBars(seed: string, count: number = 26): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = Math.abs(Math.sin((hash + i * 17) * 0.45) * 0.7 + Math.cos((hash + i * 31) * 0.3) * 0.3);
    // Height between 20% and 95%
    bars.push(Math.max(20, Math.min(95, Math.round(val * 100))));
  }
  return bars;
}

const VoiceMessagePlayerComponent: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  isMe,
  isHumorMode = false,
  isLoveMode = false,
  isMidnightMode = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveBarsRef = useRef<number[]>(generateWaveBars(audioUrl.slice(-40) || 'audio', 24));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause any other playing audio in document
      document.querySelectorAll('audio').forEach((a) => {
        if (a !== audio && !a.paused) a.pause();
      });
      audio.play().catch((err) => console.warn('Audio play error:', err));
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const totalBars = waveBarsRef.current.length;
    const targetTime = (index / totalBars) * (audioDuration || 1);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    if (!isPlaying) {
      audio.play().catch(() => {});
    }
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    audio.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
  };

  const formatSecs = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const currentActiveBarIndex = Math.floor((progressPercent / 100) * waveBarsRef.current.length);

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[210px] sm:min-w-[240px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-90 cursor-pointer ${
            isMe
              ? isHumorMode
                ? 'bg-slate-950 text-amber-400 hover:bg-slate-900'
                : isLoveMode
                  ? 'bg-white text-rose-600 hover:bg-rose-50'
                  : isMidnightMode
                    ? 'bg-white text-purple-900 hover:bg-purple-50 shadow-md'
                    : 'bg-white text-indigo-600 hover:bg-indigo-50'
              : isHumorMode
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : isLoveMode
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : isMidnightMode
                    ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] text-white hover:opacity-90 shadow-md'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          title={isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform Bars */}
        <div 
          className="flex-1 flex items-center gap-[2.5px] h-8 cursor-pointer select-none"
          title="Click to seek"
        >
          {waveBarsRef.current.map((heightPercent, idx) => {
            const isFilled = idx <= currentActiveBarIndex;
            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{ height: `${heightPercent}%` }}
                className={`flex-1 rounded-full min-w-[2.5px] transition-all hover:opacity-100 ${
                  isFilled
                    ? isMe
                      ? isHumorMode
                        ? 'bg-slate-950'
                        : isLoveMode
                          ? 'bg-white'
                          : isMidnightMode
                            ? 'bg-white'
                            : 'bg-white'
                      : isHumorMode
                        ? 'bg-amber-600 dark:bg-amber-400'
                        : isLoveMode
                          ? 'bg-rose-500 dark:bg-pink-400'
                          : isMidnightMode
                            ? 'bg-purple-700 dark:bg-purple-400'
                            : 'bg-indigo-600 dark:bg-indigo-400'
                    : isMe
                      ? isHumorMode
                        ? 'bg-slate-950/30'
                        : isLoveMode
                          ? 'bg-white/40'
                          : isMidnightMode
                            ? 'bg-white/40'
                            : 'bg-white/40'
                      : isHumorMode
                        ? 'bg-amber-300/50 dark:bg-amber-900/40'
                        : isLoveMode
                          ? 'bg-rose-200/60 dark:bg-rose-900/40'
                          : isMidnightMode
                            ? 'bg-purple-200/60 dark:bg-purple-950/60'
                            : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Playback Speed Button */}
        <button
          type="button"
          onClick={cycleSpeed}
          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight transition-colors cursor-pointer shrink-0 ${
            isMe
              ? isHumorMode
                ? 'bg-slate-950/15 text-slate-950 hover:bg-slate-950/25'
                : isLoveMode
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : isMidnightMode
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-white/20 text-white hover:bg-white/30'
              : isHumorMode
                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 hover:bg-amber-200'
                : isLoveMode
                  ? 'bg-pink-100 dark:bg-pink-900/50 text-rose-900 dark:text-pink-200 hover:bg-pink-200'
                  : isMidnightMode
                    ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 hover:bg-purple-200'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
          title="Change playback speed"
        >
          {playbackRate}x
        </button>
      </div>

      {/* Progress & Duration Details */}
      <div
        className={`flex items-center justify-between text-[11px] font-medium px-0.5 ${
          isMe
            ? isHumorMode
              ? 'text-slate-900/80'
              : isLoveMode
                ? 'text-pink-100'
                : isMidnightMode
                  ? 'text-purple-200'
                  : 'text-indigo-100'
            : isHumorMode
              ? 'text-amber-800 dark:text-amber-400'
              : isLoveMode
                ? 'text-rose-500 dark:text-pink-400'
                : isMidnightMode
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <span>{isPlaying ? formatSecs(currentTime) : 'Voice message'}</span>
        <span>{formatSecs(audioDuration || duration)}</span>
      </div>
    </div>
  );
};

export const VoiceMessagePlayer = React.memo(VoiceMessagePlayerComponent);
