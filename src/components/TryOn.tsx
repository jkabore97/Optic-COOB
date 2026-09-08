"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { COLOR_LABELS, COLOR_SWATCH, FRAMES, formatFcfa, frameImageUrl, type Frame } from "@/lib/frames";

/**
 * Essayage virtuel : détection des repères du visage dans le navigateur (MediaPipe
 * Face Landmarker) et superposition du visuel de la monture. Aucune image n'est envoyée
 * à un serveur.
 *
 * Repère des visuels : viewBox 1000×400, centres des verres en (290,200) et (710,200).
 */

// Fichiers servis depuis notre domaine (voir scripts/setup-mediapipe.mjs). Surchargeables
// par NEXT_PUBLIC_MEDIAPIPE_WASM_URL / NEXT_PUBLIC_FACE_MODEL_URL pour utiliser un CDN.
const WASM_URL = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_URL ?? "/mediapipe/wasm";
const MODEL_URL = process.env.NEXT_PUBLIC_FACE_MODEL_URL ?? "/mediapipe/face_landmarker.task";

const SVG_W = 1000;
const SVG_H = 400;
const SVG_PD = 420; // distance entre les centres des verres dans le visuel
const SVG_MID = { x: 500, y: 200 };

type Mode = "camera" | "photo";
type Status = "idle" | "loading" | "ready" | "error";

interface Pose {
  /** Point milieu entre les pupilles, en pixels de l'élément affiché. */
  mid: { x: number; y: number };
  /** Angle d'inclinaison (roulis) en radians. */
  angle: number;
  /** Facteur d'échelle du visuel (pixels affichés / unités SVG). */
  scale: number;
}

interface Point {
  x: number;
  y: number;
}

