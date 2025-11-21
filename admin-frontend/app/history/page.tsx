'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<any>({ merchants: [] });
  const [loading, setLoading] = useState(true);
  const [expandedMerchant, setExpandedMerchant] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payment/history`);
      setHistory(response.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMerchant = (merchantId: number) => {
    setExpandedMerchant(expandedMerchant === merchantId ? null : merchantId);
  };

  const toggleUser = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const totalTransactions = history.merchants.reduce((sum: number, m: any) => sum + m.total_transactions, 0);
  const totalAmount = history.merchants.reduce((sum: number, m: any) => sum + m.total_amount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm pt-safe">
        <div className="max-w-4xl mx-auto px-6 pb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">홈으로</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 기록</h1>
          <p className="text-sm text-gray-500">가맹점별 결제 내역을 확인하세요</p>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {loading ? (
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
              {/* Statistics Cards */}
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

              {/* Merchant List */}
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
      </main>
    </div>
  );
}
