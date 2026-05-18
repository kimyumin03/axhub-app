"use client";
import { useState, useRef } from "react";
import { vocApi } from "@/lib/api";

interface UploadResult {
  total: number; success: number; failed: number; errors: string[];
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) { setError("CSV 파일만 업로드 가능합니다."); return; }
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

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">CSV 업로드</h2>
        <p className="text-sm text-gray-500 mt-1">VOC 데이터를 CSV 파일로 업로드하세요.</p>
      </div>

      {/* CSV 형식 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-2">CSV 필수 컬럼</p>
        <code className="text-xs bg-blue-100 px-2 py-1 rounded">id, createdAt, sourceType, customerText</code>
        <p className="mt-2 text-xs text-blue-600">선택: productName, branchName, rating</p>
        <p className="mt-1 text-xs text-blue-600">sourceType: review / inquiry / complaint</p>
      </div>

      {/* 드래그 앤 드롭 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <p className="text-4xl mb-3">📂</p>
        {file ? (
          <>
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <p className="text-gray-600 font-medium">CSV 파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-gray-400 mt-1">최대 10MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <button
        onClick={handleUpload} disabled={!file || loading}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "분석 중..." : "업로드 및 AI 분석 시작"}
      </button>

      {/* 결과 */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">업로드 결과</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center"><p className="text-2xl font-bold text-gray-900">{result.total}</p><p className="text-xs text-gray-500">전체</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-green-600">{result.success}</p><p className="text-xs text-gray-500">성공</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-red-500">{result.failed}</p><p className="text-xs text-gray-500">실패</p></div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-600 mb-2">실패 사유</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
            </div>
          )}
          {result.success > 0 && (
            <p className="text-sm text-green-600 font-medium">✓ {result.success}건이 분석 완료되었습니다. 대시보드에서 확인하세요.</p>
          )}
        </div>
      )}
    </div>
  );
}
