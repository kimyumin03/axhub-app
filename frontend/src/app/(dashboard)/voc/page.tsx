"use client";
import { useEffect, useState, useCallback } from "react";
import { vocApi } from "@/lib/api";

const SENTIMENT_BADGE: Record<string, string> = {
  negative: "bg-red-100 text-red-700",
  neutral: "bg-yellow-100 text-yellow-700",
  positive: "bg-green-100 text-green-700",
};
const SENTIMENT_KR: Record<string, string> = { negative: "부정", neutral: "중립", positive: "긍정" };
const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500 text-white", medium: "bg-orange-400 text-white", low: "bg-gray-200 text-gray-600",
};
const PRIORITY_KR: Record<string, string> = { high: "높음", medium: "중간", low: "낮음" };

interface VocItem {
  id: number; external_id: string; created_at: string; source_type: string;
  product_name: string; branch_name: string; customer_text: string; rating: number;
  analysis: { category: string; sentiment: string; keywords: string[]; priority_score: string } | null;
}

export default function VocPage() {
  const [items, setItems] = useState<VocItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sentiment: "", category: "", source_type: "", keyword: "", start_date: "", end_date: "" });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, page_size: 20 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await vocApi.records(params);
      setItems(res.data.items);
      setTotal(res.data.total);
      setPage(p);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, [filters]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">고객 피드백</h2>
        <p className="text-sm text-gray-500 mt-1">총 {total.toLocaleString()}건</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        <span className="self-center text-gray-400 text-sm">~</span>
        <input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        {[
          { key: "sentiment", opts: [["", "감정 전체"], ["negative", "부정"], ["neutral", "중립"], ["positive", "긍정"]] },
          { key: "source_type", opts: [["", "유형 전체"], ["review", "리뷰"], ["inquiry", "문의"], ["complaint", "불만"]] },
          { key: "category", opts: [["", "카테고리 전체"], ["배송","배송"],["환불","환불"],["품질","품질"],["가격","가격"],["직원 응대","직원 응대"],["예약","예약"],["결제","결제"],["앱 오류","앱 오류"],["기타","기타"]] },
        ].map(({ key, opts }) => (
          <select key={key} value={(filters as any)[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <input placeholder="키워드 검색" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-36" />
        <button onClick={() => setFilters({ sentiment: "", category: "", source_type: "", keyword: "", start_date: "", end_date: "" })}
          className="text-xs text-gray-400 hover:text-gray-600 px-2">초기화</button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">조건에 맞는 피드백이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["날짜","유형","제품/지점","고객 원문","감정","카테고리","우선순위","평점"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{item.created_at?.slice(0, 10) ?? "-"}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.source_type}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{item.product_name || item.branch_name || "-"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-700 line-clamp-2">{item.customer_text}</p>
                      {(item.analysis?.keywords?.length ?? 0) > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.analysis!.keywords.map((kw) => (
                            <span key={kw} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{kw}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.analysis ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_BADGE[item.analysis.sentiment]}`}>
                          {SENTIMENT_KR[item.analysis.sentiment]}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{item.analysis?.category ?? "-"}</td>
                    <td className="px-4 py-3">
                      {item.analysis ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[item.analysis.priority_score]}`}>
                          {PRIORITY_KR[item.analysis.priority_score]}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{item.rating ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => load(p)}
              className={`w-8 h-8 text-xs rounded-lg ${page === p ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
