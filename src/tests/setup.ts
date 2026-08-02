// Shared test setup.
// Ensures a stable, side-effect-free environment for every unit/integration run.
//
// Silence `console.error` globally for the test run:
// - env.ts logs validation issues at import time (env vars are absent in tests)
// - route handlers log caught errors on best-effort paths (RAG failure, 500s)
// These are intentional, tested paths — their noise would drown real output.
// A direct assignment (not spyOn) is used so `restoreMocks` cannot undo it.
console.error = () => {};
