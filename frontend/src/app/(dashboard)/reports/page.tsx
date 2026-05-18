"use client";
import { useEffect, useState } from "react";
import { reportApi } from "@/lib/api";

interface Report {
  id: number; title: string; start_date: string; end_date: string; created_at: string;
  summary: { total: number; negative_ratio: number; negative_count: number; top_product_issues: { name: string; count: number }[] };
  top_issues: { category: string; count: number }[];
  rising_keywords: { keyword: string; count: number; change: string }[];
  improvement_suggestions: string[];
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ title: "", start_date: "", end_date: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    try { const r = await reportApi.list(); setReports(r.data); } finally { setLoading(false); }
  }

  useEffect(() => { loadReports(); }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.end_date) return;
    setGenerating(true); setError("");
    try {
      const r = await reportApi.generate(form);
      setReports((prev) => [r.data, ...prev]);
      setSelected(r.data);
      setShowForm(false);
      setForm({ title: "", start_date: "", end_date: "" });
    } catch (e: any) {
      setError(e.response?.data?.detail || "리포트 생성 중 오류가 발생했습니다.");
    } finally { setGenerating(false); }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">리포트</h2>
          <p className="text-sm text-gray-500 mt-1">기간별 VOC 분석 리포트를 생성하세요.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + 새 리포트
        </button>
      </div>

      {/* 리포트 생성 폼 */}
      {showForm && (
        <form onSubmit={handleGenerate} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">리포트 생성</h3>
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">리포트 제목</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
              placeholder="예: 2025년 5월 3주차 VOC 분석"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={generating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {generating ? "생성 중..." : "리포트 생성"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 리포트 목록 */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm text-gray-400">리포트가 없습니다.<br />새 리포트를 생성해보세요.</p>
            </div>
          ) : (
            reports.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selected?.id === r.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}>
                <p className="font-medium text-sm text-gray-800 truncate">{r.title}</p>
                <p className="text-xs text-gray-400 mt-1">{r.start_date} ~ {r.end_date}</p>
                <p className="text-xs text-gray-300 mt-0.5">{r.created_at?.slice(0, 10)}</p>
              </button>
            ))
          )}
        </div>

        {/* 리포트 상세 */}
        {selected ? (
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.title}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{selected.start_date} ~ {selected.end_date}</p>
              </div>
            </div>

            {/* 요약 지표 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{selected.summary.total}</p>
                <p className="text-xs text-gray-500">전체 VOC</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{selected.summary.negative_ratio}%</p>
                <p className="text-xs text-gray-500">부정 비율</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">{selected.summary.negative_count}</p>
                <p className="text-xs text-gray-500">부정 건수</p>
              </div>
            </div>

            {/* 불만 TOP5 */}
            {selected.top_issues.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">불만 TOP 5</h4>
                <div className="space-y-2">
                  {selected.top_issues.map((item, i) => (
                    <div key={item.category} className="flex items-center gap-3 text-sm">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <span className="flex-1 text-gray-700">{item.category}</span>
                      <span className="font-semibold text-gray-900">{item.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 급증 키워드 */}
            {selected.rising_keywords.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">급증 키워드</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.rising_keywords.map((kw) => (
                    <span key={kw.keyword} className="flex items-center gap-1 bg-orange-50 border border-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full">
                      {kw.keyword} <span className="text-orange-500 font-bold">{kw.change}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI 개선 제안 */}
            {selected.improvement_suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">AI 개선 제안</h4>
                <div className="space-y-3">
                  {selected.improvement_suggestions.map((s, i) => (
                    <div key={i} className="flex gap-3 bg-blue-50 rounded-lg p-3">
                      <span className="text-blue-400 font-bold text-sm shrink-0">{i + 1}</span>
                      <p className="text-sm text-blue-800">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 제품/지점 이슈 */}
            {selected.summary.top_product_issues?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">제품/지점별 부정 VOC</h4>
                <div className="space-y-1">
                  {selected.summary.top_product_issues.map((p) => (
                    <div key={p.name} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="text-red-500 font-medium">{p.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center border border-dashed border-gray-200 rounded-xl py-20">
            <div className="text-center text-gray-400">
              <p className="text-4xl mb-3">◈</p>
              <p className="text-sm">좌측에서 리포트를 선택하거나<br />새 리포트를 생성하세요.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
