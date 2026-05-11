// Heuristic — true means "likely a weak device, suggest low-perf mode".
// `navigator.deviceMemory` is undefined on iOS Safari; we treat that as unknown
// and don't auto-enable on those devices.
export function detectLowPerf() {
  if (typeof navigator === 'undefined') return false
  const mem = navigator.deviceMemory
  const cores = navigator.hardwareConcurrency
  const lowMem = typeof mem === 'number' && mem < 4
  const lowCores = typeof cores === 'number' && cores < 4
  return lowMem || lowCores
}
