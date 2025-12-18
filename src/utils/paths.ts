import { resolve, isAbsolute } from 'path';

/**
 * Resolve a path relative to a working directory.
 * If the path is already absolute, return it as-is.
 * If relative, resolve it against the working directory.
 */
export function resolvePath(path: string, workingDirectory: string): string {
  if (!path) return path;

  // Handle home directory shortcut
  if (path.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return resolve(home, path.slice(2));
  }

  // If absolute, return as-is
  if (isAbsolute(path)) {
    return path;
  }

  // Resolve relative path against working directory
  return resolve(workingDirectory, path);
}
