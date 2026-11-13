export async function apiRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(45_000),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar. Confira sua conexão e tente novamente. Seus dados continuam nesta tela.",
    );
  }
  let data: T & { ok?: boolean; error?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.status === 413
        ? "O arquivo é muito grande. Envie uma foto de até 4 MB."
        : "O servidor não respondeu como esperado. Tente novamente em instantes.",
    );
  }
  if (!response.ok || data.ok === false || data.error)
    throw new Error(
      data.error ||
        (response.status === 401
          ? "Sua sessão expirou. Entre novamente para continuar."
          : "Não foi possível concluir a ação. Tente novamente."),
    );
  return data;
}
