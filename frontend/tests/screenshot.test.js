import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getScreenshotUrl,
  formatFileSize,
  calculateMegaPixels,
  formatRegion,
  findSmartByStrategy,
  findRegionByStrategy,
  hasStrategyRegions,
  hasStrategySmart
} from '../src/utils/screenshot.js'

test('getScreenshotUrl 正确转换 Windows 路径', () => {
  const winPath = 'D:\\code\\gy\\47\\backend\\screenshots\\test_url\\2024-01-01\\12-00-00_full.png'
  const result = getScreenshotUrl(winPath)
  assert.ok(result.includes('screenshots/'))
  assert.ok(!result.includes('\\'))
  assert.equal(result.startsWith('/'), true)
})

test('getScreenshotUrl 正确转换 Unix 路径', () => {
  const unixPath = '/home/user/project/backend/screenshots/test/2024-01-01/full.png'
  const result = getScreenshotUrl(unixPath)
  assert.equal(result, '/screenshots/test/2024-01-01/full.png')
})

test('getScreenshotUrl 处理不包含 screenshots 的路径', () => {
  const invalidPath = '/home/user/project/other/folder/image.png'
  const result = getScreenshotUrl(invalidPath)
  assert.equal(result, '')
})

test('getScreenshotUrl 处理空值和 undefined', () => {
  assert.equal(getScreenshotUrl(''), '')
  assert.equal(getScreenshotUrl(null), '')
  assert.equal(getScreenshotUrl(undefined), '')
})

test('formatFileSize 格式化各种文件大小', () => {
  assert.equal(formatFileSize(0), '0 B')
  assert.equal(formatFileSize(500), '500 B')
  assert.equal(formatFileSize(1024), '1 KB')
  assert.equal(formatFileSize(1536), '1.5 KB')
  assert.equal(formatFileSize(1048576), '1 MB')
  assert.equal(formatFileSize(1048576 * 2.5), '2.5 MB')
  assert.equal(formatFileSize(1073741824), '1 GB')
})

test('formatFileSize 处理无效输入', () => {
  assert.equal(formatFileSize(null), '0 B')
  assert.equal(formatFileSize(undefined), '0 B')
  assert.equal(formatFileSize('abc'), '0 B')
})

test('calculateMegaPixels 计算百万像素', () => {
  assert.equal(calculateMegaPixels(1920, 1080), '2.07')
  assert.equal(calculateMegaPixels(4000, 3000), '12.00')
  assert.equal(calculateMegaPixels(500, 500), '0.25')
})

test('calculateMegaPixels 处理无效输入', () => {
  assert.equal(calculateMegaPixels(0, 0), '0')
  assert.equal(calculateMegaPixels(null, null), '0')
  assert.equal(calculateMegaPixels(undefined, undefined), '0')
  assert.equal(calculateMegaPixels(1920, null), '0')
})

test('formatRegion 格式化区域坐标', () => {
  const region = { region_x: 100, region_y: 200, region_width: 800, region_height: 600 }
  assert.equal(formatRegion(region), '(100, 200) - 800×600')
})

test('formatRegion 处理 null/undefined', () => {
  assert.equal(formatRegion(null), '')
  assert.equal(formatRegion(undefined), '')
})

const mockSmartVersions = [
  { id: 1, strategy: 'dom', is_manual_region: 0, width: 800, height: 600 },
  { id: 2, strategy: 'dom', is_manual_region: 1, width: 800, height: 600 },
  { id: 3, strategy: 'visual', is_manual_region: 0, width: 700, height: 500 },
  { id: 4, strategy: 'hybrid', is_manual_region: 0, width: 750, height: 550 }
]

test('findSmartByStrategy 优先查找非手动版本', () => {
  const result = findSmartByStrategy(mockSmartVersions, 'dom')
  assert.equal(result.id, 1)
  assert.equal(result.is_manual_region, 0)
})

test('findSmartByStrategy preferNonManual=false 时返回第一个匹配', () => {
  const result = findSmartByStrategy(mockSmartVersions, 'dom', false)
  assert.equal(result.id, 1)
})

test('findSmartByStrategy 找不到指定策略时返回 null', () => {
  const result = findSmartByStrategy(mockSmartVersions, 'nonexistent')
  assert.equal(result, null)
})

test('findSmartByStrategy 处理空数组', () => {
  assert.equal(findSmartByStrategy([], 'dom'), null)
  assert.equal(findSmartByStrategy(null, 'dom'), null)
  assert.equal(findSmartByStrategy(undefined, 'dom'), null)
})

const mockRegions = [
  { id: 1, strategy: 'dom', region_x: 0, region_y: 0 },
  { id: 2, strategy: 'visual', region_x: 50, region_y: 50 },
  { id: 3, strategy: 'hybrid', region_x: 10, region_y: 10 }
]

test('findRegionByStrategy 找到正确策略的区域', () => {
  const result = findRegionByStrategy(mockRegions, 'visual')
  assert.equal(result.id, 2)
  assert.equal(result.strategy, 'visual')
})

test('findRegionByStrategy 找不到时返回第一个', () => {
  const result = findRegionByStrategy(mockRegions, 'nonexistent')
  assert.equal(result.id, 1)
})

test('findRegionByStrategy 处理空输入', () => {
  assert.equal(findRegionByStrategy([], 'dom'), null)
  assert.equal(findRegionByStrategy(null, 'dom'), null)
})

test('hasStrategyRegions 检测策略区域是否存在', () => {
  assert.equal(hasStrategyRegions(mockRegions, 'dom'), true)
  assert.equal(hasStrategyRegions(mockRegions, 'visual'), true)
  assert.equal(hasStrategyRegions(mockRegions, 'nonexistent'), false)
})

test('hasStrategyRegions 处理空输入', () => {
  assert.equal(hasStrategyRegions([], 'dom'), false)
  assert.equal(hasStrategyRegions(null, 'dom'), false)
  assert.equal(hasStrategyRegions(undefined, 'dom'), false)
})

test('hasStrategySmart 检测策略智能截图是否存在', () => {
  assert.equal(hasStrategySmart(mockSmartVersions, 'dom'), true)
  assert.equal(hasStrategySmart(mockSmartVersions, 'hybrid'), true)
  assert.equal(hasStrategySmart(mockSmartVersions, 'nonexistent'), false)
})

test('hasStrategySmart 处理空输入', () => {
  assert.equal(hasStrategySmart([], 'dom'), false)
  assert.equal(hasStrategySmart(null, 'dom'), false)
  assert.equal(hasStrategySmart(undefined, 'dom'), false)
})

test('策略查找工具不修改原数组', () => {
  const originalLength = mockSmartVersions.length
  findSmartByStrategy(mockSmartVersions, 'dom')
  hasStrategySmart(mockSmartVersions, 'dom')
  assert.equal(mockSmartVersions.length, originalLength)

  const regionsLength = mockRegions.length
  findRegionByStrategy(mockRegions, 'visual')
  hasStrategyRegions(mockRegions, 'visual')
  assert.equal(mockRegions.length, regionsLength)
})
