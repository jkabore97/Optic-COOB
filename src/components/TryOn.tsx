"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { COLOR_LABELS, COLOR_SWATCH, formatFcfa, frameImageUrl, type Frame } from "@/lib/frames";
import { eyePose, placeOverlay, placementToCss, smoothPose, type EyePose } from "@/lib/tryon-math";

/**
 * Essayage virtuel : détection des repères du visage dans le navigateur (MediaPipe
 * Face Landmarker) et superposition du visuel de la monture. Aucune image n'est envoyée
 * à un serveur.
 *
 * Chaque visuel déclare la position des deux centres de verres (voir src/lib/tryon-math.ts) ;
 * ils sont alignés sur les pupilles détectées.
 */

// Fichiers servis depuis notre domaine (voir scripts/setup-mediapipe.mjs). Surchargeables
// par NEXT_PUBLIC_MEDIAPIPE_WASM_URL / NEXT_PUBLIC_FACE_MODEL_URL pour utiliser un CDN.
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

/** Résumé lisible d'une erreur (nom + début du message). */
function shortError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const msg = (e?.message ?? String(err)).replace(/\s+/g, " ").trim();
  return `${e?.name ?? "Erreur"} : ${msg.length > 220 ? `${msg.slice(0, 220)}…` : msg}`;
}

/** Pose des yeux en pixels affichés, à partir des repères normalisés. */
function poseFromPupils(a: Point, b: Point, w: number, h: number): EyePose {
  return eyePose({ x: a.x * w, y: a.y * h }, { x: b.x * w, y: b.y * h });
}

