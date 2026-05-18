"use client";
import { useEffect, useState } from "react";
import { vocApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  negative: "#ef4444", neutral: "#f59e0b", positive: "#22c55e",
};
const SENTIMENT_LABELS: Record<string, string> = {
  negative: "부정", neutral: "중립", positive: "긍정",
};
const BAR_COLORS = ["#3b82f6","#6366f1","#8b5cf6","#ec4899","#f97316"];

interface DashboardData {
  total: number;
  negative_ratio: number;
  sentiment_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  top_complaints: { category: string; count: number }[];
  trend_7days: { date: string; count: number }[];
  trend_30days: { date: string; count: number }[];
  product_issue_ranking: { name: string; count: number }[];
}

function StatCard({ label, value, sub, color = "text-gray-900" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

const TOP_N = 5;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<"7" | "30">("7");
  const [showAllCats, setShowAllCats] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vocApi.dashboard().then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full py-32 text-gray-400">불러오는 중...</div>;
  if (!data) return <EmptyState message="데이터를 불러올 수 없습니다." />;

  const sentimentPie = Object.entries(data.sentiment_distribution)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: SENTIMENT_LABELS[k] ?? k, value: v, key: k }));

  const categoryBar = Object.entries(data.category_distribution)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const trendData = trend === "7" ? data.trend_7days : data.trend_30days;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">고객 피드백 현황을 한눈에 확인하세요.</p>
      </div>

      {data.total === 0 ? (
        <EmptyState message="고객 피드백이 없습니다. 데이터를 불러와주세요." />
      ) : (
        <>
          {/* 주요 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="전체 피드백" value={data.total.toLocaleString()} sub="건" />
            <StatCard label="부정 피드백 비율" value={`${data.negative_ratio}%`} color="text-red-500" />
            <StatCard label="부정 피드백" value={data.sentiment_distribution.negative ?? 0} sub="건" color="text-red-400" />
            <StatCard label="긍정 피드백" value={data.sentiment_distribution.positive ?? 0} sub="건" color="text-green-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 감정 분포 도넛 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">감정 분포</h3>
              {sentimentPie.length === 0 ? <EmptyState message="데이터 없음" /> : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={sentimentPie}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {sentimentPie.map((entry) => (
                          <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}건`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* 커스텀 범례 — 겹침 없이 수치 표시 */}
                  <div className="flex justify-center gap-5 mt-2">
                    {sentimentPie.map((entry) => (
                      <div key={entry.key} className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: SENTIMENT_COLORS[entry.key] ?? "#94a3b8" }}
                        />
                        <span className="text-xs text-gray-600">
                          {entry.name}&nbsp;
                          <span className="font-semibold text-gray-900">{entry.value}건</span>
                          <span className="text-gray-400">
                            &nbsp;({((entry.value / data.total) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 카테고리별 막대 — TOP 5 기본, 전체 토글 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">카테고리별 피드백</h3>
              {categoryBar.length === 0 ? <EmptyState message="데이터 없음" /> : (() => {
                const displayed = showAllCats ? categoryBar : categoryBar.slice(0, TOP_N);
                const barHeight = Math.max(160, displayed.length * 40);
                return (
                  <>
                    <ResponsiveContainer width="100%" height={barHeight}>
                      <BarChart data={displayed} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip formatter={(v) => [`${v}건`]} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {displayed.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {categoryBar.length > TOP_N && (
                      <button
                        onClick={() => setShowAllCats(!showAllCats)}
                        className="mt-3 text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors"
                      >
                        {showAllCats
                          ? "접기"
                          : `+ ${categoryBar.length - TOP_N}개 카테고리 더 보기`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* 피드백 추이 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">피드백 추이</h3>
              <div className="flex gap-2">
                {(["7","30"] as const).map((d) => (
                  <button key={d} onClick={() => setTrend(d)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${trend === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
                    {d === "7" ? "최근 7일" : "최근 30일"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 불만 TOP5 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">불만 카테고리 TOP 5</h3>
              <div className="space-y-3">
                {data.top_complaints.map((item, i) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{item.category}</span>
                        <span className="text-gray-500">{item.count}건</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-red-400 rounded-full" style={{ width: `${(item.count / (data.top_complaints[0]?.count || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 제품/지점별 부정 VOC */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">제품/지점별 부정 피드백 순위</h3>
              {data.product_issue_ranking.length === 0 ? <EmptyState message="데이터 없음" /> : (
                <div className="space-y-2">
                  {data.product_issue_ranking.slice(0, 8).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </div>
                      <span className="text-red-500 font-semibold text-xs">{item.count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
