"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-page">
      <span className="eyebrow">PRORIUM INVESTOR RELATIONS</span>
      <h1>読み込みに失敗しました。</h1>
      <p>接続状況を確認して、もう一度お試しください。</p>
      <button onClick={reset} className="button primary">
        再読み込み
      </button>
    </main>
  );
}
