export function getScreenshotUrl(filePath) {
  if (!filePath) return ''
  const idx = filePath.indexOf('screenshots')
  if (idx === -1) return ''
  return '/' + filePath.slice(idx).replace(/\\/g, '/')
}

export function formatFileSize(bytes) {
  const numBytes = Number(bytes)
  if (!numBytes || isNaN(numBytes) || numBytes < 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(numBytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function calculateMegaPixels(width, height) {
  if (!width || !height) return '0'
  return ((width * height) / 1000000).toFixed(2)
}

export function formatRegion(region) {
  if (!region) return ''
  return `(${region.region_x}, ${region.region_y}) - ${region.region_width}×${region.region_height}`
}

export function findSmartByStrategy(smartVersions, strategy, preferNonManual = true) {
  if (!smartVersions || smartVersions.length === 0) return null

  if (preferNonManual) {
    const match = smartVersions.find(s => s.strategy === strategy && !s.is_manual_region)
    if (match) return match
  }

  return smartVersions.find(s => s.strategy === strategy) || smartVersions[0]
}

export function findRegionByStrategy(regions, strategy) {
  if (!regions || regions.length === 0) return null
  return regions.find(r => r.strategy === strategy) || regions[0]
}

export function hasStrategyRegions(regions, strategy) {
  if (!regions || regions.length === 0) return false
  return regions.some(r => r.strategy === strategy)
}

export function hasStrategySmart(smartVersions, strategy) {
  if (!smartVersions || smartVersions.length === 0) return false
  return smartVersions.some(s => s.strategy === strategy)
}
