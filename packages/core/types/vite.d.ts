import type { Plugin } from 'vite';

export interface AeuiViteOptions {
  compiler?: 'swc' | 'babel';
  alias?: string | false;
  aliasDir?: string;
  appEntry?: string;
  rootId?: string;
  styles?: string | false;
}

export default function aeui(options?: AeuiViteOptions): Plugin;