function midpoint(pts: NormalizedLandmark[]): Point {
  const n = pts.length;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** Calcule les centres des deux pupilles (coordonnées normalisées 0–1). */
function pupils(lm: NormalizedLandmark[]): { a: Point; b: Point } | null {
  if (lm.length >= 478) {
    // Iris : 468 (œil droit du sujet) et 473 (œil gauche du sujet)
    return { a: lm[468], b: lm[473] };
  }
  if (lm.length >= 468) {
    return { a: midpoint([lm[33], lm[133]]), b: midpoint([lm[362], lm[263]]) };
  }
  return null;
}

/** Zone réellement peinte d'une source en object-contain, relative à l'élément. */
function paintedBox(el: HTMLVideoElement | HTMLImageElement) {
  const nw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const nh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  if (!nw || !nh || !cw || !ch) return null;
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

function poseFromPupils(a: Point, b: Point, w: number, h: number): Pose {
  const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h;
  // Garantit que `a` est à gauche dans l'image (x plus petit)
  const [lx, ly, rx, ry] = ax <= bx ? [ax, ay, bx, by] : [bx, by, ax, ay];
  const dx = rx - lx, dy = ry - ly;
  return {
    mid: { x: (lx + rx) / 2, y: (ly + ry) / 2 },
    angle: Math.atan2(dy, dx),
    scale: Math.hypot(dx, dy) / SVG_PD,
  };
}

function smooth(prev: Pose | null, next: Pose, alpha = 0.45): Pose {
  if (!prev) return next;
  return {
    mid: { x: prev.mid.x + (next.mid.x - prev.mid.x) * alpha, y: prev.mid.y + (next.mid.y - prev.mid.y) * alpha },
    angle: prev.angle + (next.angle - prev.angle) * alpha,
    scale: prev.scale + (next.scale - prev.scale) * alpha,
  };
}

export function TryOn({ initialSlug }: { initialSlug?: string }) {
  const [frame, setFrame] = useState<Frame>(() => FRAMES.find((f) => f.slug === initialSlug) ?? FRAMES[0]);
  const [mode, setMode] = useState<Mode>("camera");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [pose, setPose] = useState<Pose | null>(null);
  const [faceSeen, setFaceSeen] = useState(false);
  const [sizeAdj, setSizeAdj] = useState(1);
  const [yAdj, setYAdj] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const poseRef = useRef<Pose | null>(null);
  const lastVideoTime = useRef(-1);
  const runningMode = useRef<"VIDEO" | "IMAGE">("VIDEO");

  /** Charge le modèle une seule fois. */
  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus("loading");
    setMessage("Chargement du module de détection du visage (quelques Mo la première fois, puis mis en cache)…");
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const create = (delegate: "GPU" | "CPU") =>
      vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: runningMode.current,
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    let lm: FaceLandmarker;
    try {
      lm = await create("GPU");
    } catch {
      lm = await create("CPU");
    }
    landmarkerRef.current = lm;
    return lm;
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const setRunningMode = useCallback(async (m: "VIDEO" | "IMAGE") => {
    if (runningMode.current === m) return;
    runningMode.current = m;
    await landmarkerRef.current?.setOptions({ runningMode: m });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      setSnapshot(null);
      await ensureLandmarker();
      await setRunningMode("VIDEO");
      setMessage("Accès à la caméra…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      poseRef.current = null;
      lastVideoTime.current = -1;
      setStatus("ready");
      setMessage("");

      /** Boucle de détection vidéo. */
      const tick = () => {
        const lm = landmarkerRef.current;
        if (lm && video.readyState >= 2 && video.currentTime !== lastVideoTime.current) {
          lastVideoTime.current = video.currentTime;
          const res = lm.detectForVideo(video, performance.now());
          const face = res.faceLandmarks[0];
          const p = face ? pupils(face) : null;
          const box = p ? paintedBox(video) : null;
          if (p && box) {
            const next = poseFromPupils(p.a, p.b, box.width, box.height);
            poseRef.current = smooth(poseRef.current, next);
            setPose(poseRef.current);
            setFaceSeen(true);
          } else {
            setFaceSeen(false);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setStatus("error");
      const name = (err as Error)?.name;
      setMessage(
        name === "NotAllowedError" || name === "SecurityError"
          ? "L'accès à la caméra a été refusé. Autorisez la caméra dans votre navigateur, ou utilisez une photo."
          : name === "NotFoundError"
            ? "Aucune caméra détectée. Vous pouvez importer une photo à la place."
            : "Impossible de démarrer l'essayage. Vérifiez votre connexion et réessayez, ou importez une photo.",
      );
    }
  }, [ensureLandmarker, setRunningMode, stopCamera]);

  const detectPhoto = useCallback(async () => {
    const img = photoRef.current;
    if (!img || !img.complete) return;
    try {
      const lm = await ensureLandmarker();
      await setRunningMode("IMAGE");
      const res = lm.detect(img);
      const face = res.faceLandmarks[0];
      const p = face ? pupils(face) : null;
      if (!p) {
        setFaceSeen(false);
        setPose(null);
        setStatus("ready");
        setMessage("Aucun visage détecté sur cette photo. Essayez une photo de face, bien éclairée.");
        return;
      }
      const box = paintedBox(img)!;
      const next = poseFromPupils(p.a, p.b, box.width, box.height);
      poseRef.current = next;
      setPose(next);
      setFaceSeen(true);
      setStatus("ready");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Impossible d'analyser cette photo. Réessayez avec une autre image.");
    }
  }, [ensureLandmarker, setRunningMode]);

  const onPhotoChosen = (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    setSnapshot(null);
    setPose(null);
    setFaceSeen(false);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setMode("photo");
    setStatus("loading");
    setMessage("Analyse de la photo…");
  };

  const switchToCamera = () => {
    setMode("camera");
    setPose(null);
    setFaceSeen(false);
    setStatus("idle");
    setMessage("");
  };

  // Nettoyage à la sortie de la page
  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stopCamera]);

  const overlayStyle = useMemo(() => {
    if (!pose) return { display: "none" } as const;
    const s = pose.scale * sizeAdj;
    return {
      display: "block",
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: SVG_W,
      height: SVG_H,
      maxWidth: "none",
      transformOrigin: "0 0",
      transform: `translate(${pose.mid.x}px, ${pose.mid.y}px) rotate(${pose.angle}rad) scale(${s}) translate(${-SVG_MID.x}px, ${-SVG_MID.y + yAdj}px)`,
      pointerEvents: "none" as const,
    };
  }, [pose, sizeAdj, yAdj]);

  /** Capture une image composite (source + monture) pour la partager. */
  const takeSnapshot = () => {
    const src = mode === "camera" ? videoRef.current : photoRef.current;
    const overlay = overlayRef.current;
    if (!src || !overlay || !pose) return;
    const naturalW = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
    const naturalH = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
    const painted = paintedBox(src);
    if (!painted) return;
    const k = naturalW / painted.width;
    const canvas = document.createElement("canvas");
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext("2d")!;
    if (mode === "camera") {
      ctx.translate(naturalW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0, naturalW, naturalH);
    ctx.save();
    ctx.translate(pose.mid.x * k, pose.mid.y * k);
    ctx.rotate(pose.angle);
    const s = pose.scale * sizeAdj * k;
    ctx.scale(s, s);
    ctx.drawImage(overlay, -SVG_MID.x, -SVG_MID.y + yAdj, SVG_W, SVG_H);
    ctx.restore();
    setSnapshot(canvas.toDataURL("image/jpeg", 0.92));
  };

  const mirrored = mode === "camera";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Scène */}
      <div className="lg:col-span-3">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-ink/8 px-4 py-2.5">
            <div className="flex gap-1 rounded-full bg-paper-2 p-1" role="tablist" aria-label="Source de l'image">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "camera"}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "camera" ? "bg-white text-brand-800 shadow-soft" : "text-ink-2"}`}
                onClick={switchToCamera}
              >
                Caméra
              </button>
              <label
                role="tab"
                aria-selected={mode === "photo"}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "photo" ? "bg-white text-brand-800 shadow-soft" : "text-ink-2"}`}
              >
                Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  onChange={(e) => onPhotoChosen(e.target.files?.[0])}
                />
              </label>
            </div>
            <span className={`badge ${faceSeen && status === "ready" ? "bg-green-100 text-green-800" : "bg-paper-2 text-ink-3"}`}>
              {status === "ready" ? (faceSeen ? "Visage détecté" : "Placez-vous face à la caméra") : status === "loading" ? "Chargement…" : "En attente"}
            </span>
          </div>

          <div ref={stageRef} className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
            <div className="absolute inset-0" style={{ transform: mirrored ? "scaleX(-1)" : undefined }}>
              <div className="relative h-full w-full">
                {mode === "camera" ? (
                  <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
                ) : (
                  photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      ref={photoRef}
                      src={photoUrl}
                      alt="Votre photo"
                      className="h-full w-full object-contain"
                      onLoad={() => void detectPhoto()}
                    />
                  )
                )}
                {/* Le conteneur du visuel doit épouser la zone réellement affichée de la vidéo/photo (object-contain). */}
                <OverlayBox sourceRef={mode === "camera" ? videoRef : photoRef}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={overlayRef} src={frameImageUrl(frame)} alt="" style={overlayStyle} crossOrigin="anonymous" />
                </OverlayBox>
              </div>
            </div>

            {(status !== "ready" || (mode === "photo" && !photoUrl)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 p-6 text-center text-white">
                {status === "loading" && (
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                )}
                <p className="max-w-sm text-sm">
                  {message || (mode === "photo" ? "Choisissez une photo de face pour commencer." : "Activez la caméra pour voir la monture sur votre visage, en direct.")}
                </p>
                {status === "idle" && mode === "camera" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className="btn-accent" onClick={() => void startCamera()}>
                      Activer la caméra
                    </button>
                    <label className="btn cursor-pointer bg-white/15 text-white hover:bg-white/25">
                      Utiliser une photo
                      <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                    </label>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className="btn-accent btn-sm" onClick={() => void startCamera()}>
                      Réessayer la caméra
                    </button>
                    <label className="btn btn-sm cursor-pointer bg-white/15 text-white hover:bg-white/25">
                      Importer une photo
                      <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t border-ink/8 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-medium text-ink-2">
              Taille <span className="text-ink-3">({Math.round(sizeAdj * 100)} %)</span>
              <input type="range" min="0.8" max="1.25" step="0.01" value={sizeAdj} onChange={(e) => setSizeAdj(Number(e.target.value))} className="mt-1 w-full accent-brand-700" />
            </label>
            <label className="text-xs font-medium text-ink-2">
              Hauteur
              <input type="range" min="-40" max="40" step="1" value={yAdj} onChange={(e) => setYAdj(Number(e.target.value))} className="mt-1 w-full accent-brand-700" />
            </label>
            <button type="button" className="btn-primary btn-sm" onClick={takeSnapshot} disabled={!pose || status !== "ready"}>
              Prendre une photo
            </button>
          </div>
        </div>

        {snapshot && (
          <div className="card mt-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Votre essayage avec {frame.name} {COLOR_LABELS[frame.color]}</p>
              <div className="flex gap-2">
                <a href={snapshot} download={`essayage-${frame.slug}.jpg`} className="btn-outline btn-sm">
                  Télécharger
                </a>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setSnapshot(null)}>
                  Fermer
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshot} alt="Aperçu de l'essayage" className="mt-3 w-full rounded-xl" />
          </div>
        )}

        <p className="mt-3 text-xs text-ink-3">
          Le traitement se fait entièrement dans votre navigateur : aucune image n&apos;est envoyée à nos serveurs.
          L&apos;essayage virtuel donne un aperçu du style ; la taille et le confort se valident en boutique.
        </p>
      </div>

      {/* Sélecteur de montures */}
      <aside className="lg:col-span-2">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{frame.collection}</p>
              <h2 className="text-lg font-semibold">
                {frame.name} <span className="font-normal text-ink-2">{COLOR_LABELS[frame.color]}</span>
              </h2>
            </div>
            <p className="text-sm font-semibold text-brand-800">{formatFcfa(frame.priceFcfa)}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href={`/montures/${frame.slug}`} className="btn-outline btn-sm flex-1">
              Voir la fiche
            </Link>
            <Link href="/rendez-vous" className="btn-primary btn-sm flex-1">
              Prendre rendez-vous
            </Link>
          </div>
        </div>

        <div className="mt-4 grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2">
          {FRAMES.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => setFrame(f)}
              aria-pressed={f.slug === frame.slug}
              className={`rounded-xl border bg-white p-2 text-left transition ${
                f.slug === frame.slug ? "border-brand-700 ring-2 ring-brand-500/20" : "border-ink/10 hover:border-brand-400"
              }`}
            >
              <div className="flex aspect-[5/2] items-center justify-center rounded-lg bg-paper-2 px-2">
                <Image src={frameImageUrl(f)} alt="" width={1000} height={400} unoptimized className="h-auto w-full" />
              </div>
              <p className="mt-1.5 truncate text-xs font-semibold">{f.name}</p>
              <p className="flex items-center gap-1 text-[11px] text-ink-3">
                <span className="h-2.5 w-2.5 rounded-full border border-ink/15" style={{ background: COLOR_SWATCH[f.color] }} />
                {COLOR_LABELS[f.color]}
              </p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

/**
 * Boîte absolument positionnée qui suit la zone réellement peinte de la source
 * (vidéo ou image en object-contain), pour que les coordonnées des repères
 * correspondent aux pixels affichés.
 */
function OverlayBox({
  sourceRef,
  children,
}: {
  sourceRef: React.RefObject<HTMLVideoElement | HTMLImageElement | null>;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = sourceRef.current;
      if (!el) {
        raf = requestAnimationFrame(update);
        return;
      }
      const next = paintedBox(el);
      if (next) {
        setBox((prev) =>
          prev && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5
            ? prev
            : next,
        );
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [sourceRef]);

  return (
    <div className="absolute" style={box ?? { display: "none" }} data-overlay-box>
      {children}
    </div>
  );
}
