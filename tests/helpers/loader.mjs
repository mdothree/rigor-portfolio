// Test-only module hook: app.js's browser dependencies resolve to one local stub.
const stub = new URL('./stub-deps.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (/^\.\/(services|utils|config)\/[A-Za-z]+\.js$/.test(specifier) && context.parentURL?.includes('/public/js/app.js')) {
    return { url: stub, shortCircuit: true };
  }
  return next(specifier, context);
}
