export function loginEmailError(error: { status?: number }): string {
  if (error.status === 429)
    return "認証メールの送信回数の上限に達しました。時間をおいてから、もう一度だけお試しください。";
  return "認証メールを送信できませんでした。時間をおいてからお試しください。";
}
