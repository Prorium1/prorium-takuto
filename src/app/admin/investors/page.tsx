import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import {
  productionClient,
  databaseError,
} from "@/lib/server/production-repository";
import { InvestorAccessForm } from "@/components/admin/investor-access";
export const dynamic = "force-dynamic";
export default async function InvestorsPage() {
  const actor = await requireAdmin();
  let invitations: { email: string; active: boolean; created_at: string }[] =
    [];
  if (!isMockEnvironment()) {
    const client = await productionClient(actor, true);
    const { data, error } = await client.rpc("ir_list_invitations", {
      p_company: actor.companyId,
    });
    databaseError(error);
    invitations = data || [];
  }
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">INVESTOR ACCESS</span>
        <h1>投資家のアクセス管理</h1>
        <p>
          登録したメールアドレスで本人確認した方だけが、公開レポートと財務資料を閲覧できます。
        </p>
      </div>
      <section className="admin-panel">
        <InvestorAccessForm mock={isMockEnvironment()} />
        <p className="workflow-info">
          登録後、ログインURLをご本人に共有してください。アクセスを停止すると、次の閲覧・ダウンロードから取得できなくなります。
        </p>
        <div className="attached-files">
          {invitations.map((i) => (
            <div key={i.email}>
              <span>
                {i.email} · {i.active ? "アクセス有効" : "停止中"}
              </span>
              <InvestorAccessForm email={i.email} active={i.active} />
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
