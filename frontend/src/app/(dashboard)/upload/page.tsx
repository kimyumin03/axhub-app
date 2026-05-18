"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { vocApi } from "@/lib/api";

interface FailedRow { row: number; id: string; reason: string; preview: string; }
interface UploadResult { total: number; success: number; failed: number; failed_rows: FailedRow[]; }

const TEMPLATE_CSV = `id,createdAt,sourceType,customerText,productName,rating
VOC-001,2025-05-01,complaint,배송이 너무 늦어요. 5일이 지났는데 아직도 안 왔습니다.,여름 원피스,1
VOC-002,2025-05-02,review,품질이 정말 좋아요! 재구매 의사 있습니다.,청바지,5
VOC-003,2025-05-03,inquiry,사이즈 교환이 가능한가요?,운동화,3
`;

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "voc_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) { setError("CSV 파일만 업로드 가능합니다."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("파일 크기는 10MB를 초과할 수 없습니다."); return; }
    setFile(f); setResult(null); setError("");
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await vocApi.upload(file);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "업로드 중 오류가 발생했습니다.");
    } finally { setLoading(false); }
  }

  const successRate = result ? Math.round((result.success / result.total) * 100) : 0;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CSV 업로드</h2>
          <p className="text-sm text-gray-500 mt-1">VOC 데이터를 CSV 파일로 업로드하면 AI가 자동으로 분류·분석합니다.</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors">
          ↓ 템플릿 다운로드
        </button>
      </div>

      {/* 컬럼 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">CSV 컬럼 안내</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
          <div><span className="font-medium text-blue-900">필수</span> — id, createdAt, sourceType, customerText</div>
          <div><span className="font-medium text-blue-900">선택</span> — productName, branchName, rating (1~5)</div>
          <div><span className="font-medium text-blue-900">sourceType 값</span> — review / inquiry / complaint</div>
          <div><span className="font-medium text-blue-900">날짜 형식</span> — YYYY-MM-DD, YYYY/MM/DD 등</div>
        </div>
      </div>

      {/* 드래그 앤 드롭 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {file ? (
          <>
            <p className="text-3xl mb-2">✓</p>
            <p className="font-semibold text-green-700">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB · 클릭하여 파일 변경</p>
          </>
        ) : (
          <>
            <p className="text-4xl mb-3">📂</p>
            <p className="text-gray-600 font-medium">CSV 파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-gray-400 mt-1">최대 10MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      <button onClick={handleUpload} disabled={!file || loading}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
        {loading ? (
          <><span className="animate-spin">◌</span> AI 분석 중...</>
        ) : "업로드 및 AI 분석 시작"}
      </button>

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">업로드 결과</h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${result.failed === 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                성공률 {successRate}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">전체</p>
              </div>
              <div className="text-center bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-xs text-gray-500 mt-0.5">분석 완료</p>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                <p className="text-xs text-gray-500 mt-0.5">실패</p>
              </div>
            </div>
            {/* 진행 바 */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${successRate}%` }} />
            </div>
            {result.success > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-green-600 font-medium">✓ {result.success}건 분석 완료. 대시보드에서 확인하세요.</p>
                <button onClick={() => router.push("/dashboard")}
                  className="text-xs text-blue-600 hover:underline font-medium">대시보드 보기 →</button>
              </div>
            )}
          </div>

          {/* 실패 행 테이블 */}
          {result.failed_rows.length > 0 && (
            <div className="bg-white border border-red-100 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm font-semibold text-red-700">실패 행 상세 ({result.failed_rows.length}건)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["행 번호", "ID", "실패 사유", "원문 미리보기"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.failed_rows.map((row) => (
                      <tr key={row.row} className="hover:bg-red-50">
                        <td className="px-4 py-2.5 text-gray-500">{row.row}행</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{row.id}</td>
                        <td className="px-4 py-2.5 text-red-600">{row.reason}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{row.preview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
