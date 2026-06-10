export const STRATEGIES = {
  DOM: 'dom',
  VISUAL: 'visual',
  HYBRID: 'hybrid'
}

export const STRATEGY_LABELS = {
  [STRATEGIES.DOM]: 'DOM结构提取',
  [STRATEGIES.VISUAL]: '视觉密度识别',
  [STRATEGIES.HYBRID]: '智能综合分割'
}

async function analyzeDomStructure(page) {
  return page.evaluate(() => {
    const candidates = []

    const contentSelectors = [
      'article', 'main', '[role="main"]', '#content', '#main',
      '.content', '.main', '.post-content', '.article-content',
      '.entry-content', '.post', '.article', 'section.primary'
    ]

    contentSelectors.forEach(selector => {
      const els = document.querySelectorAll(selector)
      els.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 200 && rect.height > 200) {
          const style = window.getComputedStyle(el)
          const visibility = style.visibility
          const display = style.display
          if (visibility !== 'hidden' && display !== 'none') {
            candidates.push({
              tag: el.tagName.toLowerCase(),
              selector: selector,
              x: Math.round(rect.left + window.scrollX),
              y: Math.round(rect.top + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              area: rect.width * rect.height,
              textLength: (el.innerText || '').length,
              childCount: el.children.length,
              score: 0
            })
          }
        }
      })
    })

    if (candidates.length === 0) {
      const largeDivs = document.querySelectorAll('div, section')
      largeDivs.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width > 500 && rect.height > 500) {
          const style = window.getComputedStyle(el)
          if (style.visibility !== 'hidden' && style.display !== 'none') {
            const textLen = (el.innerText || '').length
            if (textLen > 200) {
              candidates.push({
                tag: el.tagName.toLowerCase(),
                selector: 'heuristic',
                x: Math.round(rect.left + window.scrollX),
                y: Math.round(rect.top + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                area: rect.width * rect.height,
                textLength: textLen,
                childCount: el.children.length,
                score: 0
              })
            }
          }
        }
      })
    }

    if (candidates.length === 0) {
      const body = document.body
      const html = document.documentElement
      const fullWidth = Math.max(body.scrollWidth, html.scrollWidth)
      const fullHeight = Math.max(body.scrollHeight, html.scrollHeight)
      const margin = Math.round(Math.min(fullWidth, fullHeight) * 0.05)
      candidates.push({
        tag: 'body',
        selector: 'fallback',
        x: margin,
        y: margin,
        width: Math.max(100, fullWidth - margin * 2),
        height: Math.max(100, fullHeight - margin * 2),
        area: (fullWidth - margin * 2) * (fullHeight - margin * 2),
        textLength: (body.innerText || '').length,
        childCount: body.children.length,
        score: 0
      })
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const maxArea = viewportWidth * viewportHeight * 4

    candidates.forEach(c => {
      const textDensity = c.textLength / Math.max(1, c.area) * 100000
      const areaRatio = Math.min(1, c.area / maxArea)
      const semanticBonus = ['article', 'main'].includes(c.tag) ? 2 :
        c.selector.includes('content') || c.selector.includes('article') || c.selector.includes('main') ? 1.5 : 1

      c.score = (textDensity * 0.4 + areaRatio * 0.3 + c.childCount * 0.05) * semanticBonus
    })

    candidates.sort((a, b) => b.score - a.score)

    return candidates.slice(0, 5).map(c => ({
      ...c,
      confidence: Math.min(1, c.score / 10)
    }))
  })
}

async function analyzeVisualDensity(page) {
  return page.evaluate(() => {
    const blocks = []
    const allElements = document.querySelectorAll('*')

    allElements.forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 150 || rect.height < 150) return
      if (rect.width > window.innerWidth * 1.2) return

      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') return

      const hasBg = style.backgroundImage !== 'none' ||
        (style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)')

      const childCount = el.children.length
      const textLen = (el.innerText || '').length
      const imgCount = el.querySelectorAll('img').length
      const hasBorder = style.borderTopWidth !== '0px' || style.borderBottomWidth !== '0px'
      const hasPadding = parseInt(style.paddingTop) > 0 || parseInt(style.paddingLeft) > 0

      let densityScore = 0
      if (textLen > 100) densityScore += 1
      if (textLen > 500) densityScore += 1
      if (textLen > 1000) densityScore += 1
      if (imgCount > 0) densityScore += 1
      if (imgCount > 3) densityScore += 1
      if (hasBg) densityScore += 0.5
      if (hasBorder) densityScore += 0.5
      if (hasPadding) densityScore += 0.5
      if (childCount > 5 && childCount < 50) densityScore += 1

      if (densityScore >= 2) {
        blocks.push({
          tag: el.tagName.toLowerCase(),
          x: Math.round(rect.left + window.scrollX),
          y: Math.round(rect.top + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          area: rect.width * rect.height,
          textLength: textLen,
          imageCount: imgCount,
          hasBackground: hasBg,
          densityScore: densityScore,
          score: densityScore
        })
      }
    })

    const merged = []
    const used = new Set()

    blocks.sort((a, b) => b.area - a.area)

    for (let i = 0; i < blocks.length; i++) {
      if (used.has(i)) continue
      const block = { ...blocks[i] }

      for (let j = i + 1; j < blocks.length; j++) {
        if (used.has(j)) continue
        const other = blocks[j]

        const overlapX = Math.max(0, Math.min(block.x + block.width, other.x + other.width) - Math.max(block.x, other.x))
        const overlapY = Math.max(0, Math.min(block.y + block.height, other.y + other.height) - Math.max(block.y, other.y))
        const overlapArea = overlapX * overlapY
        const smallerArea = Math.min(block.area, other.area)

        if (overlapArea / smallerArea > 0.7) {
          used.add(j)
          block.score = Math.max(block.score, other.score)
          block.textLength = Math.max(block.textLength, other.textLength)
          block.imageCount = Math.max(block.imageCount, other.imageCount)
        }
      }

      merged.push(block)
    }

    merged.sort((a, b) => b.score - a.score)

    return merged.slice(0, 5).map(b => ({
      ...b,
      confidence: Math.min(1, b.score / 8)
    }))
  })
}

