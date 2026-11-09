export type CredentialInput = {
  companyId: string;
  email: string;
  mode: "create" | "issue" | "reset";
  acknowledged: boolean;
  password?: string;
};
export type CredentialErrorCode =
  | "invalid"
  | "denied"
  | "busy"
  | "registered"
  | "inactive"
  | "already-issued"
  | "unrelated"
  | "identity-changed"
  | "password-policy"
  | "unavailable";
export class CredentialError extends Error {
  constructor(readonly code: CredentialErrorCode) {
    super(code);
  }
}
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function credentialInput(raw: unknown): CredentialInput {
  if (!raw || typeof raw !== "object") throw new CredentialError("invalid");
  const o = raw as Record<string, unknown>;
  if (
    Object.keys(o).some(
      (k) =>
        !["companyId", "email", "mode", "acknowledged", "password"].includes(k),
    ) ||
    typeof o.companyId !== "string" ||
    !uuid.test(o.companyId) ||
    typeof o.email !== "string" ||
    !["create", "issue", "reset"].includes(String(o.mode))
  )
    throw new CredentialError("invalid");
  if (
    o.password !== undefined &&
    (typeof o.password !== "string" ||
      o.password.length < 6 ||
      o.password.length > 128 ||
      /[\u0000-\u0020\u007f]/.test(o.password))
  )
    throw new CredentialError("invalid");
  const email = o.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (o.mode !== "create" && o.acknowledged !== true)
  )
    throw new CredentialError("invalid");
  return {
    companyId: o.companyId,
    email,
    mode: o.mode as CredentialInput["mode"],
    acknowledged: o.acknowledged === true,
    ...(o.password === undefined ? {} : { password: o.password as string }),
  };
}
export function passwordError(message: string): CredentialError {
  const codes: Record<string, CredentialErrorCode> = {
    CREDENTIAL_BUSY: "busy",
    CREDENTIAL_REGISTERED: "registered",
    CREDENTIAL_NOT_REGISTERED: "inactive",
    CREDENTIAL_INACTIVE: "inactive",
    CREDENTIAL_ALREADY_ISSUED: "already-issued",
    CREDENTIAL_UNRELATED_ACCOUNT: "unrelated",
    CREDENTIAL_IDENTITY_CHANGED: "identity-changed",
    CREDENTIAL_PROTECTED: "denied",
    CREDENTIAL_ADMIN_REQUIRED: "denied",
  };
  return new CredentialError(
    Object.entries(codes).find(([marker]) => message.includes(marker))?.[1] ||
      "unavailable",
  );
}
export function generateInvestorPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  for (;;) {
    let value = "";
    while (value.length < 20) {
      for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
        if (byte < Math.floor(256 / alphabet.length) * alphabet.length)
          value += alphabet[byte % alphabet.length];
        if (value.length === 20) break;
      }
    }
    if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /[2-9]/.test(value))
      return value.match(/.{5}/g)!.join("-");
  }
}
type Identity = { id: string; email?: string };
export type CredentialDependencies = {
  authorize(): Promise<{ id: string; role: string; companyId: string } | null>;
  reserve(
    input: CredentialInput,
  ): Promise<{ requestId: string; email: string; targetUserId: string | null }>;
  create(email: string, password: string, companyId: string): Promise<Identity>;
  update(userId: string, email: string, password: string): Promise<Identity>;
  complete(
    input: CredentialInput,
    requestId: string,
    actorId: string,
    userId: string,
  ): Promise<boolean>;
};
export async function issueInvestorCredentials(
  raw: unknown,
  deps: CredentialDependencies,
) {
  const input = credentialInput(raw);
  const actor = await deps.authorize();
  if (
    !actor ||
    actor.role !== "admin" ||
    actor.companyId !== input.companyId ||
    !uuid.test(actor.id)
  )
    throw new CredentialError("denied");
  const reservation = await deps.reserve(input);
  if (
    !uuid.test(reservation.requestId) ||
    reservation.email !== input.email ||
    (reservation.targetUserId !== null && !uuid.test(reservation.targetUserId))
  )
    throw new CredentialError("unavailable");
  if (
    reservation.targetUserId &&
    (!input.acknowledged || input.mode === "create")
  )
    throw new CredentialError("denied");
  const password = input.password ?? generateInvestorPassword();
  const user = reservation.targetUserId
    ? await deps.update(reservation.targetUserId, input.email, password)
    : await deps.create(input.email, password, input.companyId);
  if (
    !uuid.test(user.id) ||
    user.email?.toLowerCase() !== input.email ||
    (reservation.targetUserId && user.id !== reservation.targetUserId)
  )
    throw new CredentialError("identity-changed");
  if (!(await deps.complete(input, reservation.requestId, actor.id, user.id)))
    throw new CredentialError("unavailable");
  return { email: input.email, password };
}
