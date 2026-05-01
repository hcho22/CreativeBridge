// Minimal pako type shim — upstream package does not ship its own .d.ts
// and @types/pako is not installed. Only the symbols we use are declared.
// Tracking: pako has no first-party types; if @types/pako is later added
// or the package ships types, this file can be removed.
declare module 'pako' {
  export function gzip(
    data: Uint8Array | string,
    options?: { level?: number },
  ): Uint8Array;
  export function ungzip(
    data: Uint8Array | string,
    options?: { to?: 'string' },
  ): Uint8Array;
  export function deflate(
    data: Uint8Array | string,
    options?: { level?: number },
  ): Uint8Array;
  export function inflate(
    data: Uint8Array | string,
    options?: { to?: 'string' },
  ): Uint8Array;
  const pako: {
    gzip: typeof gzip;
    ungzip: typeof ungzip;
    deflate: typeof deflate;
    inflate: typeof inflate;
  };
  export default pako;
}
