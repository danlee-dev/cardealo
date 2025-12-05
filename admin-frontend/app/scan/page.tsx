'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    const qrScanner = new Html5Qrcode('qr-reader');
    setScanner(qrScanner);

    return () => {
      if (qrScanner.isScanning) {
        qrScanner.stop();
      }
    };
  }, []);

  const startScanning = async () => {
    if (!scanner) return;

    try {
      setScanning(true);
      setError('');

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          console.log('>>> QR Scanned:', decodedText);
          scanner.stop();
          setScanning(false);

          // QR 데이터를 payment 페이지로 전달
          sessionStorage.setItem('qr_data', decodedText);
          console.log('>>> SessionStorage set, redirecting to /payment');
          router.push('/payment');
        },
        (errorMessage) => {
          // 스캔 실패는 무시 (계속 스캔)
        }
      );
    } catch (err) {
      setError('카메라 접근 권한이 필요합니다.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanner && scanning) {
      scanner.stop();
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-white border-b border-border px-6 py-4">
        <button
          onClick={() => router.push('/')}
          className="text-primary hover:underline"
        >
          ← 홈으로
        </button>
        <h1 className="text-2xl font-bold text-text mt-2">QR/바코드 스캔</h1>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <div
            id="qr-reader"
            className="w-full rounded-subtle overflow-hidden shadow-lg"
            style={{ display: scanning ? 'block' : 'none' }}
          />

          {!scanning && (
            <div className="bg-white rounded-subtle shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">📷</div>
              <h2 className="text-xl font-semibold mb-4">QR/바코드 스캔</h2>
              <p className="text-text-secondary mb-6">
                사용자가 제시한 QR 코드 또는 바코드를 스캔하세요
              </p>
              <button
                onClick={startScanning}
                className="w-full bg-primary text-white py-3 rounded-subtle hover:opacity-90 transition-opacity"
              >
                스캔 시작
              </button>
            </div>
          )}

          {scanning && (
            <button
              onClick={stopScanning}
              className="w-full mt-4 bg-error text-white py-3 rounded-subtle hover:opacity-90 transition-opacity"
            >
              스캔 중지
            </button>
          )}

          {error && (
            <div className="mt-4 bg-error/10 border border-error text-error px-4 py-3 rounded-subtle">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
