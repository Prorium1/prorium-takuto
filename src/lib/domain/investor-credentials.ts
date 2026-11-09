export type InvestorCredentials = {
  email: string;
  password: string;
  loginUrl: string;
};
export function investorInvitationText(c: InvestorCredentials) {
  return `Prorium 株主専用ページのご案内\n\nログインURL：${c.loginUrl}\nメールアドレス：${c.email}\nパスワード：${c.password}\n\n上のURLを開き、メールアドレスとパスワードを入力してください。\nこのログイン情報はご本人のみでお使いください。`;
}
export function investorCredentialError(code: unknown) {
  const messages: Record<string, string> = {
    busy: "発行処理中です。2分ほど待ってから、もう一度お試しください。",
    registered:
      "このメールアドレスは登録済みです。一覧からパスワードを発行してください。",
    inactive:
      "アクセスが停止中、または未登録です。登録状況を確認してください。",
    "already-issued":
      "パスワードは発行済みです。新しく発行する場合は、再発行を選んでください。",
    unrelated:
      "既存のアカウントです。下の「メールのリンクだけで登録する」で登録し、一度ログインいただいた後にパスワードを発行できます。",
    "identity-changed":
      "登録時からメールアドレスが変わっています。投資家の登録情報を確認してください。",
    denied:
      "このアカウントのパスワードは、投資家の管理画面では変更できません。",
    invalid: "メールアドレスと確認項目を確認してください。",
    "password-policy":
      "認証サービスのパスワード条件を満たしていません。管理者が初期パスワードの設定を確認してください。",
  };
  return (
    (typeof code === "string" && messages[code]) ||
    "発行を完了できませんでした。登録一覧を確認し、2分ほど待ってから再度発行してください。"
  );
}
