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
  smartVersions = [],
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

  const isInitialized = useRef(false)

  const fullpageId = screenshot?.parent_id || screenshot?.id

  const selectedSmart = (selectedSmartId
    ? smartVersions.find(s => s.id === selectedSmartId)
    : null) || findSmartByStrategy(smartVersions, selectedStrategy)

  const performReAnalyze = useCallback(async (strategy, isAuto = false) => {
    if (isAuto) setAutoAnalyzing(true)
    else setReanalyzing(true)

    try {
      const res = await reAnalyzeScreenshot(fullpageId, strategy)
      await loadRegions()
      if (res.data?.smartScreenshot && onSmartCreated) {
        onSmartCreated(res.data.smartScreenshot)
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
    } catch (err) {
      if (!isAuto) {
        alert('重新识别失败: ' + err.message)
      } else {
        console.error('自动识别失败:', err)
      }
    } finally {
      if (isAuto) setAutoAnalyzing(false)
      else setReanalyzing(false)
    }
  }, [fullpageId, onSmartCreated])

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

    const hasSmart = hasStrategySmart(smartVersions, selectedStrategy)
    const hasRegions = hasStrategyRegions(allRegions, selectedStrategy)

    if (!hasSmart && !hasRegions) {
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
    }

    setSelectedSmartId(null)
  }, [selectedStrategy, smartVersions, allRegions, performReAnalyze])

  useEffect(() => {
    if (selectedSmart) {
      setCurrentRegion({
        region_x: selectedSmart.region_x,
        region_y: selectedSmart.region_y,
        region_width: selectedSmart.region_width,
        region_height: selectedSmart.region_height
      })
    } else {
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
      if (onSmartCreated) {
        onSmartCreated(res.data)
      }
      setCurrentRegion({
        region_x: res.data.region_x,
        region_y: res.data.region_y,
        region_width: res.data.region_width,
        region_height: res.data.region_height
      })
      setSelectedSmartId(res.data.id)
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
    if (viewMode === VIEW_MODES.SMART && selectedSmart) {
      return {
        src: getScreenshotUrl(selectedSmart.file_path),
        width: selectedSmart.width,
        height: selectedSmart.height,
        label: `智能裁剪 - ${getStrategyLabel(selectedSmart.strategy)}`
      }
    }
    return {
      src: getScreenshotUrl(screenshot?.file_path || ''),
      width: screenshot?.width || 1920,
      height: screenshot?.height || 1080,
      label: '全页截图'
    }
  }

  const displayImg = getDisplayImage()
  const isBusy = reanalyzing || autoAnalyzing || savingRegion || loadingRegions

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
            {smartVersions.length > 0 && (
              <span className="ml-1.5 bg-gray-600 text-xs px-1.5 rounded-full">{smartVersions.length}</span>
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
              className="bg-gray-700 text-white text-sm rounded-lg pl-3 pr-8 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-60 appearance-none cursor-pointer"
            >
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {autoAnalyzing && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
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

        {viewMode === VIEW_MODES.SMART && smartVersions.length > 1 && (
          <>
            <div className="h-6 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">版本:</span>
              <select
                value={selectedSmartId || selectedSmart?.id || ''}
                onChange={(e) => setSelectedSmartId(parseInt(e.target.value))}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {smartVersions.map(s => (
                  <option key={s.id} value={s.id}>
                    {getStrategyLabel(s.strategy)}
                    {s.is_manual_region ? ' (手动)' : ''}
                    {s.strategy === selectedSmart?.strategy && !s.is_manual_region ? ' ✓' : ''}
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

      {autoAnalyzing && viewMode !== VIEW_MODES.EDIT && (
        <div className="bg-emerald-900/50 border-b border-emerald-700/50 px-6 py-2 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-300 rounded-full animate-spin"></div>
          <span className="text-sm text-emerald-200">
            正在使用「{getStrategyLabel(selectedStrategy)}」策略识别内容区域...
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
                setViewMode(selectedSmart ? VIEW_MODES.SMART : VIEW_MODES.FULLPAGE)
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
              {autoAnalyzing && <span className="ml-2 text-emerald-400">(识别中...)</span>}
            </div>
            <img
              src={displayImg.src}
              alt={displayImg.label}
              className={`max-w-full object-contain transition-opacity ${autoAnalyzing ? 'opacity-60' : ''}`}
              style={{ maxHeight: 'calc(100vh - 220px)' }}
              onClick={(e) => e.stopPropagation()}
            />
            {viewMode === VIEW_MODES.SMART && selectedSmart && (
              <div className="mt-2 text-xs text-gray-400 text-center">
                裁剪区域: {formatRegion(selectedSmart)}
                {selectedSmart.is_manual_region && <span className="ml-2 text-amber-400">(手动调整)</span>}
              </div>
            )}
            {viewMode === VIEW_MODES.SMART && autoAnalyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                <div className="bg-gray-900/90 px-4 py-2 rounded-lg flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-400/40 border-t-emerald-300 rounded-full animate-spin"></div>
                  <span className="text-sm text-white">正在生成智能裁剪图...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
