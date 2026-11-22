// Never return these values to the client or include them in diagnostics.
export function serverCredential(read: (name: string) => string | undefined): string | undefined {
  const override = read("WATERMARK_SUPABASE_SECRET_KEY");
  if (override?.trim()) return override;
  const injected = read("SUPABASE_SECRET_KEYS");
  if (injected) {
    try {
      const keys: unknown = JSON.parse(injected);
      if (
        keys && typeof keys === "object" && !Array.isArray(keys) && "default" in keys &&
        typeof keys.default === "string" && keys.default.trim()
      ) return keys.default;
    } catch { /* Malformed configuration fails closed, without logging its value. */ }
    return undefined;
  }
  return read("SUPABASE_SERVICE_ROLE_KEY") ?? read("SUPABASE_SECRET_KEY");
}
