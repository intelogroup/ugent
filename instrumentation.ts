export async function register() {
  // DEP0169: url.parse() deprecation fires from Next.js 15 internals on every
  // serverless invocation. It is harmless — suppress only this specific code.
  const origEmit = process.emit.bind(process);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as any).emit = function (event: string, ...args: unknown[]) {
    if (event === 'warning') {
      const w = args[0] as { code?: string };
      if (w?.code === 'DEP0169') return false;
    }
    return origEmit(event as never, ...(args as never[]));
  };
}
