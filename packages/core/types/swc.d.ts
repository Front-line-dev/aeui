export interface AeuiSwcOptions {
  filename?: string;
  development?: boolean;
  sourceMaps?: boolean;
}

/** SWC parsing, AEUI component preparation, and automatic JSX emission. */
export default function transform(source: string, options?: AeuiSwcOptions): {
  code: string;
  map?: string;
};
