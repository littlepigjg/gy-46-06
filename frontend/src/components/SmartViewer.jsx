import { useState, useEffect, useRef, useCallback } from 'react'
import dayjs from 'dayjs'
import RegionEditor from './RegionEditor.jsx'
import {
  getScreenshotRegions,
  updateScreenshotRegion,
  reAnalyzeScreenshot,
  getStrategies
} from '../api.js'
import {
  STRATEGY_LABELS,
  VIEW_MODES,
  getStrategyLabel,
  getStrategyColor,
  getStrategyBgColor
} from '../constants/strategies.js'
import {
  getScreenshotUrl,
  calculateMegaPixels,
  formatRegion,
  findSmartByStrategy,
  findRegionByStrategy,
  hasStrategyRegions,
  hasStrategySmart
} from '../utils/screenshot.js'

export default function SmartViewer({
  screenshot,
  smartVersions: propSmartVersions = [],
  onClose,
  onSmartCreated = null,
  urlInfo = null
}) {
  const [viewMode, setViewMode] = useState(VIEW_MODES.SMART)
  const [selectedStrategy, setSelectedStrategy] = useState(screenshot?.strategy || 'hybrid')
  const [selectedSmartId, setSelectedSmartId] = useState(null)
  const [allRegions, setAllRegions] = useState([])
  const [currentRegion, setCurrentRegion] = useState(null)
  const [strategies, setStrategies] = useState([])
  const [loadingRegions, setLoadingRegions] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [savingRegion, setSavingRegion] = useState(false)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [localSmartVersions, setLocalSmartVersions] = useState([])
  const [analyzeProgress, setAnalyzeProgress] = useState('初始化...')

  const isInitialized = useRef(false)
  const strategySwitchingRef = useRef(false)

  const fullpageId = screenshot?.parent_id || screenshot?.id

  const allSmartVersions = [...localSmartVersions, ...propSmartVersions].reduce((acc, s) => {
    if (!acc.find(item => item.id === s.id)) {
      acc.push(s)
    }
    return acc
  }, [])

  const selectedSmart = (selectedSmartId
    ? allSmartVersions.find(s => s.id === selectedSmartId)
    : null) || findSmartByStrategy(allSmartVersions, selectedStrategy)

  useEffect(() => {
    setLocalSmartVersions([])
    setSelectedSmartId(null)
  }, [fullpageId])

  const addOrUpdateSmart = useCallback((smartShot) => {
    setLocalSmartVersions(prev => {
      const existing = prev.find(s => s.id === smartShot.id)
      if (existing) {
        return prev.map(s => s.id === smartShot.id ? smartShot : s)
      }
      return [...prev, smartShot]
    })
  }, [])

  const performReAnalyze = useCallback(async (strategy, isAuto = false) => {
    if (isAuto) {
      setAutoAnalyzing(true)
    } else {
      setReanalyzing(true)
    }
    setAnalyzeProgress('正在访问页面并分析结构...')

    try {
      setAnalyzeProgress('正在识别内容区域...')
      const res = await reAnalyzeScreenshot(fullpageId, strategy)

      setAnalyzeProgress('正在生成裁剪图...')
      await loadRegions()

      if (res.data?.smartScreenshot) {
        const newSmart = res.data.smartScreenshot
        addOrUpdateSmart(newSmart)
        if (onSmartCreated) {
          onSmartCreated(newSmart)
        }
        setSelectedSmartId(newSmart.id)
      }

      if (res.data?.regions?.[0]) {
        const r = res.data.regions[0]
        setCurrentRegion({
          region_x: r.region_x,
          region_y: r.region_y,
          region_width: r.region_width,
          region_height: r.region_height
        })
      }

      setAnalyzeProgress('完成')
      setTimeout(() => setAnalyzeProgress(''), 500)
    } catch (err) {
      setAnalyzeProgress('识别失败')
      if (!isAuto) {
        alert('重新识别失败: ' + err.message)
      } else {
        console.error('自动识别失败:', err)
      }
      setTimeout(() => setAnalyzeProgress(''), 2000)
    } finally {
      if (isAuto) {
        setAutoAnalyzing(false)
      } else {
        setReanalyzing(false)
      }
    }
  }, [fullpageId, onSmartCreated, addOrUpdateSmart])

  const loadRegions = useCallback(async () => {
    setLoadingRegions(true)
    try {
      const res = await getScreenshotRegions(fullpageId)
      setAllRegions(res.data || [])
    } catch (err) {
      console.error('加载区域失败:', err)
    } finally {
      setLoadingRegions(false)
    }
  }, [fullpageId])

  useEffect(() => {
    getStrategies().then(res => {
      setStrategies(res.data.strategies || [])
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (fullpageId) {
      loadRegions()
    }
  }, [fullpageId, loadRegions])

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true
      return
    }

    strategySwitchingRef.current = true

    const hasSmart = hasStrategySmart(allSmartVersions, selectedStrategy)
    const hasRegions = hasStrategyRegions(allRegions, selectedStrategy)

    if (!hasSmart && !hasRegions) {
      setSelectedSmartId(null)
      performReAnalyze(selectedStrategy, true)
    } else if (!hasSmart && hasRegions) {
      const region = findRegionByStrategy(allRegions, selectedStrategy)
      if (region) {
        setCurrentRegion({
          region_x: region.region_x,
          region_y: region.region_y,
          region_width: region.region_width,
          region_height: region.region_height
        })
      }
      setSelectedSmartId(null)
    } else {
      setSelectedSmartId(null)
    }

    const timer = setTimeout(() => {
      strategySwitchingRef.current = false
    }, 300)

    return () => clearTimeout(timer)
  }, [selectedStrategy, allSmartVersions, allRegions, performReAnalyze])

  useEffect(() => {
    if (selectedSmart) {
      setCurrentRegion({
        region_x: selectedSmart.region_x,
        region_y: selectedSmart.region_y,
        region_width: selectedSmart.region_width,
        region_height: selectedSmart.region_height
      })
    } else if (!strategySwitchingRef.current) {
      const defaultRegion = findRegionByStrategy(allRegions, selectedStrategy)
      if (defaultRegion) {
        setCurrentRegion({
          region_x: defaultRegion.region_x,
          region_y: defaultRegion.region_y,
          region_width: defaultRegion.region_width,
          region_height: defaultRegion.region_height
        })
      }
    }
  }, [selectedSmart, allRegions, selectedStrategy])

  const handleSaveRegion = async (region) => {
    setSavingRegion(true)
    try {
      const res = await updateScreenshotRegion(fullpageId, region)
      await loadRegions()
      const newSmart = res.data
      addOrUpdateSmart(newSmart)
      if (onSmartCreated) {
        onSmartCreated(newSmart)
      }
      setCurrentRegion({
        region_x: newSmart.region_x,
        region_y: newSmart.region_y,
        region_width: newSmart.region_width,
        region_height: newSmart.region_height
      })
      setSelectedSmartId(newSmart.id)
      setViewMode(VIEW_MODES.SMART)
      alert('区域保存成功！')
    } catch (err) {
      alert('保存失败: ' + err.message)
    } finally {
      setSavingRegion(false)
    }
  }

  const handleSelectRegionFromList = (region) => {
    setCurrentRegion({
      region_x: region.region_x,
      region_y: region.region_y,
      region_width: region.region_width,
      region_height: region.region_height
    })
  }

  const getDisplayImage = () => {
    if (viewMode === VIEW_MODES.FULLPAGE) {
      return {
        src: getScreenshotUrl(screenshot?.file_path || ''),
        width: screenshot?.width || 1920,
        height: screenshot?.height || 1080,
        label: '全页截图',
        isLoading: false,
        isFullpage: true
      }
    }

    if (viewMode === VIEW_MODES.SMART) {
      if (selectedSmart) {
        return {
          src: getScreenshotUrl(selectedSmart.file_path),
          width: selectedSmart.width,
          height: selectedSmart.height,
          label: `智能裁剪 - ${getStrategyLabel(selectedSmart.strategy)}`,
          isLoading: false,
          isFullpage: false,
          isManual: selectedSmart.is_manual_region,
          region: selectedSmart
        }
      }
      if (autoAnalyzing || reanalyzing) {
        return {
          src: getScreenshotUrl(screenshot?.file_path || ''),
          width: screenshot?.width || 1920,
          height: screenshot?.height || 1080,
          label: `智能裁剪 - ${getStrategyLabel(selectedStrategy)} (生成中...)`,
          isLoading: true,
          isFullpage: false,
          pendingStrategy: selectedStrategy
        }
      }
      if (currentRegion) {
        return {
          src: getScreenshotUrl(screenshot?.file_path || ''),
          width: currentRegion.region_width,
          height: currentRegion.region_height,
          label: `智能裁剪 - ${getStrategyLabel(selectedStrategy)} (区域预览)`,
          isLoading: false,
          isFullpage: false,
          isPreview: true,
          region: currentRegion
        }
      }
    }

    return {
      src: getScreenshotUrl(screenshot?.file_path || ''),
      width: screenshot?.width || 1920,
      height: screenshot?.height || 1080,
      label: '全页截图',
      isLoading: false,
      isFullpage: true
    }
  }

  const displayImg = getDisplayImage()
  const isBusy = reanalyzing || autoAnalyzing || savingRegion || loadingRegions
  const totalSmartCount = allSmartVersions.length

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="bg-gray-900 px-6 py-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-white text-lg font-medium">
            {dayjs(screenshot?.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </h3>
          {urlInfo && (
            <p className="text-gray-400 text-sm mt-0.5 truncate max-w-xl">{urlInfo.name} - {urlInfo.url}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="bg-gray-800 px-6 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode(VIEW_MODES.FULLPAGE)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === VIEW_MODES.FULLPAGE
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            全页截图
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.SMART)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === VIEW_MODES.SMART
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            智能裁剪
            {totalSmartCount > 0 && (
              <span className="ml-1.5 bg-gray-600 text-xs px-1.5 rounded-full">{totalSmartCount}</span>
            )}
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.EDIT)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === VIEW_MODES.EDIT
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            调整区域
          </button>
        </div>

        <div className="h-6 w-px bg-gray-600"></div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">识别策略:</span>
          <div className="relative">
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              disabled={isBusy}
              className="bg-gray-700 text-white text-sm rounded-lg pl-3 pr-10 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-60 appearance-none cursor-pointer"
            >
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {isBusy && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
            )}
          </div>
          <button
            onClick={() => performReAnalyze(selectedStrategy, false)}
            disabled={isBusy}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {reanalyzing ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                识别中...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新识别
              </>
            )}
          </button>
        </div>

        {viewMode === VIEW_MODES.SMART && totalSmartCount > 1 && (
          <>
            <div className="h-6 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">版本:</span>
              <select
                value={selectedSmartId || selectedSmart?.id || ''}
                onChange={(e) => setSelectedSmartId(parseInt(e.target.value))}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {allSmartVersions.map(s => (
                  <option key={s.id} value={s.id}>
                    {getStrategyLabel(s.strategy)}
                    {s.is_manual_region ? ' (手动)' : ''}
                    {s.id === selectedSmartId || (s.strategy === selectedStrategy && !selectedSmartId && !s.is_manual_region) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex-1"></div>

        <div className="text-sm text-gray-400">
          {displayImg.width} × {displayImg.height} px
          <span className="ml-3 text-gray-500">
            {calculateMegaPixels(displayImg.width, displayImg.height)} MP
          </span>
        </div>
      </div>

      {(autoAnalyzing || reanalyzing) && viewMode !== VIEW_MODES.EDIT && (
        <div className="bg-emerald-900/50 border-b border-emerald-700/50 px-6 py-2 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-300 rounded-full animate-spin"></div>
          <span className="text-sm text-emerald-200">
            正在使用「{getStrategyLabel(selectedStrategy)}」策略
            {analyzeProgress ? ` - ${analyzeProgress}` : '识别内容区域...'}
          </span>
        </div>
      )}

      {viewMode === VIEW_MODES.EDIT ? (
        <div className="flex-1 overflow-auto p-6 bg-gray-950">
          {loadingRegions ? (
            <div className="text-center text-gray-400 py-20">加载区域数据中...</div>
          ) : (
            <RegionEditor
              imageSrc={getScreenshotUrl(screenshot?.file_path || '')}
              imageWidth={screenshot?.width || 1920}
              imageHeight={screenshot?.height || 1080}
              initialRegion={currentRegion}
              onRegionChange={setCurrentRegion}
              onSave={handleSaveRegion}
              onCancel={() => {
                setViewMode(selectedSmart ? VIEW_MODES.SMART : VIEW_MODES.SMART)
              }}
              disabled={savingRegion}
              regions={allRegions.filter(r => r.strategy === selectedStrategy)}
              onSelectRegion={handleSelectRegionFromList}
            />
          )}

          {allRegions.length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">所有识别区域</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allRegions.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      currentRegion?.region_x === r.region_x && currentRegion?.region_y === r.region_y
                        ? 'bg-blue-900/30 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => handleSelectRegionFromList(r)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: getStrategyBgColor(r.strategy),
                          color: getStrategyColor(r.strategy)
                        }}
                      >
                        {getStrategyLabel(r.strategy)}
                        {r.is_manual ? ' (手动)' : ''}
                      </span>
                      {r.confidence > 0 && (
                        <span className="text-xs text-gray-400">
                          {Math.round(r.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div>位置: ({r.region_x}, {r.region_y})</div>
                      <div>尺寸: {r.region_width} × {r.region_height}</div>
                      {r.label && <div>标签: {r.label}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-gray-950">
          <div className="relative">
            <div className="text-xs text-gray-500 mb-2 text-center">
              {displayImg.label}
              {displayImg.isLoading && <span className="ml-2 text-emerald-400">(生成中...)</span>}
              {displayImg.isPreview && <span className="ml-2 text-amber-400">(预览)</span>}
            </div>

            {displayImg.isLoading ? (
              <div
                className="relative bg-gray-900 border border-gray-700 rounded overflow-hidden"
                style={{
                  width: Math.min(displayImg.width, 1200),
                  maxWidth: '100%',
                  aspectRatio: displayImg.width && displayImg.height
                    ? `${displayImg.width} / ${displayImg.height}`
                    : '16 / 9'
                }}
              >
                <img
                  src={displayImg.src}
                  alt="loading preview"
                  className="w-full h-full object-cover object-top opacity-30"
                  style={{ filter: 'blur(4px)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                  <div className="bg-gray-800/90 px-6 py-4 rounded-xl flex flex-col items-center gap-3 border border-gray-600">
                    <div className="w-8 h-8 border-3 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                    <div className="text-center">
                      <div className="text-sm text-white font-medium">
                        正在生成「{getStrategyLabel(displayImg.pendingStrategy)}」裁剪图
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {analyzeProgress || '分析页面结构中...'}
                      </div>
                    </div>
                    <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : displayImg.isPreview ? (
              <div
                className="relative bg-gray-900 border-2 border-dashed border-amber-500/60 rounded overflow-hidden"
                style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 260px)' }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: displayImg.region.region_width,
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={displayImg.src}
                    alt="region preview"
                    className="block"
                    style={{
                      maxWidth: 'none',
                      width: screenshot?.width,
                      height: 'auto',
                      marginLeft: -displayImg.region.region_x,
                      marginTop: -displayImg.region.region_y
                    }}
                  />
                </div>
                <div className="absolute top-2 left-2 bg-amber-500/90 text-white text-xs px-2 py-1 rounded">
                  区域预览 - 点击"重新识别"或切换策略生成裁剪图
                </div>
              </div>
            ) : (
              <img
                src={displayImg.src}
                alt={displayImg.label}
                className="max-w-full object-contain"
                style={{ maxHeight: 'calc(100vh - 260px)' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {viewMode === VIEW_MODES.SMART && displayImg.region && !displayImg.isLoading && (
              <div className="mt-2 text-xs text-gray-400 text-center">
                裁剪区域: {formatRegion(displayImg.region)}
                {displayImg.isManual && <span className="ml-2 text-amber-400">(手动调整)</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
