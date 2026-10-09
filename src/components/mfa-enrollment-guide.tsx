import Image from "next/image";

export function MfaEnrollmentGuide({
  qrCode,
  secret,
}: {
  qrCode: string;
  secret: string;
}) {
  return (
    <div className="mfa-qr">
      <p>スマートフォンの認証アプリを開き、「＋」からQRコードをスキャンしてください。iPhoneのカメラで撮影するだけでは登録されません。</p>
      <Image
        unoptimized
        src={qrCode}
        alt="認証アプリ登録用のQRコード"
        width={200}
        height={200}
      />
      <p>アプリに「Prorium IR」が追加されたら、アプリに表示された6桁を下に入力してください。</p>
      <details>
        <summary>QRコードを読み取れない場合</summary>
        <p>認証アプリの「セットアップキーを入力」を選び、次のキーを登録してください。種類は「時間ベース」を選びます。</p>
        <code className="mfa-secret">{secret}</code>
      </details>
    </div>
  );
}
