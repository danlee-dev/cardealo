'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  category: string | null;
  latitude: number;
  longitude: number;
}

interface Merchant {
  id: number;
  place_id: string;
  name: string;
  address: string | null;
  category: string | null;
  created_at: string;
}

export default function MerchantSetupPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedMerchants, setSelectedMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSelectedMerchants();
  }, []);

  const fetchSelectedMerchants = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/merchants`);
      setSelectedMerchants(response.data);
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
    }
  };

  const searchMerchants = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`${API_URL}/api/merchants/search`, {
        params: { query }
      });

      if (response.data.results) {
        setSearchResults(response.data.results);
      } else {
        setError(response.data.message || '검색 결과가 없습니다');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '검색에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const selectMerchant = async (merchant: SearchResult) => {
    try {
      await axios.post(`${API_URL}/api/merchants/select`, {
        place_id: merchant.place_id,
        name: merchant.name,
        address: merchant.address,
        category: merchant.category,
        latitude: merchant.latitude,
        longitude: merchant.longitude
      });

      fetchSelectedMerchants();
      setSearchResults([]);
      setQuery('');
    } catch (err: any) {
      alert(err.response?.data?.detail || '가맹점 추가에 실패했습니다');
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
        <h1 className="text-2xl font-bold text-text mt-2">가맹점 설정</h1>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-subtle shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">가맹점 검색</h2>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchMerchants()}
                placeholder="가맹점 이름 또는 주소 검색"
                className="flex-1 border-2 border-border rounded-subtle px-4 py-2 focus:outline-none focus:border-primary"
              />
              <button
                onClick={searchMerchants}
                disabled={loading}
                className="bg-primary text-white px-6 py-2 rounded-subtle hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? '검색 중...' : '검색'}
              </button>
            </div>

            {error && (
              <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-subtle text-sm">
                {error}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">검색 결과</h3>
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.place_id}
                      className="border border-border rounded-subtle p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => selectMerchant(result)}
                    >
                      <div className="font-semibold text-text">{result.name}</div>
                      <div className="text-sm text-text-secondary mt-1">{result.address}</div>
                      {result.category && (
                        <div className="text-xs text-primary mt-1">{result.category}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-subtle shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">등록된 가맹점</h2>

            {selectedMerchants.length === 0 ? (
              <div className="text-center text-text-secondary py-8">
                등록된 가맹점이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMerchants.map((merchant) => (
                  <div
                    key={merchant.id}
                    className="border border-border rounded-subtle p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-text">{merchant.name}</div>
                        <div className="text-sm text-text-secondary mt-1">{merchant.address}</div>
                        {merchant.category && (
                          <div className="text-xs text-primary mt-1">{merchant.category}</div>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary">
                        ID: {merchant.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
