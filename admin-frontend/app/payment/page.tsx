'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function PaymentPage() {
  const router = useRouter();
  const [qrData, setQrData] = useState('');
  const [merchantId, setMerchantId] = useState(1); // 기본 가맹점 ID
  const [amount, setAmount] = useState('');
  const [benefit, setBenefit] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const hasLoadedData = useRef(false);

  useEffect(() => {
    if (hasLoadedData.current) return;

    const savedQrData = sessionStorage.getItem('qr_data');
    console.log('>>> Payment page loaded, QR data from storage:', savedQrData);
    if (savedQrData) {
      setQrData(savedQrData);
      sessionStorage.removeItem('qr_data');
      hasLoadedData.current = true;
    } else {
      console.log('>>> No QR data found, redirecting to /scan');
      router.push('/scan');
    }
  }, [router]);

  useEffect(() => {
    if (qrData && amount && parseInt(amount) > 0) {
      calculateBenefit();
    }
  }, [amount]);

  const calculateBenefit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/api/qr/scan`, {
        qr_data: qrData,
        merchant_id: merchantId,
        payment_amount: parseInt(amount)
      });

      setBenefit(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '혜택 계산에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!benefit) return;

    setProcessing(true);
    setError('');

    try {
      await axios.post(`${API_URL}/api/payment/process`, {
        transaction_id: benefit.transaction_id,
        confirm: true
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '결제 처리에 실패했습니다');
    } finally {
      setProcessing(false);
    }
  };

  let userData = null;
  try {
    userData = qrData ? JSON.parse(qrData) : null;
    console.log('>>> Parsed user data:', userData);
  } catch (e) {
    console.error('>>> QR 데이터 파싱 실패:', e);
    console.log('>>> QR 데이터:', qrData);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-white border-b border-border px-6 py-4">
        <button
          onClick={() => router.push('/')}
          className="text-primary hover:underline"
        >
          ← 홈으로
        </button>
        <h1 className="text-2xl font-bold text-text mt-2">결제 처리</h1>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-md mx-auto">
          {success ? (
            <div className="bg-white rounded-subtle shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-success mb-2">결제 완료</h2>
              <p className="text-text-secondary">
                결제가 성공적으로 처리되었습니다
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-subtle shadow-lg p-6">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-1">사용자</h3>
                <p className="text-lg">{userData?.user_name}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-1">카드</h3>
                <p className="text-lg">{userData?.card_name}</p>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-1">결제 금액</h3>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="금액 입력"
                  className="w-full text-2xl font-bold border-2 border-border rounded-subtle px-4 py-3 focus:outline-none focus:border-primary"
                />
              </div>

              {loading && (
                <div className="text-center py-4">
                  <p className="text-text-secondary">혜택 계산 중...</p>
                </div>
              )}

              {benefit && !loading && (
                <div className="bg-gray-50 rounded-subtle p-4 mb-6">
                  <p className="text-success text-xl font-semibold mb-1">
                    {benefit.discount_amount.toLocaleString()}원 할인
                  </p>
                  <p className="text-text-secondary text-sm mb-3">
                    {benefit.benefit_text}
                  </p>
                  <div className="border-t border-border pt-3">
                    <p className="text-2xl font-bold text-text">
                      최종 금액: {benefit.final_amount.toLocaleString()}원
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 bg-error/10 border border-error text-error px-4 py-3 rounded-subtle text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={processPayment}
                disabled={!benefit || processing}
                className="w-full bg-primary text-white py-4 rounded-subtle hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {processing ? '처리 중...' : '결제 완료'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
