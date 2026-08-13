import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanFace, Camera, RotateCcw, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signedPhotoUrl } from "@/lib/huddl";
import { loadMyVerification, submitVerification, type VerifyStatus } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/_app/verify")({
  ssr: false,
  component: VerifyScreen,
});

const CUES = ["Blink slowly", "Turn your head slightly left", "Give a small smile"];

function VerifyScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<VerifyStatus>("unverified");
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [starting, setStarting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cue] = useState(() => CUES[Math.floor(Math.random() * CUES.length)]);

  // Bind the stream once the <video> is actually mounted (avoids the black box
  // caused by attaching srcObject before render).
  useEffect(() => {
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!camOn || !el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  }, [camOn]);


  useEffect(() => {
    (async () => {
      try {
        const v = await loadMyVerification();
        setStatus(v.status);
        setReason(v.rejection_reason);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from("profiles").select("photos").eq("id", user.id).maybeSingle();
          const p = (data as any)?.photos?.[0];
          if (p) setProfilePhoto(await signedPhotoUrl(p));
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCam() {
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
    setVideoReady(false);
  }

  async function startCam() {
    setCamError("");
    setVideoReady(false);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCamError("Camera needs a secure (https) connection. Open Gathr over https and try again.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser doesn't support camera capture. Try Chrome or Safari.");
      return;
    }

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
    } catch (e: any) {
      const name = e?.name ?? "";
      setCamError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access needed — please allow camera permissions for this site in your browser settings, then tap Try again."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "No front camera was found on this device."
            : name === "NotReadableError"
              ? "Your camera is being used by another app. Close it and try again."
              : "We couldn't open your camera on this device. Please try again.",
      );
      setCamOn(false);
    } finally {
      setStarting(false);
    }
  }


  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // mirror back so the saved image reads naturally
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShot({ blob, url: URL.createObjectURL(blob) });
        stopCam();
      },
      "image/jpeg",
      0.9,
    );
  }

  async function submit() {
    if (!shot) return;
    setSaving(true);
    try {
      await submitVerification(shot.blob);
      setStatus("pending");
      setShot(null);
      toast.success("Verification submitted");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't submit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-32">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button
          onClick={() => (history.length > 1 ? history.back() : navigate({ to: "/home" }))}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Verify your account</h1>
      </header>

      <div className="px-5 max-w-md mx-auto space-y-5">
        {status === "verified" && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <CheckCircle2 className="h-8 w-8 text-sky-500 mx-auto" />
            <h2 className="mt-3 font-semibold">You're verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your Verified badge shows next to your name across Gathr.
            </p>
          </div>
        )}

        {status === "pending" && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <Clock className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="mt-3 font-semibold">Verification submitted</h2>
            <p className="mt-1 text-sm text-muted-foreground">Usually reviewed within 24 hours.</p>
          </div>
        )}

        {status === "rejected" && reason && (
          <div className="rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm leading-relaxed">
            Your last submission was rejected: {reason}. You can retake your selfie below.
          </div>
        )}

        {status !== "pending" && status !== "verified" && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0">
                {profilePhoto && <img src={profilePhoto} alt="Your profile photo" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">We'll match this profile photo</div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Take a live selfie now — no gallery uploads. Good light, face fully visible, no sunglasses or hats.
                </p>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden bg-black aspect-square relative">
              {shot ? (
                <img src={shot.url} alt="Captured selfie" className="h-full w-full object-cover" />
              ) : camOn ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="h-full w-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-center text-white text-sm font-medium bg-gradient-to-t from-black/70 to-transparent">
                    {cue}, then capture
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-white/80 gap-3 px-6 text-center">
                  <ScanFace className="h-10 w-10" />
                  <p className="text-sm">Your camera opens in live mode — a photo of a photo won't pass review.</p>
                </div>
              )}
            </div>

            {camError && <p className="text-sm text-destructive">{camError}</p>}

            {!camOn && !shot && (
              <button
                onClick={startCam}
                className="w-full rounded-full bg-sky-500 text-white py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" /> Open camera
              </button>
            )}

            {camOn && (
              <button onClick={capture} className="w-full rounded-full bg-sky-500 text-white py-3 text-sm font-semibold">
                Capture selfie
              </button>
            )}

            {shot && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShot(null);
                    startCam();
                  }}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" /> Retake
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="flex-1 rounded-full bg-sky-500 text-white py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? "Submitting…" : "Submit"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
