// Per-process DSH tool boundary, using the installed tools.guard contract.
// This is an application guard, not an OS sandbox.
import path from 'node:path';
import fs from 'node:fs';

export const inject = ['tools'];
const allowed = new Set(['read', 'read_image', 'write', 'edit', 'glob', 'grep']);

function canonical(p) {
  const suffix = [];
  while (!fs.existsSync(p)) {
    const parent = path.dirname(p);
    if (parent === p) throw Error('unresolvable path');
    suffix.unshift(path.basename(p));
    p = parent;
  }
  return path.resolve(fs.realpathSync(p), ...suffix);
}

export function guardFor(root) {
  const base = canonical(path.resolve(root));
  const inside = p => {
    const relative = path.relative(base, canonical(path.resolve(base, p)));
    return !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
  };
  return execution => {
    if (!allowed.has(execution.name)) return 'Tool is unavailable in this file/image test.';
    const args = execution.arguments;
    if (!args || typeof args !== 'object') return 'Invalid tool arguments.';
    try {
      for (const key of ['file_path', 'path']) {
        if (args[key] !== undefined && (typeof args[key] !== 'string' || !inside(args[key]))) {
          return 'File access outside the current workspace is denied.';
        }
      }
      if (['read', 'read_image', 'write', 'edit'].includes(execution.name) && typeof args.file_path !== 'string') {
        return 'A workspace file path is required.';
      }
      if (execution.name === 'glob') {
        const pattern = args.pattern;
        if (typeof pattern !== 'string' || path.isAbsolute(pattern) || pattern.split(/[\\/]/).includes('..')) {
          return 'Glob patterns must remain inside the current workspace.';
        }
      }
    } catch {
      return 'Cannot resolve a workspace-confined path.';
    }
  };
}

export function apply(ctx) {
  ctx.tools.guard(guardFor(process.cwd()));
}
