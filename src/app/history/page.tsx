import { HistoryClient } from "./HistoryClient";

export default function HistoryPage() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-bold">歷史費率走勢</h1>
        <span className="text-sm text-zinc-500">直接從交易所取得，最多 500 筆</span>
      </div>
      <HistoryClient />
    </div>
  );
}
