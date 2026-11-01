export type AuthDecision =
  | { authorized: true; via: 'cron' | 'user' }
  | { authorized: false; status: 401 | 403 | 503 };

export type DashboardAuthInput = {
  authorizationHeader: string | string[] | undefined;
  cronSecret?: string;
  adminEmails: readonly string[];
  verifyUserToken: (token: string) => Promise<{ email?: string | null } | null>;
};

type SupabaseUserResult = {
  data?: { user?: { email?: string | null } | null } | null;
  error?: { status?: number } | null;
};

/** Adapt Supabase Auth's getUser response to the dashboard verifier contract. */
export function verifySupabaseUserToken(
  getUser: (token: string) => Promise<SupabaseUserResult>,
  token: string,
): Promise<{ email?: string | null } | null> {
  return getUser(token).then(({ data, error }) => {
    if (error) {
      if (error.status === 400 || error.status === 401 || error.status === 403) return null;
      throw error;
    }
    const user = data?.user;
    return user ? { email: user.email } : null;
  });
}

/** Return true only when a single bearer header exactly matches a configured secret. */
export function isValidCronBearer(
  authorizationHeader: string | string[] | undefined,
  cronSecret: string | undefined,
): boolean {
  if (typeof authorizationHeader !== 'string' || !cronSecret) return false;
  return authorizationHeader.slice(0, 7).toLowerCase() === 'bearer '
    && authorizationHeader.slice(7) === cronSecret;
}

function parseBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+([^\s,]+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function authorizeDashboardRequest(
  input: DashboardAuthInput,
): Promise<AuthDecision> {
  if (isValidCronBearer(input.authorizationHeader, input.cronSecret)) {
    return { authorized: true, via: 'cron' };
  }

  const token = parseBearerToken(input.authorizationHeader);
  if (!token) return { authorized: false, status: 401 };

  let user: { email?: string | null } | null;
  try {
    user = await input.verifyUserToken(token);
  } catch {
    return { authorized: false, status: 503 };
  }

  if (!user) return { authorized: false, status: 401 };
  if (typeof user.email !== 'string' || !user.email.trim()) {
    return { authorized: false, status: 403 };
  }

  const email = user.email.trim().toLowerCase();
  const isAdmin = input.adminEmails.some(
    (adminEmail) => adminEmail.trim().toLowerCase() === email,
  );
  return isAdmin
    ? { authorized: true, via: 'user' }
    : { authorized: false, status: 403 };
}

export function isProtectedReportRoute(resource: string, id: string): boolean {
  return resource === 'reports'
    && (id === 'history' || id === 'history.csv' || id === 'conflicts');
}
