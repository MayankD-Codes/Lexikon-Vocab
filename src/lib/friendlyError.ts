// Maps backend errors to safe, user-friendly messages.
// Full details are logged to the console for developers; end users see generic text.

type MaybeError = {
  code?: string | number;
  message?: string;
  name?: string;
  status?: number;
} | null | undefined;

export function friendlyError(err: MaybeError, fallback = "Something went wrong. Please try again."): string {
  if (import.meta.env.DEV && err) {
    // eslint-disable-next-line no-console
    console.error("[friendlyError]", err);
  }
  const code = err?.code ? String(err.code) : "";
  switch (code) {
    case "23505":
      return "That entry already exists.";
    case "23503":
      return "Related data not found.";
    case "23514":
      return "Some values are not allowed.";
    case "42501":
    case "PGRST301":
      return "You do not have permission to do that.";
    case "PGRST116":
      return "Item not found.";
  }
  return fallback;
}

export function friendlyAuthError(_err: MaybeError): string {
  if (import.meta.env.DEV && _err) {
    // eslint-disable-next-line no-console
    console.error("[friendlyAuthError]", _err);
  }
  return "Incorrect email or password.";
}

export function friendlyStorageError(_err: MaybeError): string {
  if (import.meta.env.DEV && _err) {
    // eslint-disable-next-line no-console
    console.error("[friendlyStorageError]", _err);
  }
  return "Upload failed. Please try a different file.";
}
