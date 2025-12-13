'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 바코드인지 확인 (12자리 숫자)
const isBarcode = (data: string): boolean => {
  return /^\d{12}$/.test(data);
};

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  category: string | null;
}

interface Merchant {
  id?: number;
  place_id?: string;
  name: string;
  address: string | null;
  latitude?: number;
  longitude?: number;
  category?: string;
}

type ViewMode = 'search' | 'scan' | 'payment' | 'success';
type ActiveTab = 'payment' | 'history';

export default function Home() {
  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('payment');

  // Payment states
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [qrData, setQrData] = useState('');
  const [amount, setAmount] = useState('');
  const [benefit, setBenefit] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // History states
  const [history, setHistory] = useState<any>({ merchants: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMerchant, setExpandedMerchant] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentMerchant();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (query.trim().length > 1) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchMerchants();
      }, 300);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (qrData && amount && parseInt(amount) > 0) {
      calculateBenefit();
    }
  }, [amount]);

  useEffect(() => {
    if (viewMode === 'scan' && !scanner) {
      const initScanner = async () => {
        try {
          const qrScanner = new Html5Qrcode('qr-reader');
          setScanner(qrScanner);

          await qrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 280, height: 280 } },
            (decodedText) => {
              qrScanner.stop();
              setScanner(null);
              setQrData(decodedText);
              setViewMode('payment');
            },
            () => {}
          );
        } catch (err) {
          console.error('Failed to start scanner:', err);
          setViewMode('search');
        }
      };

      setTimeout(() => initScanner(), 100);
    }
  }, [viewMode, scanner]);

  const fetchCurrentMerchant = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/merchants`);
      if (response.data && response.data.length > 0) {
        setSelectedMerchant(response.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
    }
  };

  const searchMerchants = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/merchants/search`, {
        params: { query }
      });
      if (response.data.results) {
        setSearchResults(response.data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const selectMerchant = async (merchant: SearchResult) => {
    try {
      const response = await axios.post(`${API_URL}/api/merchants/select`, {
        place_id: merchant.place_id,
        name: merchant.name,
        address: merchant.address,
        category: merchant.category
      });
      setSelectedMerchant(response.data);
      setQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to select merchant:', err);
    }
  };

  const startScanning = () => {
    setViewMode('scan');
  };

  const calculateBenefit = async () => {
    setLoading(true);
    try {
      let response;
      if (isBarcode(qrData)) {
        // 바코드 스캔 API 호출
        response = await axios.post(`${API_URL}/api/qr/scan-barcode`, {
          barcode_data: qrData,
          merchant_id: selectedMerchant?.id || 1,
          payment_amount: parseInt(amount)
        });
      } else {
        // QR 스캔 API 호출
        response = await axios.post(`${API_URL}/api/qr/scan`, {
          qr_data: qrData,
          merchant_id: selectedMerchant?.id || 1,
          payment_amount: parseInt(amount)
        });
      }
      setBenefit(response.data);
    } catch (err: any) {
      console.error('Failed to calculate benefit:', err);
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!benefit) return;
    setProcessing(true);

    try {
      await axios.post(`${API_URL}/api/payment/process`, {
        transaction_id: benefit.transaction_id,
        confirm: true
      });
      setViewMode('success');
      setTimeout(() => {
        resetPayment();
        loadHistory(); // Reload history after payment
      }, 2500);
    } catch (err) {
      console.error('Payment failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const resetPayment = () => {
    setViewMode('search');
    setQrData('');
    setAmount('');
    setBenefit(null);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/payment/history`);
      setHistory(response.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleMerchant = (merchantId: number) => {
    setExpandedMerchant(expandedMerchant === merchantId ? null : merchantId);
  };

  const toggleUser = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const exportToCSV = () => {
    if (history.merchants.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const csvRows = [];
    csvRows.push(['가맹점명', '가맹점ID', '사용자명', '사용자ID', '카드명', '결제금액', '할인금액', '최종금액', '혜택내용', '결제일시'].join(','));

    history.merchants.forEach((merchant: any) => {
      merchant.users.forEach((user: any) => {
        user.transactions.forEach((tx: any) => {
          const row = [
            `"${merchant.merchant_name}"`,
            merchant.merchant_id,
            `"${user.user_name}"`,
            `"${user.user_id}"`,
            `"${tx.card_name}"`,
            tx.payment_amount,
            tx.discount_amount,
            tx.final_amount,
            `"${tx.benefit_text.replace(/"/g, '""')}"`,
            `"${new Date(tx.payment_date).toLocaleString('ko-KR')}"`
          ];
          csvRows.push(row.join(','));
        });
      });
    });

    const csvContent = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `결제기록_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // QR인 경우에만 파싱하여 사용자 정보 표시, 바코드는 benefit에서 가져옴
  let userData = null;
  if (qrData && !isBarcode(qrData)) {
    try {
      userData = JSON.parse(qrData);
    } catch (e) {}
  }

  const totalTransactions = history.merchants.reduce((sum: number, m: any) => sum + m.total_transactions, 0);
  const totalAmount = history.merchants.reduce((sum: number, m: any) => sum + m.total_amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex flex-col">
      <div className="flex-1 max-w-md mx-auto w-full relative overflow-hidden">
        {/* Sliding Container */}
        <div
          className="flex w-[200%] transition-transform duration-300 ease-out"
          style={{ transform: activeTab === 'payment' ? 'translateX(0)' : 'translateX(-50%)' }}
        >
          {/* Payment Tab */}
          <div className="w-1/2 flex-shrink-0 flex flex-col">
            <div className="p-6 space-y-6 flex-1 pt-safe pb-24">
              <div className="text-center pt-4 pb-4">
                <div className="flex justify-center mb-2 mt-5">
                  <img
                    src="/image.png"
                    alt="Cardealo"
                    className="h-24 w-auto"
                  />
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  <p>Cardealo 전용</p>
                  <p>테스트 PAY 서비스</p>
                </div>
              </div>

              {selectedMerchant && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="text-xs text-gray-500 mb-1">현재 가맹점</div>
                  <div className="font-semibold text-gray-900">{selectedMerchant.name}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{selectedMerchant.address}</div>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="가맹점 검색"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-200 outline-none transition-all text-base"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {searchResults.map((result) => (
                      <button
                        key={result.place_id}
                        onClick={() => selectMerchant(result)}
                        className="w-full px-5 py-4 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{result.name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{result.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {viewMode === 'search' && (
                <div className="space-y-3">
                  <button
                    onClick={startScanning}
                    disabled={!selectedMerchant}
                    className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white py-5 rounded-2xl font-semibold text-lg shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-98"
                  >
                    QR 결제 시작
                  </button>
                </div>
              )}

              {viewMode === 'scan' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div
                    id="qr-reader"
                    className="rounded-xl overflow-hidden"
                  />
                  <button
                    onClick={() => {
                      scanner?.stop();
                      setScanner(null);
                      setViewMode('search');
                    }}
                    className="w-full mt-4 py-3 text-gray-600 font-medium"
                  >
                    취소
                  </button>
                </div>
              )}

              {viewMode === 'payment' && (userData || isBarcode(qrData)) && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">결제 정보</div>
                    {isBarcode(qrData) && (
                      <div className="text-xs text-gray-400 mb-2">바코드: {qrData}</div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">사용자</span>
                        <span className="font-medium">
                          {benefit?.user_name || userData?.user_name || (isBarcode(qrData) ? '금액 입력 후 표시' : '-')}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">카드</span>
                        <span className="font-medium text-sm">
                          {benefit?.card_name || userData?.card_name || (isBarcode(qrData) ? '금액 입력 후 표시' : '-')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">결제 금액</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full text-3xl font-bold text-gray-900 border-b-2 border-gray-200 focus:border-gray-900 outline-none py-2 text-right"
                      autoFocus
                    />
                    <div className="text-right text-sm text-gray-500 mt-1">원</div>
                  </div>

                  {benefit && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">할인 금액</span>
                        <span className="text-xl font-bold text-gray-900">
                          -{benefit.discount_amount.toLocaleString()}원
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">{benefit.benefit_text}</div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <span className="font-medium text-gray-700">최종 결제 금액</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {benefit.final_amount.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={resetPayment}
                      className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-700 font-medium"
                    >
                      취소
                    </button>
                    <button
                      onClick={processPayment}
                      disabled={!benefit || processing}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white font-semibold shadow-lg shadow-gray-900/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? '처리 중...' : '결제하기'}
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'success' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center animate-bounce-in">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">결제 완료</h2>
                  <p className="text-gray-500">결제가 성공적으로 완료되었습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* History Tab */}
          <div className="w-1/2 flex-shrink-0 flex flex-col">
            <div className="p-6 space-y-6 flex-1 pt-safe pb-24">
              <div className="text-center pt-4 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-5">결제 기록</h1>
                <p className="text-sm text-gray-500 mb-3">가맹점별 결제 내역을 확인하세요</p>
                <button
                  onClick={exportToCSV}
                  disabled={history.merchants.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  엑셀로 내보내기
                </button>
              </div>

              {historyLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-900"></div>
                  <p className="text-gray-500 mt-4">로딩 중...</p>
                </div>
              ) : history.merchants.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500 font-medium">결제 기록이 없습니다</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm opacity-90">총 거래</span>
                      </div>
                      <p className="text-3xl font-bold">{totalTransactions}건</p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm opacity-90">총 금액</span>
                      </div>
                      <p className="text-3xl font-bold">{totalAmount.toLocaleString()}원</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {history.merchants.map((merchant: any) => (
                      <div key={merchant.merchant_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <button
                          onClick={() => toggleMerchant(merchant.merchant_id)}
                          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-3">
                              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h3 className="font-bold text-lg text-gray-900">{merchant.merchant_name}</h3>
                              <p className="text-gray-500 text-sm flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  {merchant.total_transactions}건
                                </span>
                                <span>·</span>
                                <span className="font-semibold text-gray-900">{merchant.total_amount.toLocaleString()}원</span>
                              </p>
                            </div>
                          </div>
                          <svg
                            className={`w-6 h-6 text-gray-400 transition-transform ${expandedMerchant === merchant.merchant_id ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedMerchant === merchant.merchant_id && (
                          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 space-y-3">
                            {merchant.users.map((user: any) => (
                              <div key={user.user_id} className="bg-white rounded-xl border-l-4 border-gray-900 p-4 shadow-sm">
                                <button
                                  onClick={() => toggleUser(user.user_id)}
                                  className="w-full text-left flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 rounded-full p-2">
                                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-900">{user.user_name}</p>
                                      <p className="text-gray-500 text-sm">
                                        {user.transactions.length}건의 거래
                                      </p>
                                    </div>
                                  </div>
                                  <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedUser === user.user_id ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {expandedUser === user.user_id && (
                                  <div className="mt-3 space-y-2">
                                    {user.transactions.map((tx: any) => (
                                      <div
                                        key={tx.transaction_id}
                                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                            <span className="font-semibold text-gray-900 text-sm">{tx.card_name}</span>
                                          </div>
                                          <span className="text-green-600 font-bold text-sm">
                                            -{tx.discount_amount.toLocaleString()}원
                                          </span>
                                        </div>
                                        <p className="text-gray-600 text-xs mb-2 bg-white rounded px-2 py-1">
                                          {tx.benefit_text}
                                        </p>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                          <div className="flex gap-3 text-xs text-gray-500">
                                            <span>결제: {tx.payment_amount.toLocaleString()}원</span>
                                            <span>·</span>
                                            <span className="font-semibold text-gray-900">최종: {tx.final_amount.toLocaleString()}원</span>
                                          </div>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          {new Date(tx.payment_date).toLocaleString('ko-KR')}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg pb-safe z-50">
        <div className="w-full h-px bg-gray-200"></div>
        <div className="flex max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 py-4 px-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${
              activeTab === 'payment' ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-xs font-semibold">결제</span>
          </button>
          <div className="w-px bg-gray-200"></div>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-4 px-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${
              activeTab === 'history' ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-semibold">기록보기</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
        .active\:scale-98:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
