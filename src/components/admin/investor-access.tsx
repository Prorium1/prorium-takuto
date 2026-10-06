"use client";
import { useActionState } from "react";
import { investorAccessAction } from "@/app/investor-actions";
export function InvestorAccessForm({
  email,
  active,
  mock = false,
}: {
  email?: string;
  active?: boolean;
  mock?: boolean;
}) {
  const [state, action, pending] = useActionState(investorAccessAction, {});
  return (
    <div>
      <form action={action} className="create-form">
        {email ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <label>
            投資家のメールアドレス
            <input name="email" type="email" required disabled={mock} />
          </label>
        )}
        <input
          type="hidden"
          name="active"
          value={email && active ? "false" : "true"}
        />
        <button
          className={email ? "text-button" : "button primary"}
          disabled={pending || mock}
        >
          {email
            ? active
              ? "アクセスを停止"
              : "アクセスを再開"
            : "アクセス権を登録"}
        </button>
      </form>
      {mock && (
        <p className="workflow-info">
          Mock環境ではデモ用の投資家アカウントを使用します。本番のメールアドレスは登録しないでください。
        </p>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-success" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}
