export function LoadingOverlay({ message = "資料載入中…" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-700 px-8 py-6 shadow-2xl">
        <svg
          className="animate-spin h-8 w-8 text-zinc-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-zinc-300 font-medium">{message}</span>
      </div>
    </div>
  );
}