export function TryOn({ frames, initialSlug }: { frames: Frame[]; initialSlug?: string }) {
  const [frame, setFrame] = useState<Frame>(() => frames.find((f) => f.slug === initialSlug) ?? frames[0]);
  const [mode, setMode] = useState<Mode>("camera");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  /** Détail technique de la dernière erreur (pour le support). */
  const [detail, setDetail] = useState<string>("");
  const [cameraOn, setCameraOn] = useState(false);
  /** Rapport largeur/hauteur de la zone d'affichage, calé sur la caméra une fois connue. */
  const [stageAspect, setStageAspect] = useState("4 / 3");
  const [pose, setPose] = useState<EyePose | null>(null);
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
  const poseRef = useRef<EyePose | null>(null);
  const lastVideoTime = useRef(-1);
  const runningMode = useRef<"VIDEO" | "IMAGE">("VIDEO");

  /** Délégué d'inférence : le GPU pose problème sur certains Android (« ROI contains NaN »). */
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
      outputFacialTransformationMatrixes: false,
    });
  }, []);

  /** Charge le modèle une seule fois. */
  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus("loading");
    setMessage("Chargement du module de détection du visage (quelques Mo la première fois, puis mis en cache)…");
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

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const setRunningMode = useCallback(async (m: "VIDEO" | "IMAGE") => {
    if (runningMode.current === m) return;
    runningMode.current = m;
    await landmarkerRef.current?.setOptions({ runningMode: m });
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setSnapshot(null);
    setDetail("");
    setStatus("loading");
    setMessage("Accès à la caméra…");

    // 1. La caméra d'abord (dans la foulée du clic, ce que certains navigateurs exigent),
    //    pour que l'utilisateur se voie immédiatement.
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCameraOn(true);
    } catch (err) {
      console.error(err);
      const name = (err as Error)?.name ?? "";
      setStatus("error");
      setDetail(shortError(err));
      setMessage(
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
    setMessage("Caméra active. Chargement du détecteur de visage (≈ 15 Mo la première fois)…");
    try {
      await ensureLandmarker();
      await setRunningMode("VIDEO");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setDetail(shortError(err));
      setMessage("Le détecteur de visage n'a pas pu être chargé. Vérifiez votre connexion et réessayez.");
      return;
    }

    poseRef.current = null;
    lastVideoTime.current = -1;
    setStatus("ready");
    setMessage("");

    /** Boucle de détection vidéo. */
    let recovering = false;
    const tick = () => {
      const lm = landmarkerRef.current;
      if (!recovering && lm && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        try {
          const res = lm.detectForVideo(video, performance.now());
          const face = res.faceLandmarks[0];
          const p = face ? pupils(face) : null;
          const box = p ? paintedBox(video) : null;
          if (p && box) {
            const next = poseFromPupils(p.a, p.b, box.width, box.height);
            poseRef.current = smoothPose(poseRef.current, next);
            setPose(poseRef.current);
            setFaceSeen(true);
          } else {
            setFaceSeen(false);
          }
        } catch (err) {
          console.error(err);
          recovering = true;
          setFaceSeen(false);
          setMessage("Optimisation pour votre appareil…");
          fallbackToCpu()
            .then((switched) => {
              if (switched) {
                poseRef.current = null;
                recovering = false;
                setMessage("");
                return;
              }
              setStatus("error");
              setDetail(shortError(err));
              setMessage("La détection du visage a rencontré une erreur. Réessayez, ou importez une photo.");
              cancelAnimationFrame(rafRef.current);
            })
            .catch((e) => {
              setStatus("error");
              setDetail(shortError(e));
              setMessage("La détection du visage a rencontré une erreur. Réessayez, ou importez une photo.");
              cancelAnimationFrame(rafRef.current);
            });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureLandmarker, fallbackToCpu, setRunningMode, stopCamera]);

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
      setDetail(shortError(err));
      setMessage("Impossible d'analyser cette photo. Réessayez avec une autre image.");
    }
  }, [ensureLandmarker, fallbackToCpu, setRunningMode]);

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
    setDetail("");
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
    const placement = placeOverlay(pose, frame.image, sizeAdj, yAdj * frame.image.height);
    return {
      display: "block",
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: frame.image.width,
      height: frame.image.height,
      maxWidth: "none",
      transformOrigin: "0 0",
      transform: placementToCss(placement),
      pointerEvents: "none" as const,
    };
  }, [pose, frame.image, sizeAdj, yAdj]);

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
    const placement = placeOverlay(pose, frame.image, sizeAdj, yAdj * frame.image.height);
    ctx.save();
    ctx.translate(placement.tx * k, placement.ty * k);
    ctx.rotate(placement.rotation);
    ctx.scale(placement.scale * k, placement.scale * k);
    ctx.drawImage(overlay, -placement.ox, -placement.oy, frame.image.width, frame.image.height);
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

          <div ref={stageRef} className="relative w-full overflow-hidden bg-ink" style={{ aspectRatio: stageAspect }}>
            <div className="absolute inset-0" style={{ transform: mirrored ? "scaleX(-1)" : undefined }}>
              <div className="relative h-full w-full">
                {mode === "camera" ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="h-full w-full object-contain"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (v.videoWidth && v.videoHeight) {
                        const r = Math.min(16 / 9, Math.max(3 / 4, v.videoWidth / v.videoHeight));
                        setStageAspect(`${r.toFixed(4)} / 1`);
                      }
                    }}
                  />
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
                  <img ref={overlayRef} src={frameImageUrl(frame)} alt="" style={overlayStyle} />
                </OverlayBox>
              </div>
            </div>

            {/* Caméra active, détecteur en cours de chargement : bandeau discret au lieu du voile */}
            {status === "loading" && cameraOn && (
              <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-xl bg-ink/75 px-3 py-2 text-xs text-white backdrop-blur">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span>{message}</span>
              </div>
            )}

            {((status !== "ready" && !(status === "loading" && cameraOn)) || (mode === "photo" && !photoUrl)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 p-6 text-center text-white">
                {status === "loading" && (
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                )}
                <p className="max-w-sm text-sm">
                  {message || (mode === "photo" ? "Choisissez une photo de face pour commencer." : "Activez la caméra pour voir la monture sur votre visage, en direct.")}
                </p>
                {status === "error" && detail && (
                  <p className="max-w-sm break-all font-mono text-[11px] text-white/60" title="Détail technique">{detail}</p>
                )}
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
              <input type="range" min="-0.12" max="0.12" step="0.005" value={yAdj} onChange={(e) => setYAdj(Number(e.target.value))} className="mt-1 w-full accent-brand-700" />
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
