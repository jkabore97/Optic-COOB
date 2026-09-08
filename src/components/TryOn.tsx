"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FaceObservation, TryOnEngine } from "@/lib/tryon-3d";
import { COLOR_LABELS, COLOR_SWATCH, formatFcfa, frameImageUrl, type Frame } from "@/lib/frames";
import {
  eyePose,
  headPoseFromMatrix,
  placeOverlay3D,
  placement3DToCss,
  projectCorners,
  smoothHead,
  smoothPose,
  type EyePose,
  type HeadPose,
} from "@/lib/tryon-math";

/**
 * Essayage virtuel : détection des repères du visage dans le navigateur (MediaPipe
 * Face Landmarker) et superposition de la photo de la monture, qui suit l'orientation
 * de la tête. Aucune image n'est envoyée à un serveur.
 */

// Fichiers servis depuis notre domaine (voir scripts/setup-mediapipe.mjs).
const WASM_URL = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_URL ?? "/mediapipe/wasm";
const MODEL_URL = process.env.NEXT_PUBLIC_FACE_MODEL_URL ?? "/mediapipe/face_landmarker.task";

type Mode = "camera" | "photo";
type Status = "idle" | "loading" | "ready" | "error";

interface Point {
  x: number;
  y: number;
}

function midpoint(pts: NormalizedLandmark[]): Point {
  const n = pts.length;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/** Centres des deux pupilles (coordonnées normalisées 0–1). */
function pupils(lm: NormalizedLandmark[]): { a: Point; b: Point } | null {
  if (lm.length >= 478) return { a: lm[468], b: lm[473] };
  if (lm.length >= 468) return { a: midpoint([lm[33], lm[133]]), b: midpoint([lm[362], lm[263]]) };
  return null;
}

/** Zone réellement peinte d'une source en object-cover, relative à l'élément (peut déborder). */
function paintedBox(el: HTMLVideoElement | HTMLImageElement) {
  const nw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const nh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  if (!nw || !nh || !cw || !ch) return null;
  const scale = Math.max(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

function shortError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const msg = (e?.message ?? String(err)).replace(/\s+/g, " ").trim();
  return `${e?.name ?? "Erreur"} : ${msg.length > 220 ? `${msg.slice(0, 220)}…` : msg}`;
}

interface Detection {
  pose: EyePose;
  head: HeadPose;
}

export function TryOn({ frames, initialSlug }: { frames: Frame[]; initialSlug?: string }) {
  const [frame, setFrame] = useState<Frame>(() => frames.find((f) => f.slug === initialSlug) ?? frames[0]);
  const [mode, setMode] = useState<Mode>("camera");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [faceSeen, setFaceSeen] = useState(false);
  const [sizeAdj, setSizeAdj] = useState(1);
  const [yAdj, setYAdj] = useState(0);
  const [showAdjust, setShowAdjust] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  /** Rendu 3D (modèle GLB ou monture procédurale) plutôt que photo à plat. */
  const use3d = Boolean(frame.model) || frame.has3d;
  const use3dRef = useRef(use3d);
  use3dRef.current = use3d;

  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TryOnEngine | null>(null);
  const faceRef = useRef<FaceObservation | null>(null);
  const samplerRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const poseRef = useRef<EyePose | null>(null);
  const headRef = useRef<HeadPose | null>(null);
  const lastVideoTime = useRef(-1);
  const runningMode = useRef<"VIDEO" | "IMAGE">("VIDEO");
  /** Le GPU pose problème sur certains Android (« ROI contains NaN ») : CPU d'office. */
  const delegateRef = useRef<"GPU" | "CPU">(
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "CPU" : "GPU",
  );
  const visionRef = useRef<{ fileset: unknown; vision: typeof import("@mediapipe/tasks-vision") } | null>(null);

  const createLandmarker = useCallback(async (delegate: "GPU" | "CPU") => {
    if (!visionRef.current) {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      visionRef.current = { fileset, vision };
    }
    const { fileset, vision } = visionRef.current;
    return vision.FaceLandmarker.createFromOptions(fileset as Awaited<ReturnType<typeof vision.FilesetResolver.forVisionTasks>>, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: runningMode.current,
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  }, []);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    let lm: FaceLandmarker;
    try {
      lm = await createLandmarker(delegateRef.current);
    } catch (err) {
      if (delegateRef.current === "CPU") throw err;
      delegateRef.current = "CPU";
      lm = await createLandmarker("CPU");
    }
    landmarkerRef.current = lm;
    return lm;
  }, [createLandmarker]);

  /** Bascule sur le CPU après une erreur d'inférence GPU. Retourne false si déjà sur CPU. */
  const fallbackToCpu = useCallback(async () => {
    if (delegateRef.current === "CPU") return false;
    delegateRef.current = "CPU";
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    landmarkerRef.current = await createLandmarker("CPU");
    return true;
  }, [createLandmarker]);

  const setRunningMode = useCallback(async (m: "VIDEO" | "IMAGE") => {
    if (runningMode.current === m) return;
    runningMode.current = m;
    await landmarkerRef.current?.setOptions({ runningMode: m });
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  /** Convertit un résultat MediaPipe en pose (pixels affichés) + orientation. */
  const toDetection = useCallback(
    (lm: NormalizedLandmark[], matrix: ArrayLike<number> | undefined, box: { width: number; height: number }, smooth: boolean) => {
      const p = pupils(lm);
      if (!p) return null;
      const pose = eyePose({ x: p.a.x * box.width, y: p.a.y * box.height }, { x: p.b.x * box.width, y: p.b.y * box.height });
      const head = matrix ? headPoseFromMatrix(matrix) : { yaw: 0, pitch: 0 };
      poseRef.current = smooth ? smoothPose(poseRef.current, pose) : pose;
      headRef.current = smooth ? smoothHead(headRef.current, head) : head;
      return { pose: poseRef.current, head: headRef.current };
    },
    [],
  );

  const failWith = useCallback((err: unknown, text: string) => {
    console.error(err);
    setStatus("error");
    setDetail(shortError(err));
    setMessage(text);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setSnapshot(null);
    setDetail("");
    setStatus("loading");
    setMessage("Accès à la caméra…");
    const video = videoRef.current;
    if (!video) return;

    // 1. La caméra d'abord, dans la foulée du clic.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCameraOn(true);
    } catch (err) {
      const name = (err as Error)?.name ?? "";
      failWith(
        err,
        name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError"
          ? "L'accès à la caméra a été refusé. Autorisez la caméra pour ce site dans votre navigateur, ou utilisez une photo."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Aucune caméra frontale détectée. Vous pouvez importer une photo à la place."
            : name === "NotReadableError"
              ? "La caméra est utilisée par une autre application. Fermez-la puis réessayez."
              : "Impossible d'accéder à la caméra. Vérifiez qu'elle est autorisée, ou importez une photo.",
      );
      return;
    }

    // 2. Puis le détecteur de visage (téléchargé une fois, puis en cache).
    setMessage("Chargement du détecteur de visage (≈ 15 Mo la première fois)…");
    try {
      await ensureLandmarker();
      await setRunningMode("VIDEO");
    } catch (err) {
      failWith(err, "Le détecteur de visage n'a pas pu être chargé. Vérifiez votre connexion et réessayez.");
      return;
    }

    poseRef.current = null;
    headRef.current = null;
    lastVideoTime.current = -1;
    setStatus("ready");
    setMessage("");

    let recovering = false;
    const tick = () => {
      const lm = landmarkerRef.current;
      if (!recovering && lm && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        try {
          const res = lm.detectForVideo(video, performance.now());
          const face = res.faceLandmarks[0];
          const matrix = res.facialTransformationMatrixes?.[0]?.data;
          faceRef.current = face ? { landmarks: face, matrix } : null;
          const box = face ? paintedBox(video) : null;
          const det = face && box && !use3dRef.current ? toDetection(face, matrix, box, true) : null;
          if (det) setDetection(det);
          setFaceSeen(Boolean(face));
        } catch (err) {
          recovering = true;
          setFaceSeen(false);
          fallbackToCpu()
            .then((switched) => {
              if (switched) {
                poseRef.current = null;
                headRef.current = null;
                recovering = false;
              } else {
                failWith(err, "La détection du visage a rencontré une erreur. Réessayez, ou importez une photo.");
                cancelAnimationFrame(rafRef.current);
              }
            })
            .catch((e) => {
              failWith(e, "La détection du visage a rencontré une erreur. Réessayez, ou importez une photo.");
              cancelAnimationFrame(rafRef.current);
            });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureLandmarker, failWith, fallbackToCpu, setRunningMode, stopCamera, toDetection]);

  const detectPhoto = useCallback(async () => {
    const img = photoRef.current;
    if (!img || !img.complete) return;
    try {
      const lm = await ensureLandmarker();
      await setRunningMode("IMAGE");
      let res: ReturnType<FaceLandmarker["detect"]>;
      try {
        res = lm.detect(img);
      } catch (err) {
        if (!(await fallbackToCpu())) throw err;
        await setRunningMode("IMAGE");
        res = landmarkerRef.current!.detect(img);
      }
      const face = res.faceLandmarks[0];
      const matrix = res.facialTransformationMatrixes?.[0]?.data;
      faceRef.current = face ? { landmarks: face, matrix } : null;
      const box = face ? paintedBox(img) : null;
      const det = face && box ? toDetection(face, matrix, box, false) : null;
      setStatus("ready");
      if (!det) {
        setFaceSeen(false);
        setDetection(null);
        setMessage("Aucun visage détecté sur cette photo. Essayez une photo de face, bien éclairée.");
        return;
      }
      setDetection(det);
      setFaceSeen(true);
      setMessage("");
    } catch (err) {
      failWith(err, "Impossible d'analyser cette photo. Réessayez avec une autre image.");
    }
  }, [ensureLandmarker, failWith, fallbackToCpu, setRunningMode, toDetection]);

  const onPhotoChosen = (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    faceRef.current = null;
    setSnapshot(null);
    setDetection(null);
    setFaceSeen(false);
    setDetail("");
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setMode("photo");
    setStatus("loading");
    setMessage("Analyse de la photo…");
  };

  const switchToCamera = () => {
    setMode("camera");
    faceRef.current = null;
    setDetection(null);
    setFaceSeen(false);
    setStatus("idle");
    setMessage("");
    setDetail("");
  };

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stopCamera]);

  // ---- Moteur 3D : création quand la scène est prête en mode 3D ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!use3d || status !== "ready" || !canvas) return;
    let disposed = false;
    let raf = 0;
    let engine: TryOnEngine | null = null;
    let lastSample = 0;
    import("@/lib/tryon-3d").then(({ createTryOnEngine, averageLuminance }) => {
      if (disposed) return;
      engine = createTryOnEngine(canvas);
      engineRef.current = engine;
      setEngineReady(true);
      let w = 0;
      let h = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!engine) return;
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (cw && ch && (cw !== w || ch !== h)) {
          w = cw;
          h = ch;
          engine.resize(w, h);
        }
        const video = videoRef.current;
        if (video && video.videoWidth && performance.now() - lastSample > 600) {
          lastSample = performance.now();
          samplerRef.current ??= document.createElement("canvas");
          const lum = averageLuminance(video, samplerRef.current);
          if (lum != null) engine.setExposure(Math.min(1.5, Math.max(0.7, 0.75 + (0.5 - lum) * 1.2)));
        }
        engine.update(faceRef.current);
        engine.render();
      };
      loop();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      engine?.dispose();
      engineRef.current = null;
      setEngineReady(false);
    };
  }, [use3d, status, mode]);

  // ---- Modèle 3D de la monture courante ----
  useEffect(() => {
    const engine = engineRef.current;
    if (!engineReady || !engine || !use3d) return;
    let cancelled = false;
    setModelLoading(true);
    import("@/lib/tryon-3d")
      .then(async ({ loadGlbModel, proceduralModel }) => {
        const model = frame.model
          ? await loadGlbModel(frame.model.url, frame.model.rotation)
          : proceduralModel({ shape: frame.shape, material: frame.material, color: COLOR_SWATCH[frame.color], colorKey: frame.color, autoRotate: false, interactive: false });
        if (cancelled) return;
        engine.setModel(model);
      })
      .catch((err) => console.error("[3D] modèle", err))
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engineReady, use3d, frame]);

  useEffect(() => {
    engineRef.current?.setAdjust(sizeAdj, yAdj);
  }, [sizeAdj, yAdj, engineReady]);

  const placement = useMemo(
    () => (detection ? placeOverlay3D(detection.pose, detection.head, frame.image, sizeAdj, yAdj * frame.image.height) : null),
    [detection, frame.image, sizeAdj, yAdj],
  );

  const overlayStyle = useMemo(() => {
    if (!placement) return { display: "none" } as const;
    return {
      display: "block",
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: frame.image.width,
      height: frame.image.height,
      maxWidth: "none",
      transformOrigin: `${placement.ox}px ${placement.oy}px`,
      transform: placement3DToCss(placement),
      filter: "drop-shadow(0 5px 7px rgba(0,0,0,0.35))",
      backfaceVisibility: "hidden" as const,
      pointerEvents: "none" as const,
    };
  }, [placement, frame.image]);

  /** Capture une image composite (source + monture) pour la partager. */
  const takeSnapshot = () => {
    const src = mode === "camera" ? videoRef.current : photoRef.current;
    const overlay = overlayRef.current;
    if (!src || (!use3d && (!overlay || !placement))) return;
    const painted = paintedBox(src);
    if (!painted) return;
    const naturalW = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
    const naturalH = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
    const k = naturalW / painted.width; // pixels source par pixel affiché
    // Zone visible (object-cover), en pixels source
    const visX = Math.max(0, -painted.left) * k;
    const visY = Math.max(0, -painted.top) * k;
    const visW = Math.min(naturalW, src.clientWidth * k);
    const visH = Math.min(naturalH, src.clientHeight * k);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(visW);
    canvas.height = Math.round(visH);
    const ctx = canvas.getContext("2d")!;
    if (mode === "camera") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, visX, visY, visW, visH, 0, 0, canvas.width, canvas.height);
    if (use3d && engineRef.current) {
      const engine = engineRef.current;
      engine.render();
      const c = engine.canvas;
      const kc = c.width / painted.width; // pixels du calque par pixel affiché
      ctx.drawImage(c, Math.max(0, -painted.left) * kc, Math.max(0, -painted.top) * kc, src.clientWidth * kc, src.clientHeight * kc, 0, 0, canvas.width, canvas.height);
      setSnapshot(canvas.toDataURL("image/jpeg", 0.92));
      return;
    }
    if (!overlay || !placement) return;
    // Monture photo : projection des coins (approximation affine de la perspective)
    const [tl, tr, bl] = projectCorners(placement, frame.image).map((p) => ({ x: (p.x - Math.max(0, -painted.left)) * k, y: (p.y - Math.max(0, -painted.top)) * k }));
    const { width: w, height: h } = frame.image;
    ctx.save();
    ctx.transform((tr.x - tl.x) / w, (tr.y - tl.y) / w, (bl.x - tl.x) / h, (bl.y - tl.y) / h, tl.x, tl.y);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8 * k;
    ctx.shadowOffsetY = 5 * k;
    ctx.drawImage(overlay, 0, 0, w, h);
    ctx.restore();
    setSnapshot(canvas.toDataURL("image/jpeg", 0.92));
  };

  const mirrored = mode === "camera";
  const showVeil = (status !== "ready" && !(status === "loading" && cameraOn)) || (mode === "photo" && !photoUrl);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card overflow-hidden">
          {/* Scène */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink sm:aspect-[4/3]">
            <div className="absolute inset-0" style={{ transform: mirrored ? "scaleX(-1)" : undefined }}>
              <div className="relative h-full w-full">
                {mode === "camera" ? (
                  <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
                ) : (
                  photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img ref={photoRef} src={photoUrl} alt="Votre photo" className="h-full w-full object-cover" onLoad={() => void detectPhoto()} />
                  )
                )}
                <OverlayBox sourceRef={mode === "camera" ? videoRef : photoRef}>
                  {use3d ? (
                    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img ref={overlayRef} src={frameImageUrl(frame)} alt="" style={overlayStyle} />
                  )}
                </OverlayBox>
              </div>
            </div>

            {/* Habillage : mode, monture, statut */}
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <div className="pointer-events-auto flex gap-1 rounded-full bg-ink/60 p-1 backdrop-blur" role="tablist" aria-label="Source de l'image">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "camera"}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "camera" ? "bg-white text-ink" : "text-white/80"}`}
                  onClick={switchToCamera}
                >
                  Caméra
                </button>
                <label role="tab" aria-selected={mode === "photo"} className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "photo" ? "bg-white text-ink" : "text-white/80"}`}>
                  Photo
                  <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                </label>
              </div>
              <span className={`badge backdrop-blur ${faceSeen && status === "ready" ? "bg-brand-500/90 text-ink" : "bg-ink/60 text-white/90"}`}>
                {status === "ready" ? (faceSeen ? "Visage détecté" : "Placez-vous face à la caméra") : status === "loading" ? "Chargement…" : "En attente"}
              </span>
            </div>

            {status === "ready" && use3d && modelLoading && (
              <div className="absolute inset-x-3 top-14 flex items-center gap-2 rounded-xl bg-ink/70 px-3 py-2 text-xs text-white backdrop-blur">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span>Chargement du modèle 3D…</span>
              </div>
            )}
            {status === "loading" && cameraOn && (
              <div className="absolute inset-x-3 top-14 flex items-center gap-2 rounded-xl bg-ink/70 px-3 py-2 text-xs text-white backdrop-blur">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span>{message}</span>
              </div>
            )}

            {/* Nom de la monture + capture */}
            {status === "ready" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/70 to-transparent p-4">
                <div className="min-w-0 text-white">
                  <p className="truncate text-sm font-semibold">{frame.name} <span className="font-normal text-white/80">{COLOR_LABELS[frame.color]}</span></p>
                  <p className="text-xs text-white/80">{formatFcfa(frame.priceFcfa)}</p>
                </div>
                <button
                  type="button"
                  onClick={takeSnapshot}
                  disabled={use3d ? !faceSeen : !placement}
                  aria-label="Prendre une photo"
                  title="Prendre une photo"
                  className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white/90 bg-white/20 backdrop-blur transition hover:bg-white/40 disabled:opacity-40"
                >
                  <span className="h-10 w-10 rounded-full bg-white" />
                </button>
              </div>
            )}

            {showVeil && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/75 p-6 text-center text-white">
                {status === "loading" && <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
                <p className="max-w-sm text-sm">
                  {message || (mode === "photo" ? "Choisissez une photo de face pour commencer." : "Activez la caméra pour voir la monture sur votre visage, en direct.")}
                </p>
                {status === "error" && detail && <p className="max-w-sm break-all font-mono text-[11px] text-white/60">{detail}</p>}
                {(status === "idle" || status === "error") && mode === "camera" && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className="btn-lime" onClick={() => void startCamera()}>
                      {status === "error" ? "Réessayer la caméra" : "Activer la caméra"}
                    </button>
                    <label className="btn cursor-pointer bg-white/15 text-white hover:bg-white/25">
                      Utiliser une photo
                      <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => onPhotoChosen(e.target.files?.[0])} />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sélecteur de montures (défilement horizontal) */}
          <div className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:thin]" role="tablist" aria-label="Montures">
            {frames.map((f) => (
              <button
                key={f.slug}
                type="button"
                role="tab"
                aria-selected={f.slug === frame.slug}
                onClick={() => setFrame(f)}
                title={`${f.name} ${COLOR_LABELS[f.color]}`}
                className={`relative flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border-2 bg-paper-2 p-1.5 transition ${
                  f.slug === frame.slug ? "border-brand-600 bg-white" : "border-transparent hover:border-brand-300"
                }`}
              >
                <Image src={frameImageUrl(f)} alt="" width={f.image.width} height={f.image.height} unoptimized className="max-h-full w-auto max-w-full object-contain" />
                {(f.model || f.has3d) && <span className="absolute right-1 top-1 rounded-full bg-brand-500 px-1.5 text-[9px] font-bold text-ink">3D</span>}
              </button>
            ))}
          </div>

          {/* Réglages fins */}
          <div className="border-t border-ink/8 px-4 py-2">
            <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setShowAdjust((v) => !v)} aria-expanded={showAdjust}>
              {showAdjust ? "Masquer les réglages" : "Ajuster la taille et la hauteur"}
            </button>
            {showAdjust && (
              <div className="mt-2 grid gap-3 pb-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-ink-2">
                  Taille <span className="text-ink-3">({Math.round(sizeAdj * 100)} %)</span>
                  <input type="range" min="0.8" max="1.25" step="0.01" value={sizeAdj} onChange={(e) => setSizeAdj(Number(e.target.value))} className="mt-1 w-full accent-brand-700" />
                </label>
                <label className="text-xs font-medium text-ink-2">
                  Hauteur
                  <input type="range" min="-0.12" max="0.12" step="0.005" value={yAdj} onChange={(e) => setYAdj(Number(e.target.value))} className="mt-1 w-full accent-brand-700" />
                </label>
              </div>
            )}
          </div>
        </div>

        {snapshot && (
          <div className="card mt-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Votre essayage avec {frame.name} {COLOR_LABELS[frame.color]}</p>
              <div className="flex gap-2">
                <a href={snapshot} download={`essayage-${frame.slug}.jpg`} className="btn-outline btn-sm">Télécharger</a>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setSnapshot(null)}>Fermer</button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshot} alt="Aperçu de l'essayage" className="mt-3 w-full rounded-xl" />
          </div>
        )}

        <p className="mt-3 text-xs text-ink-3">
          Le traitement se fait entièrement dans votre navigateur : aucune image n&apos;est envoyée à nos serveurs.
          L&apos;essayage virtuel donne un aperçu du style ; la taille et le confort se valident en agence.
        </p>
      </div>

      {/* Fiche de la monture sélectionnée */}
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
          {frame.description && <p className="mt-2 text-sm text-ink-2">{frame.description}</p>}
          <div className="mt-3 flex gap-2">
            <Link href={`/montures/${frame.slug}`} className="btn-outline btn-sm flex-1">Voir la fiche</Link>
            <Link href="/rendez-vous" className="btn-primary btn-sm flex-1">Prendre rendez-vous</Link>
          </div>
        </div>

        <div className="mt-4 hidden max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 lg:grid">
          {frames.map((f) => (
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
                <Image src={frameImageUrl(f)} alt="" width={f.image.width} height={f.image.height} unoptimized className="max-h-full w-auto max-w-full object-contain" />
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

/** Boîte absolument positionnée qui suit la zone réellement peinte de la source (object-cover). */
function OverlayBox({ sourceRef, children }: { sourceRef: React.RefObject<HTMLVideoElement | HTMLImageElement | null>; children: React.ReactNode }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = sourceRef.current;
      const next = el ? paintedBox(el) : null;
      if (next) {
        setBox((prev) =>
          prev && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5 ? prev : next,
        );
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [sourceRef]);

  return (
    <div className="absolute" style={box ?? { display: "none" }}>
      {children}
    </div>
  );
}