async function analyzeHybrid(page) {
  const [domCandidates, visualBlocks] = await Promise.all([
    analyzeDomStructure(page),
    analyzeVisualDensity(page)
  ])

  const combined = []

  domCandidates.forEach(dom => {
    let visualMatch = null
    let bestOverlap = 0

    visualBlocks.forEach(vis => {
      const overlapX = Math.max(0, Math.min(dom.x + dom.width, vis.x + vis.width) - Math.max(dom.x, vis.x))
      const overlapY = Math.max(0, Math.min(dom.y + dom.height, vis.y + vis.height) - Math.max(dom.y, vis.y))
      const overlapArea = overlapX * overlapY
      const domArea = dom.area
      const visArea = vis.area
      const iou = overlapArea / (domArea + visArea - overlapArea + 1)
      if (iou > bestOverlap) {
        bestOverlap = iou
        visualMatch = vis
      }
    })

    const combinedScore = visualMatch
      ? dom.score * 0.6 + visualMatch.score * 0.4 + bestOverlap * 2
      : dom.score * 0.8

    const finalRegion = visualMatch && bestOverlap > 0.3
      ? {
          x: Math.round((dom.x + visualMatch.x) / 2),
          y: Math.round((dom.y + visualMatch.y) / 2),
          width: Math.round((dom.width + visualMatch.width) / 2),
          height: Math.round((dom.height + visualMatch.height) / 2)
        }
      : { x: dom.x, y: dom.y, width: dom.width, height: dom.height }

    combined.push({
      ...finalRegion,
      area: finalRegion.width * finalRegion.height,
      textLength: dom.textLength,
      domTag: dom.tag,
      selector: dom.selector,
      score: combinedScore,
      hasVisualMatch: !!visualMatch,
      overlapScore: bestOverlap,
      confidence: Math.min(1, combinedScore / 8)
    })
  })

  visualBlocks.forEach(vis => {
    const alreadyCovered = combined.some(c => {
      const overlapX = Math.max(0, Math.min(c.x + c.width, vis.x + vis.width) - Math.max(c.x, vis.x))
      const overlapY = Math.max(0, Math.min(c.y + c.height, vis.y + vis.height) - Math.max(c.y, vis.y))
      const overlapArea = overlapX * overlapY
      return overlapArea / vis.area > 0.6
    })

    if (!alreadyCovered && vis.score >= 3) {
      combined.push({
        x: vis.x,
        y: vis.y,
        width: vis.width,
        height: vis.height,
        area: vis.area,
        textLength: vis.textLength,
        imageCount: vis.imageCount,
        selector: 'visual-only',
        score: vis.score * 0.7,
        hasVisualMatch: true,
        overlapScore: 0,
        confidence: Math.min(1, vis.score / 10)
      })
    }
  })

  combined.sort((a, b) => b.score - a.score)
  return combined.slice(0, 5)
}

export async function detectRegions(page, strategy) {
  let regions = []

  switch (strategy) {
    case STRATEGIES.DOM:
      regions = await analyzeDomStructure(page)
      break
    case STRATEGIES.VISUAL:
      regions = await analyzeVisualDensity(page)
      break
    case STRATEGIES.HYBRID:
    default:
      regions = await analyzeHybrid(page)
      break
  }

  const pageSize = await page.evaluate(() => ({
    width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
  }))

  regions = regions.map(r => ({
    ...r,
    x: Math.max(0, Math.min(r.x, pageSize.width - 50)),
    y: Math.max(0, Math.min(r.y, pageSize.height - 50)),
    width: Math.max(50, Math.min(r.width, pageSize.width - r.x)),
    height: Math.max(50, Math.min(r.height, pageSize.height - r.y))
  }))

  return {
    pageSize,
    regions: regions.map((r, idx) => ({
      strategy,
      region_x: r.x,
      region_y: r.y,
      region_width: r.width,
      region_height: r.height,
      confidence: r.confidence || 0.5,
      label: r.label || (r.selector || r.tag || 'region') + `-${idx + 1}`,
      is_manual: 0,
      metadata: {
        textLength: r.textLength,
        area: r.area,
        score: r.score,
        domTag: r.domTag,
        imageCount: r.imageCount,
        overlapScore: r.overlapScore
      }
    }))
  }
}

export async function detectAllStrategies(page) {
  const results = {}

  for (const strategy of Object.values(STRATEGIES)) {
    try {
      results[strategy] = await detectRegions(page, strategy)
    } catch (err) {
      console.warn(`策略 ${strategy} 检测失败:`, err.message)
      results[strategy] = { pageSize: { width: 0, height: 0 }, regions: [] }
    }
  }

  return results
}
