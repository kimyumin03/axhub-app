"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { vocApi } from "@/lib/api";

interface PreviewData {
  columns: string[];
  sample_rows: Record<string, string>[];
  total_rows: number;
  suggested_mapping: Record<string, string>;
}
interface FailedRow { row: number; id: string; reason: string; preview: string; }
interface UploadResult { total: number; success: number; failed: number; failed_rows: FailedRow[]; }

const INTERNAL_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "customerText", label: "고객 원문", required: true },
  { key: "createdAt",    label: "날짜",      required: false },
  { key: "sourceType",   label: "유형",      required: false },
  { key: "id",           label: "ID",        required: false },
  { key: "productName",  label: "제품명",    required: false },
  { key: "branchName",   label: "지점명",    required: false },
  { key: "rating",       label: "평점",      required: false },
];

function downloadTemplate() {
  const csv = `id,createdAt,sourceType,customerText,productName,rating\nVOC-001,2025-05-01,complaint,배송이 너무 늦어요. 5일이 지났는데 아직도 안 왔습니다.,여름 원피스,1\nVOC-002,2025-05-02,review,품질이 정말 좋아요! 재구매 의사 있습니다.,청바지,5\nVOC-003,2025-05-03,inquiry,사이즈 교환이 가능한가요?,운동화,3\n`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "voc_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

type Step = 1 | 2 | 3;

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  function handleFile(f: File) {
    const ok = f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".txt");
    if (!ok) { setError("CSV, Excel(xlsx/xls), TXT 파일만 업로드 가능합니다."); return; }
    if (f.size > 100 * 1024 * 1024) { setError("파일 크기는 100MB를 초과할 수 없습니다."); return; }
    setFile(f); setError("");
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true); setError("");
    try {
      const res = await vocApi.preview(file);
      const data: PreviewData = res.data;
      setPreview(data);
      setMapping(data.suggested_mapping);
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.detail || "파일을 읽을 수 없습니다.");
    } finally { setPreviewing(false); }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const res = await vocApi.upload(file, mapping);
      setResult(res.data);
      setStep(3);
    } catch (e: any) {
      setError(e.response?.data?.detail || "업로드 중 오류가 발생했습니다.");
    } finally { setUploading(false); }
  }

  function reset() {
    setStep(1); setFile(null); setPreview(null);
    setMapping({}); setResult(null); setError("");
  }

  const successRate = result ? Math.round((result.success / result.total) * 100) : 0;
  const mappedCustomerText = mapping["customerText"];
  const canUpload = !!mappedCustomerText;

  return (
    <div className="p-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CSV 업로드</h2>
          <p className="text-sm text-gray-500 mt-1">고객 피드백 데이터를 업로드하면 자동으로 분류·분석합니다.</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors">
          ↓ 템플릿 다운로드
        </button>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0">
        {[
          { n: 1, label: "파일 선택" },
          { n: 2, label: "컬럼 매핑" },
          { n: 3, label: "완료" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              step === n ? "bg-blue-600 text-white" :
              step > n  ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-400"
            }`}>
              <span className="text-xs font-bold">{step > n ? "✓" : n}</span>
              <span>{label}</span>
            </div>
            {i < 2 && <div className={`h-px w-8 mx-1 ${step > n ? "bg-green-300" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      {/* ── STEP 1: 파일 선택 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-800">CSV 컬럼 안내</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
              <div><span className="font-medium text-blue-900">필수</span> — 고객 원문 컬럼 1개 (이름 무관)</div>
              <div><span className="font-medium text-blue-900">선택</span> — 날짜, 유형, 제품명, 지점명, 평점</div>
              <div><span className="font-medium text-blue-900">유형 값</span> — review / inquiry / complaint</div>
              <div><span className="font-medium text-blue-900">날짜 형식</span> — YYYY-MM-DD, YYYY/MM/DD 등</div>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
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
                <p className="text-gray-600 font-medium">CSV / Excel 파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS, TXT · 최대 100MB</p>
              </>
            )}
          </div>

          <button onClick={handlePreview} disabled={!file || previewing}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {previewing ? <><span className="animate-spin">◌</span> 파일 분석 중...</> : "다음 단계 — 컬럼 매핑"}
          </button>
        </div>
      )}

      {/* ── STEP 2: 컬럼 매핑 ── */}
      {step === 2 && preview && (
        <div className="space-y-5">
          {/* 샘플 데이터 미리보기 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">데이터 미리보기 (상위 3행)</p>
              <p className="text-xs text-gray-400">전체 {preview.total_rows.toLocaleString()}행</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {preview.columns.map((col) => (
                      <th key={col} className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.sample_rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {preview.columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{row[col] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 매핑 폼 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">컬럼 매핑</p>
              <p className="text-xs text-gray-400 mt-0.5">CSV 컬럼을 시스템 필드에 연결하세요. 고객 원문은 필수입니다.</p>
            </div>
            <div className="space-y-3">
              {INTERNAL_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 flex items-center gap-1">
                    <span className="text-sm text-gray-700 font-medium">{label}</span>
                    {required && <span className="text-xs text-red-500">*</span>}
                  </div>
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (val) next[key] = val; else delete next[key];
                        return next;
                      });
                    }}
                    className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      required && !mapping[key] ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                  >
                    <option value="">— 매핑 안 함</option>
                    {preview.columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  {mapping[key] && (
                    <span className="text-xs text-green-600 font-medium shrink-0">✓ 연결됨</span>
                  )}
                </div>
              ))}
            </div>
            {!canUpload && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">고객 원문 컬럼을 선택해야 업로드할 수 있습니다.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setError(""); }}
              className="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              ← 이전
            </button>
            <button onClick={handleUpload} disabled={!canUpload || uploading}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {uploading ? <><span className="animate-spin">◌</span> 스마트 분석 중...</> : `업로드 및 스마트 분석 시작 (${preview.total_rows.toLocaleString()}행)`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 결과 ── */}
      {step === 3 && result && (
        <div className="space-y-4">
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

          <button onClick={reset}
            className="w-full border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors">
            새 파일 업로드
          </button>
        </div>
      )}
    </div>
  );
}
