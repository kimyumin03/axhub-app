"use client";
import { useEffect, useState } from "react";
import { reportApi } from "@/lib/api";

interface TopIssue { category: string; count: number; }
interface RisingKw { keyword: string; count: number; change: string; }
interface ProductIssue { name: string; count: number; }
interface Summary {
  total: number; negative_ratio: number; negative_count: number;
  top_product_issues: ProductIssue[];
}
interface Report {
  id: number; title: string; start_date: string; end_date: string; created_at: string;
  summary: Summary; top_issues: TopIssue[]; rising_keywords: RisingKw[];
  improvement_suggestions: string[];
}

const PRIORITY_COLOR = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-gray-300"];

function KpiCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-red-50 border-red-100" : "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SuggestionCard({ text, index }: { text: string; index: number }) {
  const colors = [
    "border-red-200 bg-red-50 text-red-900",
    "border-orange-200 bg-orange-50 text-orange-900",
    "border-yellow-200 bg-yellow-50 text-yellow-900",
    "border-blue-200 bg-blue-50 text-blue-900",
    "border-gray-200 bg-gray-50 text-gray-800",
  ];
  const icons = ["🚨", "⚠️", "📌", "💡", "📋"];
  return (
    <div className={`border rounded-xl p-4 ${colors[index % colors.length]}`}>
      <div className="flex gap-3">
        <span className="text-lg shrink-0">{icons[index % icons.length]}</span>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", start_date: "", end_date: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    reportApi.list().then((r) => { setReports(r.data); if (r.data.length > 0) setSelected(r.data[0]); })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("이 리포트를 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await reportApi.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally { setDeletingId(null); }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
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

  const maxIssueCount = selected?.top_issues[0]?.count ?? 1;

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">리포트</h2>
          <p className="text-sm text-gray-500 mt-1">기간별 피드백 분석 리포트 — 경영진 의사결정용</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + 새 리포트 생성
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
              placeholder="예: 2025년 5월 3주차 주간 피드백 분석"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-4">
            {(["start_date", "end_date"] as const).map((f) => (
              <div key={f} className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f === "start_date" ? "시작일" : "종료일"}
                </label>
                <input type="date" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={generating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {generating ? "생성 중..." : "리포트 생성"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); }}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
          </div>
        </form>
      )}

      <div className="flex gap-6">
        {/* 리포트 목록 */}
        <div className="w-64 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">리포트 목록</p>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-xs text-gray-400">리포트가 없습니다</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className={`rounded-xl border transition-all ${
                selected?.id === r.id ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-200 bg-white"
              }`}>
                <button onClick={() => setSelected(r)} className="w-full text-left p-3.5">
                  <p className="font-medium text-sm text-gray-800 line-clamp-2 leading-snug">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{r.start_date} ~ {r.end_date}</p>
                  {r.summary && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.summary.total}건</span>
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{r.summary.negative_ratio}% 부정</span>
                    </div>
                  )}
                </button>
                <div className="px-3.5 pb-2.5 flex justify-end">
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {deletingId === r.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 리포트 본문 */}
        {selected ? (
          <div className="flex-1 space-y-6">
            {/* 보고서 헤더 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">피드백 분석 리포트</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">{selected.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">분석 기간: {selected.start_date} ~ {selected.end_date}</p>
                </div>
                <p className="text-xs text-gray-400">{selected.created_at?.slice(0, 10)} 생성</p>
              </div>

              {/* KPI 요약 */}
              <div className="grid grid-cols-3 gap-4 mt-5">
                <KpiCard label="분석 기간 피드백" value={selected.summary.total.toLocaleString()} sub="건" />
                <KpiCard label="부정 의견 비율" value={`${selected.summary.negative_ratio}%`} sub={`${selected.summary.negative_count}건 부정`} accent />
                <KpiCard label="최다 불만 카테고리" value={selected.top_issues[0]?.category ?? "—"} sub={`${selected.top_issues[0]?.count ?? 0}건`} />
              </div>
            </div>

            {/* 불만 TOP 5 */}
            {selected.top_issues.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h4 className="text-sm font-bold text-gray-700 mb-4">불만 카테고리 TOP {selected.top_issues.length}</h4>
                <div className="space-y-3">
                  {selected.top_issues.map((item, i) => (
                    <div key={item.category} className="flex items-center gap-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${PRIORITY_COLOR[i] ?? "bg-gray-300"}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-800">{item.category}</span>
                          <span className="text-gray-500 tabular-nums">{item.count}건</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${PRIORITY_COLOR[i] ?? "bg-gray-300"}`}
                            style={{ width: `${(item.count / maxIssueCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 급증 키워드 + 제품/지점 */}
            <div className="grid grid-cols-2 gap-4">
              {selected.rising_keywords.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">급증 키워드</h4>
                  <div className="space-y-2">
                    {selected.rising_keywords.map((kw) => (
                      <div key={kw.keyword} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <span className="text-sm text-gray-800 font-medium">{kw.keyword}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{kw.count}건</span>
                          <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{kw.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.summary.top_product_issues?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">제품별 부정 피드백</h4>
                  <div className="space-y-2">
                    {selected.summary.top_product_issues.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                          <span className="text-sm text-gray-800">{p.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-red-500">{p.count}건</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI 개선 제안 */}
            {selected.improvement_suggestions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-sm font-bold text-gray-700">AI 개선 제안</h4>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    {selected.improvement_suggestions.length}건
                  </span>
                </div>
                <div className="space-y-3">
                  {selected.improvement_suggestions.map((s, i) => (
                    <SuggestionCard key={i} text={s} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* PDF 다운로드 (추후 연동용 placeholder) */}
            <div className="flex justify-end">
              <button disabled
                className="flex items-center gap-2 text-sm text-gray-400 border border-gray-200 rounded-lg px-4 py-2 cursor-not-allowed"
                title="PDF 다운로드는 추후 지원 예정입니다">
                ↓ PDF 다운로드 (준비 중)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
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
