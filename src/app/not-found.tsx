import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-page">
      <span className="eyebrow">PRORIUM INVESTOR RELATIONS</span>
      <h1>このページは表示できません。</h1>
      <p>レポートが存在しないか、閲覧権限がありません。</p>
      <Link href="/dashboard" className="button primary">
        レポートへ戻る
      </Link>
    </main>
  );
}
