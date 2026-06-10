import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import getDb from './db.js';
import { detectAllStrategies, detectRegions, STRATEGIES } from './regionDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
}

async function saveRegionsToDb(screenshotId, regions) {
  const db = await getDb();
  const insertStmt = db.prepare(`
    INSERT INTO screenshot_regions (screenshot_id, strategy, region_x, region_y, region_width, region_height, confidence, label, is_manual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const region of regions) {
    insertStmt.run(
      screenshotId,
      region.strategy,
      region.region_x,
      region.region_y,
      region.region_width,
      region.region_height,
      region.confidence || 0,
      region.label || null,
      region.is_manual || 0
    );
  }
}

export async function cropScreenshot(sourcePath, region, outputPath) {
  const sharp = await import('sharp').catch(() => null);
  if (!sharp) {
    return cropScreenshotFallback(sourcePath, region, outputPath);
  }

  try {
    await sharp.default(sourcePath)
      .extract({
        left: region.region_x,
        top: region.region_y,
        width: region.region_width,
        height: region.region_height
      })
      .toFile(outputPath);
    return true;
  } catch (err) {
    console.warn('sharp裁剪失败，使用备用方案:', err.message);
    return cropScreenshotFallback(sourcePath, region, outputPath);
  }
}

async function cropScreenshotFallback(sourcePath, region, outputPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const fileUrl = 'file://' + sourcePath.replace(/\\/g, '/');
    await page.setViewport({
      width: region.region_x + region.region_width + 100,
      height: region.region_y + region.region_height + 100
    });
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.screenshot({
      path: outputPath,
      clip: {
        x: region.region_x,
        y: region.region_y,
        width: region.region_width,
        height: region.region_height
      }
    });
    return true;
  } finally {
    await page.close().catch(console.error);
  }
}

export async function takeScreenshot(urlRecord, options = {}) {
  const { id, url, name, default_strategy } = urlRecord;
  const { strategy = default_strategy || STRATEGIES.HYBRID } = options;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  const urlDir = path.join(SCREENSHOTS_DIR, sanitizeFilename(name || url), dateStr);
  if (!fs.existsSync(urlDir)) {
    fs.mkdirSync(urlDir, { recursive: true });
  }

  const fullFileName = `${timeStr}_full.png`;
  const fullFilePath = path.join(urlDir, fullFileName);

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.screenshot({ path: fullFilePath, fullPage: true });

    const pageSize = await page.evaluate(() => ({
      width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    }));

    const db = await getDb();

    const insertFullStmt = db.prepare(`
      INSERT INTO screenshots (url_id, file_path, file_name, width, height, type, strategy)
      VALUES (?, ?, ?, ?, ?, 'fullpage', ?)
    `);
    const fullResult = insertFullStmt.run(
      id, fullFilePath, fullFileName, pageSize.width, pageSize.height, strategy
    );
    const fullScreenshotId = fullResult.lastInsertRowid;

    const allRegionsResult = await detectAllStrategies(page);

    let allRegions = [];
    for (const [stratName, result] of Object.entries(allRegionsResult)) {
      allRegions = allRegions.concat(result.regions);
    }
    await saveRegionsToDb(fullScreenshotId, allRegions);

    const primaryResult = allRegionsResult[strategy] || allRegionsResult[STRATEGIES.HYBRID];
    const primaryRegion = primaryResult?.regions?.[0];

    let croppedScreenshot = null;
    if (primaryRegion) {
      const croppedFileName = `${timeStr}_smart_${strategy}.png`;
      const croppedFilePath = path.join(urlDir, croppedFileName);

      await cropScreenshot(fullFilePath, primaryRegion, croppedFilePath);

      const insertCroppedStmt = db.prepare(`
        INSERT INTO screenshots (url_id, file_path, file_name, width, height, type, parent_id, strategy, region_x, region_y, region_width, region_height, is_manual_region)
        VALUES (?, ?, ?, ?, ?, 'smart', ?, ?, ?, ?, ?, ?, 0)
      `);
      const croppedResult = insertCroppedStmt.run(
        id,
        croppedFilePath,
        croppedFileName,
        primaryRegion.region_width,
        primaryRegion.region_height,
        fullScreenshotId,
        strategy,
        primaryRegion.region_x,
        primaryRegion.region_y,
        primaryRegion.region_width,
        primaryRegion.region_height
      );

      croppedScreenshot = {
        id: croppedResult.lastInsertRowid,
        file_path: croppedFilePath,
        file_name: croppedFileName,
        width: primaryRegion.region_width,
        height: primaryRegion.region_height,
        type: 'smart',
        strategy: strategy,
        parent_id: fullScreenshotId,
        region: primaryRegion,
        created_at: now.toISOString()
      };
    }

    const updateStmt = db.prepare(`
      UPDATE urls SET last_screenshot_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    updateStmt.run(id);

    return {
      fullpage: {
        id: fullScreenshotId,
        file_path: fullFilePath,
        file_name: fullFileName,
        width: pageSize.width,
        height: pageSize.height,
        type: 'fullpage',
        strategy: strategy,
        created_at: now.toISOString(),
        regions: allRegionsResult
      },
      smart: croppedScreenshot
    };
  } catch (error) {
    console.error(`截图失败 [${url}]:`, error.message);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(console.error);
    }
  }
}

