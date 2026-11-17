import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  AlertCircle,
  Camera,
  FileText,
  Image as ImageIcon,
  Keyboard,
  PlusCircle,
  RefreshCw,
  ScanBarcode,
  Search,
  VideoOff,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';
import type { FoodProduct } from '../types/nutrition';

interface BarcodeScannerViewProps {
  language: LanguageCode;
  onProductFound: (product: FoodProduct) => void;
  onOpenLabelOcr: (prefillBarcode?: string) => void;
  onOpenMealPhoto: () => void;
  onOpenManualEntry: (prefillBarcode?: string) => void;
}

const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.ITF,
];

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  language,
  onProductFound,
  onOpenLabelOcr,
  onOpenMealPhoto,
  onOpenManualEntry,
}) => {
  const t = TRANSLATIONS[language];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<
    'idle' | 'starting' | 'active' | 'denied' | 'error'
  >('idle');
  const [cameraError, setCameraError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);

  const [manualCode, setManualCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [lastDetectedCode, setLastDetectedCode] = useState<string>('');

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraState('idle');
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const performLookup = useCallback(
    async (rawCode: string) => {
      const cleaned = rawCode.trim();
      if (!/^[a-zA-Z0-9\-_]{4,32}$/.test(cleaned)) {
        setLookupError(t.scanner.invalidBarcode);
        return;
      }

      setLookupError('');
      setNotFoundBarcode(null);
      setLookingUp(true);
      setLastDetectedCode(cleaned);

      try {
        const result = await apiClient.lookupBarcode(cleaned);
        if (result.found && result.product) {
          stopCamera();
          onProductFound(result.product);
        } else {
          setNotFoundBarcode(cleaned);
        }
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : 'Unable to look up barcode.'
        );
      } finally {
        setLookingUp(false);
      }
    },
    [onProductFound, stopCamera, t.scanner.invalidBarcode]
  );

  const startCamera = useCallback(
    async (overrideIdx?: number) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('denied');
        setCameraError(t.scanner.permissionDenied);
        return;
      }

      setCameraState('starting');
      setCameraError('');
      setNotFoundBarcode(null);

      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
        const reader = new BrowserMultiFormatReader(hints);

        // Request permission via explicit user action first
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        tempStream.getTracks().forEach((tr) => tr.stop());

        const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(videoDevices);

        const targetIdx =
          overrideIdx !== undefined
            ? overrideIdx
            : Math.max(
                0,
                videoDevices.findIndex((d) =>
                  /back|rear|environment/i.test(d.label)
                )
              );
        setDeviceIndex(targetIdx);
        const selectedId = videoDevices[targetIdx]?.deviceId;

        if (!videoRef.current) return;

        let handled = false;
        const controls = await reader.decodeFromVideoDevice(
          selectedId,
          videoRef.current,
          (result, error) => {
            if (result && !handled) {
              handled = true;
              const code = result.getText();
              setManualCode(code);
              void performLookup(code);
            } else if (error && error.name !== 'NotFoundException') {
              // Ignore per-frame decode misses; only surface hardware issues
            }
          }
        );

        controlsRef.current = controls;
        setCameraState('active');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|permission|notallowed/i.test(msg)) {
          setCameraState('denied');
          setCameraError(t.scanner.permissionDenied);
        } else {
          setCameraState('error');
          setCameraError(msg || t.scanner.permissionDenied);
        }
      }
    },
    [performLookup, t.scanner.permissionDenied]
  );

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const nextIdx = (deviceIndex + 1) % devices.length;
    stopCamera();
    void startCamera(nextIdx);
  };

  const handleImageFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLookupError('');
    const objectUrl = URL.createObjectURL(file);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
      const reader = new BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = result.getText();
      setManualCode(code);
      await performLookup(code);
    } catch {
      setLookupError(
        language === 'ur'
          ? 'اس تصویر میں کوئی واضح بارکوڈ نہیں ملا۔ براہ کرم نمبر درج کریں یا لیبل اسکین کریں۔'
          : 'No readable barcode detected in that image. Try entering the number manually or using Label OCR.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
            {t.scanner.title}
          </h1>
          <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">
            {t.scanner.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Camera Viewport Card */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 overflow-hidden">
          <div className="relative aspect-[4/3] sm:aspect-video bg-[#0B120E] flex items-center justify-center">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${
                cameraState === 'active' ? 'block' : 'hidden'
              }`}
            />

            {cameraState === 'active' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-64 sm:w-72 h-40 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] overflow-hidden flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400 animate-scan-beam" />
                </div>
                <p className="mt-5 px-3 py-1 rounded-lg bg-black/70 text-white text-xs font-medium">
                  {t.scanner.scanningActive}
                </p>
              </div>
            )}

            {cameraState !== 'active' && (
              <div className="p-6 sm:p-8 text-center max-w-md space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#14532D]/25 border border-emerald-400/30 flex items-center justify-center">
                  {cameraState === 'denied' || cameraState === 'error' ? (
                    <VideoOff className="w-7 h-7 text-amber-300" />
                  ) : (
                    <Camera className="w-7 h-7 text-emerald-300" />
                  )}
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {t.scanner.permissionTitle}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                  {cameraError || t.scanner.permissionBody}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={cameraState === 'starting'}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#16A34A] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      {cameraState === 'starting'
                        ? t.common.loading
                        : t.scanner.grantCamera}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{t.scanner.uploadBarcodeImage}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Camera controls toolbar */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-950/10 dark:border-emerald-100/10">
            <div className="flex flex-wrap items-center gap-2">
              {cameraState === 'active' && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold cursor-pointer"
                >
                  {t.scanner.stopCamera}
                </button>
              )}
              {cameraState === 'active' && devices.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.scanner.switchCamera}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-emerald-950/15 dark:border-emerald-100/15 text-xs font-medium text-[#111C16] dark:text-[#EDF4EF] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
              <span>{t.scanner.uploadBarcodeImage}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleImageFileScan(e)}
              className="hidden"
            />
          </div>
        </div>

        {/* Manual Barcode & Lookup Status Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <label
              htmlFor="manual-barcode-input"
              className="block text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]"
            >
              {t.scanner.manualEntryLabel}
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void performLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <input
                ref={manualInputRef}
                id="manual-barcode-input"
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t.scanner.manualPlaceholder}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 dark:border-emerald-100/15 text-sm font-mono text-[#111C16] dark:text-[#EDF4EF] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
              />
              <button
                type="submit"
                disabled={lookingUp}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>{t.scanner.lookupBtn}</span>
              </button>
            </form>

            {/* Quick live API test barcodes (hits real Open Food Facts API) */}
            <div className="pt-1 space-y-2">
              <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
                {t.scanner.tryExamples}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Nutella (3017620422003)', code: '3017620422003' },
                  { label: 'Coca-Cola (5449000000996)', code: '5449000000996' },
                  { label: 'Oreo (7622210449283)', code: '7622210449283' },
                ].map((sample) => (
                  <button
                    key={sample.code}
                    type="button"
                    onClick={() => {
                      setManualCode(sample.code);
                      void performLookup(sample.code);
                    }}
                    className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#F2F6F3] dark:bg-[#192A20] hover:bg-emerald-950/10 dark:hover:bg-white/10 text-xs font-medium text-[#111C16] dark:text-[#EDF4EF] cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {lookingUp && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-sm text-[#14532D] dark:text-emerald-200">
                <ScanBarcode className="w-4 h-4 animate-pulse shrink-0" />
                <span>
                  {t.scanner.searchingDb} ({lastDetectedCode})
                </span>
              </div>
            )}

            {lookupError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-sm text-red-800 dark:text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>

          {/* Not Found Handling Screen */}
          {notFoundBarcode && (
            <div className="rounded-3xl bg-white dark:bg-[#132019] border border-amber-300 dark:border-amber-700/60 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#111C16] dark:text-[#EDF4EF]">
                  {t.scanner.notFoundTitle}
                </h3>
                <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] font-mono tabular-nums">
                  {t.scanner.notFoundSubtitle}: {notFoundBarcode}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenLabelOcr(notFoundBarcode)}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#14532D] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{t.scanner.actionScanLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenMealPhoto}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 shrink-0 text-[#15803D] dark:text-[#4ADE80]" />
                  <span>{t.scanner.actionTakePhoto}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotFoundBarcode(null);
                    manualInputRef.current?.focus();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Keyboard className="w-4 h-4 shrink-0 text-[#15803D] dark:text-[#4ADE80]" />
                  <span>{t.scanner.actionManualBarcode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenManualEntry(notFoundBarcode)}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#111C16] dark:text-[#EDF4EF] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 shrink-0 text-[#15803D] dark:text-[#4ADE80]" />
                  <span>{t.scanner.actionAddManual}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
