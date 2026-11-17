export type PageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function readSearchParams(params?: PageSearchParams) {
  return Object.fromEntries(
    Object.entries((await params) ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ) as Partial<Record<string, string>>;
}

export function sectionHref(value: string | undefined, section: "/app" | "/cliente") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return undefined;

  const base = "https://autoflow.invalid";
  if (!URL.canParse(value, base)) return undefined;
  const { origin, pathname, search, hash } = new URL(value, base);
  if (origin !== base || (pathname !== section && !pathname.startsWith(`${section}/`)))
    return undefined;

  return `${pathname}${search}${hash}`;
}
