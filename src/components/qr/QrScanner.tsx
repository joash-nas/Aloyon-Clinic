"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";

type Props = {
  onResult: (text: string) => void;
  paused?: boolean;
};

export default function QrScanner({ onResult, paused }: Props) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    async function loadCameras() {
      try {
        setLoadingCameras(true);
        setErr(null);

        const cams = await Html5Qrcode.getCameras();

        if (!mountedRef.current) return;

        const mapped = (cams || []).map((c) => ({
          id: c.id,
          label: c.label || `Camera ${c.id.slice(0, 6)}`,
        }));

        setDevices(mapped);

        if (mapped.length > 0) {
          const preferred =
            mapped.find((d) => /back|rear|environment/i.test(d.label)) ||
            mapped[0];
          setCameraId(preferred.id);
        } else {
          setErr("No camera found on this device.");
        }
      } catch (e) {
        console.error("Failed to load cameras:", e);
        if (!mountedRef.current) return;
        setErr("Unable to access camera list. Please allow camera permission.");
      } finally {
        if (mountedRef.current) setLoadingCameras(false);
      }
    }

    void loadCameras();

    return () => {
      mountedRef.current = false;
      void stopScanner(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused && running) {
      void stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  async function startScanner() {
    if (!cameraId) return;

    try {
      setErr(null);

      // extra safety: stop old instance first
      await stopScanner(true);

      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;

      const config: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.333334,
        disableFlip: false,
      };

      await scanner.start(
        { deviceId: { exact: cameraId } },
        config,
        async (decodedText) => {
          if (!decodedText) return;

          onResult(decodedText);

          // stop immediately after successful scan
          await stopScanner();
        },
        () => {
          // ignore normal scan misses
        }
      );

      startedRef.current = true;
      if (mountedRef.current) setRunning(true);
    } catch (e) {
      console.error("Failed to start scanner:", e);
      if (mountedRef.current) {
        setErr("Failed to start camera. Check permission and HTTPS.");
        setRunning(false);
      }
    }
  }

  async function stopScanner(forceClear = false) {
    const scanner = scannerRef.current;

    try {
      if (scanner && startedRef.current) {
        await scanner.stop();
      }
    } catch (e) {
      console.warn("Scanner stop warning:", e);
    }

    try {
      if (scanner && (startedRef.current || forceClear)) {
        await scanner.clear();
      }
    } catch (e) {
      console.warn("Scanner clear warning:", e);
    }

    scannerRef.current = null;
    startedRef.current = false;

    if (mountedRef.current) {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="text-sm font-semibold">Camera scanner</div>

        <div className="flex gap-2 items-center">
          <select
            className="text-xs rounded-lg px-2 py-1 ring-1 ring-[var(--border)] bg-white/80 outline-none"
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            disabled={running || loadingCameras}
          >
            {devices.length > 0 ? (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))
            ) : (
              <option value="">No camera</option>
            )}
          </select>

          {!running ? (
            <button
              type="button"
              onClick={startScanner}
              disabled={!cameraId || loadingCameras || !!paused}
              className="px-3 py-1.5 rounded-lg bg-black text-white text-xs disabled:opacity-50"
            >
              {loadingCameras ? "Loading..." : "Start"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopScanner()}
              className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] text-xs"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden ring-1 ring-[var(--border)] bg-black min-h-[260px]">
        <div id={regionId} className="w-full min-h-[260px]" />
      </div>

      {err ? (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm">
          {err}
        </div>
      ) : (
        <div className="text-[11px] text-neutral-500">
          Use the back camera for better scanning.
        </div>
      )}
    </div>
  );
}