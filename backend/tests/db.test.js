import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import getDb from '../db.js'

let testDbPath = ''

beforeEach(() => {
  const tmpDir = os.tmpdir()
  testDbPath = path.join(tmpDir, `test-db-${Date.now()}.db`)
  process.env.DB_PATH = testDbPath
})

afterEach(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
  delete process.env.DB_PATH
})

test('数据库初始化成功', async () => {
  const db = await getDb()
  assert.ok(db)
  assert.equal(typeof db.prepare, 'function')
  assert.equal(typeof db.exec, 'function')
})

test('URL 表存在且字段完整', async () => {
  const db = await getDb()
  const columns = db.prepare("PRAGMA table_info(urls)").all()
  const colNames = columns.map(c => c.name)

  const requiredCols = ['id', 'url', 'name', 'frequency', 'status', 'default_strategy', 'created_at', 'last_screenshot_at']
  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `URL表缺少字段: ${col}`)
  }
})

test('screenshots 表存在且包含智能识别相关字段', async () => {
  const db = await getDb()
  const columns = db.prepare("PRAGMA table_info(screenshots)").all()
  const colNames = columns.map(c => c.name)

  const requiredCols = [
    'id', 'url_id', 'file_path', 'file_name', 'width', 'height',
    'type', 'parent_id', 'strategy', 'region_x', 'region_y',
    'region_width', 'region_height', 'is_manual_region', 'created_at'
  ]
  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `screenshots表缺少字段: ${col}`)
  }
})

test('screenshot_regions 表存在', async () => {
  const db = await getDb()
  const columns = db.prepare("PRAGMA table_info(screenshot_regions)").all()
  const colNames = columns.map(c => c.name)

  const requiredCols = [
    'id', 'screenshot_id', 'strategy', 'region_x', 'region_y',
    'region_width', 'region_height', 'confidence', 'label', 'is_manual', 'created_at'
  ]
  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `screenshot_regions表缺少字段: ${col}`)
  }
})

test('默认策略字段有默认值', async () => {
  const db = await getDb()
  const stmt = db.prepare("INSERT INTO urls (url, name, frequency, status) VALUES (?, ?, ?, ?)")
  const result = stmt.run('https://example.com', '测试', 'daily', 'active')

  const url = db.prepare('SELECT default_strategy FROM urls WHERE id = ?').get(result.lastInsertRowid)
  assert.equal(url.default_strategy, 'dom')
})

test('截图 type 字段默认为 fullpage', async () => {
  const db = await getDb()

  const urlResult = db.prepare(
    "INSERT INTO urls (url, name, frequency, status) VALUES (?, ?, ?, ?)"
  ).run('https://example.com', '测试', 'daily', 'active')

  const shotResult = db.prepare(`
    INSERT INTO screenshots (url_id, file_path, file_name, width, height)
    VALUES (?, ?, ?, ?, ?)
  `).run(urlResult.lastInsertRowid, '/path/to/file.png', 'file.png', 1920, 1080)

  const shot = db.prepare('SELECT type, is_manual_region FROM screenshots WHERE id = ?').get(shotResult.lastInsertRowid)
  assert.equal(shot.type, 'fullpage')
  assert.equal(shot.is_manual_region, 0)
})

test('URL 唯一约束生效', async () => {
  const db = await getDb()

  db.prepare("INSERT INTO urls (url, name, frequency, status) VALUES (?, ?, ?, ?)")
    .run('https://example.com', '测试1', 'daily', 'active')

  assert.throws(() => {
    db.prepare("INSERT INTO urls (url, name, frequency, status) VALUES (?, ?, ?, ?)")
      .run('https://example.com', '测试2', 'daily', 'active')
  })
})

test('外键约束：删除 URL 时级联删除截图', async () => {
  const db = await getDb()

  db.exec('PRAGMA foreign_keys = ON')

  const urlResult = db.prepare(
    "INSERT INTO urls (url, name, frequency, status) VALUES (?, ?, ?, ?)"
  ).run('https://example.com', '测试', 'daily', 'active')

  db.prepare(`
    INSERT INTO screenshots (url_id, file_path, file_name, width, height)
    VALUES (?, ?, ?, ?, ?)
  `).run(urlResult.lastInsertRowid, '/path/to/file.png', 'file.png', 1920, 1080)

  let count = db.prepare('SELECT COUNT(*) as cnt FROM screenshots WHERE url_id = ?').get(urlResult.lastInsertRowid).cnt
  assert.equal(count, 1)

  db.prepare('DELETE FROM urls WHERE id = ?').run(urlResult.lastInsertRowid)

  count = db.prepare('SELECT COUNT(*) as cnt FROM screenshots WHERE url_id = ?').get(urlResult.lastInsertRowid).cnt
  assert.equal(count, 0)
})
