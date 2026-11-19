import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  Film,
  Globe,
  Lock,
  Play,
  RotateCw,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AdCampaignKind, AdNetworkConfig, VideoAdCampaign } from '../types';

interface VideoAdPlayerModalProps {
  campaign: VideoAdCampaign;
  adNetwork: AdNetworkConfig;
  initialSmartlinkLaunched?: boolean;
  nextSmartlinkUrl?: string;
  onClaimed: (rewardBdt: number) => Promise<void>;
  onWatchAnother: () => void;
  onClose: () => void;
}

export default function VideoAdPlayerModal({
  campaign,
  adNetwork,
  initialSmartlinkLaunched = false,
  nextSmartlinkUrl = '',
  onClaimed,
  onWatchAnother,
  onClose,
}: VideoAdPlayerModalProps) {
  const [phase, setPhase] = useState<'starting' | 'playing' | 'claiming' | 'claimed' | 'error'>('starting');
  const [watchToken, setWatchToken] = useState('');
  const [adKind, setAdKind] = useState<AdCampaignKind>(campaign.adKind || 'video');
  const [durationSeconds, setDurationSeconds] = useState<number>(campaign.durationSeconds || 30);
  const [rewardBdt, setRewardBdt] = useState<number>(campaign.rewardBdt || 0.3);
  const [dashboardRules, setDashboardRules] = useState<string[]>([]);
  const [requireSmartlinkClick, setRequireSmartlinkClick] = useState(true);
  const [mediaUrl, setMediaUrl] = useState('');
  const [resolvedSmartlink, setResolvedSmartlink] = useState(
    campaign.thirdPartyTagUrl?.trim() || adNetwork.primarySmartlinkUrl?.trim() || ''
  );
  const [placementMeta, setPlacementMeta] = useState({
    zoneName: campaign.zoneName || adNetwork.zoneName || 'smart-link-3562738',
    placementName: campaign.placementName || adNetwork.placementName || 'Smartlink_1',
    placementId: campaign.placementId || adNetwork.placementId || '32355300',
  });
  const [videoFailed, setVideoFailed] = useState(false);
  const [showSponsorFrame, setShowSponsorFrame] = useState(false);
  const [smartlinkLaunched, setSmartlinkLaunched] = useState(initialSmartlinkLaunched);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tabPaused, setTabPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAllowedVideoTimeRef = useRef(0);
  const claimTriggeredRef = useRef(false);
  const smartlinkLaunchedRef = useRef(smartlinkLaunched);

  useEffect(() => {
    smartlinkLaunchedRef.current = smartlinkLaunched;
  }, [smartlinkLaunched]);

  // Start server watch session immediately on mount
  useEffect(() => {
    let cancelled = false;
    async function startSession() {
      setPhase('starting');
      setErrorMsg('');
      setElapsedMs(0);
      setVideoFailed(false);
      claimTriggeredRef.current = false;
      lastAllowedVideoTimeRef.current = 0;

      try {
        const res = await apiRequest<{
          ok: boolean;
          watchToken: string;
          adKind?: AdCampaignKind;
          dashboardRules?: string[];
          requireSmartlinkClick?: boolean;
          resolvedMediaUrl: string;
          resolvedSmartlinkUrl?: string;
          placementMeta?: { zoneName: string; placementName: string; placementId: string };
          durationSeconds: number;
          rewardBdt: number;
        }>('/api/ads/start', {
          method: 'POST',
          body: JSON.stringify({ adId: campaign.id }),
        });

        if (cancelled) return;
        setWatchToken(res.watchToken);
        if (res.adKind) setAdKind(res.adKind);
        if (Array.isArray(res.dashboardRules)) setDashboardRules(res.dashboardRules);
        if (typeof res.requireSmartlinkClick === 'boolean') {
          setRequireSmartlinkClick(res.requireSmartlinkClick);
        }
        setMediaUrl(res.resolvedMediaUrl || '');
        if (res.resolvedSmartlinkUrl) {
          setResolvedSmartlink(res.resolvedSmartlinkUrl);
        }
        if (res.placementMeta) {
          setPlacementMeta(res.placementMeta);
        }
        setDurationSeconds(res.durationSeconds);
        setRewardBdt(res.rewardBdt);
        setPhase('playing');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to initialize ad playback.');
        setPhase('error');
      }
    }

    void startSession();
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  // Load optional custom invoke/popunder/banner script configured by owner
  useEffect(() => {
    if (phase !== 'playing') return;
    const customScript = adNetwork.customScriptUrl?.trim();
    if (customScript && /^https?:\/\//i.test(customScript)) {
      const existing = document.querySelector(`script[data-okb-ad-src="${customScript}"]`);
      if (!existing) {
        const script = document.createElement('script');
        script.src = customScript;
        script.async = true;
        script.dataset.okbAdSrc = customScript;
        document.body.appendChild(script);
      }
    }
  }, [phase, adNetwork.customScriptUrl]);

  // Rule-enforced timer: waits for Smartlink click if required by dashboard rules,
  // and keeps running seamlessly while viewing the external Smartlink tab.
  useEffect(() => {
    if (phase !== 'playing') return;

    function handleVisibility() {
      const hidden = document.hidden;
      const allowExternalAdTab = smartlinkLaunchedRef.current && Boolean(resolvedSmartlink);
      const shouldPause = hidden && !allowExternalAdTab;
      setTabPaused(shouldPause);
      if (videoRef.current) {
        if (shouldPause) {
          videoRef.current.pause();
        } else {
          void videoRef.current.play().catch(() => undefined);
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    let lastTick = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      if (requireSmartlinkClick && resolvedSmartlink && !smartlinkLaunchedRef.current) {
        return;
      }

      const allowExternalAdTab = smartlinkLaunchedRef.current && Boolean(resolvedSmartlink);
      if (document.hidden && !allowExternalAdTab) {
        setTabPaused(true);
        return;
      }
      setTabPaused(false);

      setElapsedMs((prev) => Math.min(durationSeconds * 1000, prev + delta));
    }, 100);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [phase, durationSeconds, resolvedSmartlink, requireSmartlinkClick]);

  // Trigger server claim once full non-skippable duration finishes
  useEffect(() => {
    if (phase !== 'playing') return;
    if (elapsedMs < durationSeconds * 1000 || claimTriggeredRef.current || !watchToken) return;

    claimTriggeredRef.current = true;
    setPhase('claiming');

    apiRequest<{ ok: boolean; rewardBdt: number }>('/api/ads/claim', {
      method: 'POST',
      body: JSON.stringify({
        watchToken,
        smartlinkClicked: smartlinkLaunchedRef.current || !requireSmartlinkClick || !resolvedSmartlink,
      }),
    })
      .then(async (res) => {
        setPhase('claimed');
        await onClaimed(res.rewardBdt);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to credit ad reward.');
        setPhase('error');
      });
  }, [elapsedMs, durationSeconds, phase, watchToken, requireSmartlinkClick, resolvedSmartlink, onClaimed]);

  // Canvas fallback only if video ad fails to load MP4
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'claiming') return;
    if (adKind !== 'video' || (mediaUrl && !videoFailed) || showSponsorFrame) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const accent = campaign.accentHex || '#059669';

    function renderFrame(time: number) {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const t = time * 0.001;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#070b14');
      grad.addColorStop(0.55, '#0b1220');
      grad.addColorStop(1, '#111c33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = accent;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const baseY = h * (0.35 + i * 0.18);
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 24) {
          const y = baseY + Math.sin(x * 0.012 + t * (1.4 + i * 0.35) + i) * 28;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      const pulse = 1 + Math.sin(t * 2.5) * 0.015;
      ctx.save();
      ctx.translate(w / 2, h / 2 - 8);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-230, -82, 460, 164, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${placementMeta.placementName} · ID ${placementMeta.placementId}`, 0, -45);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px Inter, system-ui, sans-serif';
      ctx.fillText(campaign.companyName, 0, -6);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 13px Inter, system-ui, sans-serif';
      const clippedTitle = campaign.title.length > 50 ? `${campaign.title.slice(0, 48)}...` : campaign.title;
      ctx.fillText(clippedTitle, 0, 22);

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(-125, 40, 250, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(`REWARD +${rewardBdt.toFixed(2)} BDT (${Math.round(rewardBdt * 100)} PAISA)`, 0, 57);

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    }

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [phase, adKind, mediaUrl, videoFailed, showSponsorFrame, campaign, rewardBdt, placementMeta]);

  const waitingForClick =
    phase === 'playing' && requireSmartlinkClick && Boolean(resolvedSmartlink) && !smartlinkLaunched;
  const progressPct = Math.min(100, (elapsedMs / (durationSeconds * 1000)) * 100);
  const secondsLeft = Math.max(0, Math.ceil(durationSeconds - elapsedMs / 1000));
  const paisaAmount = Math.round(rewardBdt * 100);
  const watchAnotherHref = nextSmartlinkUrl || resolvedSmartlink;
  const isVideo = adKind === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#0b1220] border border-slate-700/80 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl text-white">
        {/* Player Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {campaign.id} · {placementMeta.placementName} (ID: {placementMeta.placementId}) ·{' '}
                {isVideo ? 'Video Ad (৩০ পয়সা)' : 'Other Ad (১০ পয়সা)'}
              </span>
            </div>
            <p className="text-sm font-bold text-white truncate mt-0.5">{campaign.companyName}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {phase === 'playing' ? (
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono-num font-bold flex items-center gap-1.5 text-amber-300">
                <Lock className="w-3.5 h-3.5" />
                <span>{waitingForClick ? 'Open Ad First' : `${secondsLeft}s বাকি`}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Ad Modal"
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Smartlink Action Strip */}
        {(phase === 'playing' || phase === 'claiming') && resolvedSmartlink && (
          <div className="px-4 py-2.5 bg-emerald-950/70 border-b border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 text-[11px]">
              <p className="font-bold text-emerald-300 truncate">
                {smartlinkLaunched
                  ? `Smartlink ওপেন হয়েছে (${placementMeta.placementName}) — ${secondsLeft} সেকেন্ড পর +${paisaAmount} পয়সা যোগ হবে`
                  : `রুলস অনুযায়ী লাইভ বিজ্ঞাপন (${placementMeta.placementName}) ওপেন করে ${durationSeconds} সেকেন্ড দেখুন`}
              </p>
            </div>
            <a
              href={resolvedSmartlink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSmartlinkLaunched(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
            >
              <span>{smartlinkLaunched ? 'Re-open Live Ad' : 'Open Real Ad Now'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Viewport */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {phase === 'starting' && (
            <div className="text-center space-y-2 p-6">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-300">অ্যাড ও ড্যাশবোর্ড রুলস যাচাই হচ্ছে...</p>
            </div>
          )}

          {(phase === 'playing' || phase === 'claiming') && (
            <>
              {showSponsorFrame && resolvedSmartlink ? (
                <iframe
                  src={resolvedSmartlink}
                  title={`${campaign.companyName} Live Ad`}
                  className="w-full h-full border-0 bg-white"
                />
              ) : isVideo ? (
                mediaUrl && !videoFailed ? (
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    autoPlay
                    loop
                    playsInline
                    muted={muted}
                    disablePictureInPicture
                    controls={false}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.playbackRate = 1;
                    }}
                    onTimeUpdate={(e) => {
                      const current = e.currentTarget.currentTime;
                      if (current > lastAllowedVideoTimeRef.current + 1.5) {
                        e.currentTarget.currentTime = lastAllowedVideoTimeRef.current;
                      } else {
                        lastAllowedVideoTimeRef.current = Math.max(lastAllowedVideoTimeRef.current, current);
                      }
                      if (e.currentTarget.playbackRate !== 1) {
                        e.currentTarget.playbackRate = 1;
                      }
                    }}
                    onSeeking={(e) => {
                      e.currentTarget.currentTime = lastAllowedVideoTimeRef.current;
                    }}
                    onError={() => setVideoFailed(true)}
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={720}
                    height={405}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                /* Other Ads (Direct / Express) Verification Stage */
                <div className="w-full h-full bg-gradient-to-br from-[#070b14] via-[#0b1220] to-[#0f1f3a] p-5 sm:p-7 flex flex-col justify-center items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      {placementMeta.placementName} · Zone {placementMeta.zoneName} · ID {placementMeta.placementId}
                    </p>
                    <h3 className="text-lg font-bold text-white">{campaign.title}</h3>
                    <p className="text-xs text-slate-300">
                      {smartlinkLaunched
                        ? `বিজ্ঞাপনটি ওপেন আছে — আর ${secondsLeft} সেকেন্ড অপেক্ষা করলেই +${paisaAmount} পয়সা যোগ হবে।`
                        : `নিচের বাটনে ক্লিক করে বিজ্ঞাপনটি ওপেন করুন এবং ${durationSeconds} সেকেন্ড দেখুন।`}
                    </p>
                  </div>
                  {dashboardRules.length > 0 && (
                    <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 text-left max-w-md w-full space-y-1">
                      {dashboardRules.slice(0, 2).map((rule, idx) => (
                        <p key={idx} className="text-[11px] text-slate-300">
                          • {rule}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Overlay controls: Mode toggle / Mute — NO skip or scrub controls */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  {isVideo ? <Film className="w-3.5 h-3.5 text-emerald-400" /> : <Eye className="w-3.5 h-3.5 text-sky-400" />}
                  <span>Non-Skippable · স্কিপ করা যাবে না</span>
                </span>
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  {resolvedSmartlink && (
                    <button
                      type="button"
                      onClick={() => setShowSponsorFrame((v) => !v)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-black/75 hover:bg-emerald-700 border border-white/15 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{showSponsorFrame ? (isVideo ? 'HD Video' : 'Rule Status') : 'Frame View'}</span>
                    </button>
                  )}
                  {isVideo && !showSponsorFrame && mediaUrl && !videoFailed && (
                    <button
                      type="button"
                      onClick={() => setMuted((m) => !m)}
                      className="min-w-[34px] min-h-[34px] rounded-lg bg-black/75 border border-white/15 text-white flex items-center justify-center cursor-pointer"
                      aria-label={muted ? 'Unmute' : 'Mute'}
                    >
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {waitingForClick && resolvedSmartlink && (
                <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center z-10 space-y-3">
                  <Lock className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">ড্যাশবোর্ড রুলস: আগে লাইভ এড ওপেন করুন</p>
                    <p className="text-xs text-slate-300 mt-1 max-w-sm">
                      এই বাটনে ক্লিক করে {placementMeta.placementName} বিজ্ঞাপন ওপেন করলেই {durationSeconds} সেকেন্ডের টাইমার শুরু হবে।
                    </p>
                  </div>
                  <a
                    href={resolvedSmartlink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSmartlinkLaunched(true)}
                    className="btn-primary btn-sm"
                  >
                    <span>Open {placementMeta.placementName} Now</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {tabPaused && !waitingForClick && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
                  <Lock className="w-8 h-8 text-amber-400 mb-2" />
                  <p className="text-sm font-bold text-white">অ্যাড পজ হয়ে গেছে</p>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm">
                    ট্যাব পরিবর্তন বা স্কিপ করা যাবে না। রিওয়ার্ড পেতে অনুগ্রহ করে এডটি দেখুন।
                  </p>
                </div>
              )}

              {phase === 'claiming' && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center z-10">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-2" />
                  <p className="text-xs font-semibold text-emerald-300">মেইন একাউন্টে +{paisaAmount} পয়সা যোগ করা হচ্ছে...</p>
                </div>
              )}
            </>
          )}

          {phase === 'claimed' && (
            <div className="p-6 text-center space-y-4 max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">অভিনন্দন! রিওয়ার্ড যোগ হয়েছে</h3>
                <p className="text-sm font-bold text-emerald-400 font-mono-num mt-1">
                  +{rewardBdt.toFixed(2)} ৳ ({paisaAmount} পয়সা) মেইন একাউন্টে যোগ হয়েছে
                </p>
                <p className="text-xs text-slate-400 mt-1.5">
                  {campaign.companyName} ({placementMeta.placementName}) · যত খুশি তত এড দেখতে পারবেন।
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-center">
                {watchAnotherHref ? (
                  <a
                    href={watchAnotherHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onWatchAnother}
                    className="btn-primary"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>আরেকটি এড দেখুন</span>
                  </a>
                ) : (
                  <button type="button" onClick={onWatchAnother} className="btn-primary">
                    <RotateCw className="w-4 h-4" />
                    <span>আরেকটি এড দেখুন</span>
                  </button>
                )}
                {resolvedSmartlink && (
                  <a
                    href={resolvedSmartlink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold"
                  >
                    <span>Visit Sponsor</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button type="button" onClick={onClose} className="btn-secondary text-slate-900">
                  ড্যাশবোর্ডে ফিরুন
                </button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="p-6 text-center space-y-3 max-w-md">
              <p className="text-sm font-bold text-rose-400">অ্যাড সম্পন্ন হয়নি</p>
              <p className="text-xs text-slate-300">{errorMsg}</p>
              <button type="button" onClick={onClose} className="btn-gold btn-sm">
                বন্ধ করুন
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar Footer (Read-only, non-interactive) */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800 space-y-2.5">
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-100"
              style={{ width: `${phase === 'claimed' ? 100 : progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 min-w-0">
              <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{campaign.title}</span>
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {resolvedSmartlink && (
                <a
                  href={resolvedSmartlink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSmartlinkLaunched(true)}
                  className="text-emerald-400 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>{placementMeta.placementName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="font-mono-num text-emerald-300 font-semibold">
                +{rewardBdt.toFixed(2)} ৳ ({paisaAmount} পয়সা) · {durationSeconds}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
