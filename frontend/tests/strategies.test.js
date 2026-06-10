import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STRATEGIES,
  STRATEGY_LABELS,
  STRATEGY_COLORS,
  STRATEGY_BG_COLORS,
  VIEW_MODES,
  getStrategyLabel,
  getStrategyColor,
  getStrategyBgColor
} from '../src/constants/strategies.js'

test('策略常量 STRATEGIES 定义完整', () => {
  assert.deepEqual(Object.keys(STRATEGIES).sort(), ['DOM', 'HYBRID', 'VISUAL'])
  assert.equal(STRATEGIES.DOM, 'dom')
  assert.equal(STRATEGIES.VISUAL, 'visual')
  assert.equal(STRATEGIES.HYBRID, 'hybrid')
})

test('视图模式 VIEW_MODES 定义完整', () => {
  assert.deepEqual(Object.keys(VIEW_MODES).sort(), ['EDIT', 'FULLPAGE', 'SMART'])
  assert.equal(VIEW_MODES.FULLPAGE, 'fullpage')
  assert.equal(VIEW_MODES.SMART, 'smart')
  assert.equal(VIEW_MODES.EDIT, 'edit')
})

test('所有策略值都有对应标签、颜色、背景色', () => {
  const strategyValues = Object.values(STRATEGIES)
  for (const strategy of strategyValues) {
    assert.ok(STRATEGY_LABELS[strategy], `策略 ${strategy} 缺少标签`)
    assert.ok(STRATEGY_COLORS[strategy], `策略 ${strategy} 缺少颜色`)
    assert.ok(STRATEGY_BG_COLORS[strategy], `策略 ${strategy} 缺少背景色`)
  }
})

test('manual 策略也有颜色和背景色', () => {
  assert.ok(STRATEGY_COLORS.manual)
  assert.ok(STRATEGY_BG_COLORS.manual)
})

test('颜色格式正确（以 # 开头）', () => {
  const allColors = { ...STRATEGY_COLORS }
  for (const color of Object.values(allColors)) {
    assert.equal(typeof color, 'string')
    assert.ok(color.startsWith('#'))
    assert.ok(color.length >= 4)
  }
})

test('背景色带透明度（长度为9）', () => {
  const bgColors = { ...STRATEGY_BG_COLORS }
  for (const color of Object.values(bgColors)) {
    assert.equal(typeof color, 'string')
    assert.ok(color.startsWith('#'))
    assert.equal(color.length, 9)
  }
})

test('getStrategyLabel 返回正确标签', () => {
  assert.equal(getStrategyLabel('dom'), 'DOM结构提取')
  assert.equal(getStrategyLabel('visual'), '视觉密度识别')
  assert.equal(getStrategyLabel('hybrid'), '智能综合分割')
})

test('getStrategyLabel 处理未知策略', () => {
  assert.equal(getStrategyLabel('unknown'), 'unknown')
  assert.equal(getStrategyLabel(null), '智能综合')
  assert.equal(getStrategyLabel(undefined), '智能综合')
})

test('getStrategyColor 返回正确颜色', () => {
  assert.equal(getStrategyColor('dom'), STRATEGY_COLORS.dom)
  assert.equal(getStrategyColor('visual'), STRATEGY_COLORS.visual)
  assert.equal(getStrategyColor('hybrid'), STRATEGY_COLORS.hybrid)
  assert.equal(getStrategyColor('manual'), STRATEGY_COLORS.manual)
})

test('getStrategyColor 未知策略返回默认灰色', () => {
  assert.equal(getStrategyColor('unknown'), '#6b7280')
})

test('getStrategyBgColor 返回正确背景色', () => {
  assert.equal(getStrategyBgColor('dom'), STRATEGY_BG_COLORS.dom)
  assert.equal(getStrategyBgColor('visual'), STRATEGY_BG_COLORS.visual)
  assert.equal(getStrategyBgColor('hybrid'), STRATEGY_BG_COLORS.hybrid)
})

test('getStrategyBgColor 未知策略返回默认灰色背景', () => {
  assert.equal(getStrategyBgColor('unknown'), '#6b728033')
})

test('前后端策略值保持一致', () => {
  const frontendStrategies = Object.values(STRATEGIES).sort()
  const expectedStrategies = ['dom', 'hybrid', 'visual']
  assert.deepEqual(frontendStrategies, expectedStrategies)
})
