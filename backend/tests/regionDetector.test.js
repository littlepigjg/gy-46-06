import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STRATEGIES, STRATEGY_LABELS } from '../regionDetector.js'

test('策略常量定义完整', () => {
  assert.deepEqual(Object.keys(STRATEGIES).sort(), ['DOM', 'HYBRID', 'VISUAL'])
  assert.equal(STRATEGIES.DOM, 'dom')
  assert.equal(STRATEGIES.VISUAL, 'visual')
  assert.equal(STRATEGIES.HYBRID, 'hybrid')
})

test('策略标签定义完整', () => {
  assert.equal(STRATEGY_LABELS.dom, 'DOM结构提取')
  assert.equal(STRATEGY_LABELS.visual, '视觉密度识别')
  assert.equal(STRATEGY_LABELS.hybrid, '智能综合分割')
})

test('所有策略都有对应标签', () => {
  for (const strategy of Object.values(STRATEGIES)) {
    assert.ok(
      STRATEGY_LABELS[strategy],
      `策略 ${strategy} 缺少对应标签`
    )
  }
})

test('策略值格式正确（小写字符串）', () => {
  for (const strategy of Object.values(STRATEGIES)) {
    assert.equal(typeof strategy, 'string')
    assert.equal(strategy, strategy.toLowerCase())
    assert.ok(strategy.length > 0)
  }
})