export async function reAnalyzeScreenshot(screenshotId, strategy = STRATEGIES.HYBRID) {
  const db = await getDb();
  const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(screenshotId);
  if (!screenshot) {
    throw new Error('截图不存在');
  }

  const urlRecord = db.prepare('SELECT * FROM urls WHERE id = ?').get(screenshot.url_id);
  if (!urlRecord) {
    throw new Error('URL记录不存在');
  }

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(urlRecord.url, { waitUntil: 'networkidle2', timeout: 60000 });

    const result = await detectRegions(page, strategy);

    db.prepare('DELETE FROM screenshot_regions WHERE screenshot_id = ? AND strategy = ?')
      .run(screenshotId, strategy);
    await saveRegionsToDb(screenshotId, result.regions);

    return {
      pageSize: result.pageSize,
      regions: result.regions
    };
  } finally {
    if (page) {
      await page.close().catch(console.error);
    }
  }
}

export async function createCroppedScreenshot(screenshotId, region) {
  const db = await getDb();
  const parentShot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(screenshotId);
  if (!parentShot) {
    throw new Error('父截图不存在');
  }

  const now = new Date();
  const urlDir = path.dirname(parentShot.file_path);
  const baseName = path.basename(parentShot.file_name, path.extname(parentShot.file_name));
  const croppedFileName = `${baseName}_manual_${region.region_x}_${region.region_y}.png`;
  const croppedFilePath = path.join(urlDir, croppedFileName);

  await cropScreenshot(parentShot.file_path, region, croppedFilePath);

  const strategy = region.strategy || 'manual';
  const insertStmt = db.prepare(`
    INSERT INTO screenshots (url_id, file_path, file_name, width, height, type, parent_id, strategy, region_x, region_y, region_width, region_height, is_manual_region)
    VALUES (?, ?, ?, ?, ?, 'smart', ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insertStmt.run(
    parentShot.url_id,
    croppedFilePath,
    croppedFileName,
    region.region_width,
    region.region_height,
    screenshotId,
    strategy,
    region.region_x,
    region.region_y,
    region.region_width,
    region.region_height,
    region.is_manual ? 1 : 0
  );

  if (region.is_manual) {
    const manualRegionStmt = db.prepare(`
      INSERT INTO screenshot_regions (screenshot_id, strategy, region_x, region_y, region_width, region_height, confidence, label, is_manual)
      VALUES (?, 'manual', ?, ?, ?, ?, 1, '手动调整', 1)
    `);
    manualRegionStmt.run(
      screenshotId,
      region.region_x,
      region.region_y,
      region.region_width,
      region.region_height
    );
  }

  return {
    id: result.lastInsertRowid,
    file_path: croppedFilePath,
    file_name: croppedFileName,
    width: region.region_width,
    height: region.region_height,
    type: 'smart',
    strategy: strategy,
    parent_id: screenshotId,
    region_x: region.region_x,
    region_y: region.region_y,
    region_width: region.region_width,
    region_height: region.region_height,
    is_manual_region: region.is_manual ? 1 : 0,
    created_at: now.toISOString()
  };
}

export async function getScreenshotRegions(screenshotId) {
  const db = await getDb();
  const regions = db.prepare(`
    SELECT * FROM screenshot_regions
    WHERE screenshot_id = ?
    ORDER BY is_manual DESC, confidence DESC, created_at ASC
  `).all(screenshotId);
  return regions;
}

export async function updateManualRegion(screenshotId, region) {
  const db = await getDb();

  db.prepare(`
    DELETE FROM screenshot_regions
    WHERE screenshot_id = ? AND is_manual = 1
  `).run(screenshotId);

  const insertStmt = db.prepare(`
    INSERT INTO screenshot_regions (screenshot_id, strategy, region_x, region_y, region_width, region_height, confidence, label, is_manual)
    VALUES (?, 'manual', ?, ?, ?, ?, 1, '手动调整', 1)
  `);
  insertStmt.run(
    screenshotId,
    region.region_x,
    region.region_y,
    region.region_width,
    region.region_height
  );

  const existingSmart = db.prepare(`
    SELECT id FROM screenshots
    WHERE parent_id = ? AND is_manual_region = 1
  `).get(screenshotId);

  if (existingSmart) {
    const parentShot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(screenshotId);
    if (parentShot && fs.existsSync(parentShot.file_path)) {
      const urlDir = path.dirname(parentShot.file_path);
      const baseName = path.basename(parentShot.file_name, path.extname(parentShot.file_name));
      const newFileName = `${baseName}_manual_${region.region_x}_${region.region_y}.png`;
      const newFilePath = path.join(urlDir, newFileName);

      const oldShot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(existingSmart.id);
      if (oldShot && fs.existsSync(oldShot.file_path)) {
        fs.unlinkSync(oldShot.file_path);
      }

      await cropScreenshot(parentShot.file_path, region, newFilePath);

      db.prepare(`
        UPDATE screenshots SET file_path = ?, file_name = ?, width = ?, height = ?,
          region_x = ?, region_y = ?, region_width = ?, region_height = ?
        WHERE id = ?
      `).run(
        newFilePath, newFileName,
        region.region_width, region.region_height,
        region.region_x, region.region_y, region.region_width, region.region_height,
        existingSmart.id
      );

      return db.prepare('SELECT * FROM screenshots WHERE id = ?').get(existingSmart.id);
    }
  }

  return createCroppedScreenshot(screenshotId, { ...region, is_manual: true });
}

export { SCREENSHOTS_DIR };
