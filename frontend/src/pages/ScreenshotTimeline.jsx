import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getUrl,
  getGroupedScreenshots,
  deleteScreenshot,
  getStrategies,
  updateDefaultStrategy,
  triggerScreenshot
} from '../api.js'
import ImageCompare from '../components/ImageCompare.jsx'
import SmartViewer from '../components/SmartViewer.jsx'
import { getStrategyLabel } from '../constants/strategies.js'
import { getScreenshotUrl } from '../utils/screenshot.js'

export default function ScreenshotTimeline() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [urlInfo, setUrlInfo] = useState(null)
  const [groupedScreenshots, setGroupedScreenshots] = useState([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [viewerShot, setViewerShot] = useState(null)
  const [strategies, setStrategies] = useState([])
  const [isTriggering, setIsTriggering] = useState(false)

  const firstCompareId = compareSelection[0] || null
  const secondCompareId = compareSelection[1] || null

  const loadData = async () => {
    try {
      const [urlRes, shotsRes, stratRes] = await Promise.all([
        getUrl(id),
        getGroupedScreenshots(id),
        getStrategies().catch(() => ({ data: { strategies: [] } }))
      ])
      setUrlInfo(urlRes.data)
      setGroupedScreenshots(shotsRes.data || [])
      setStrategies(stratRes.data?.strategies || [])
    } catch (err) {
      alert('加载失败: ' + err.message)
    }
  }

  useEffect(() => {
    setCompareSelection([])
    setShowCompare(false)
    setCompareMode(false)
    setViewerShot(null)
    loadData()
  }, [id])

  const handleDelete = async (shot) => {
    if (!confirm(`确定删除此截图 (${dayjs(shot.created_at).format('YYYY-MM-DD HH:mm')})？`)) return
    try {
      await deleteScreenshot(shot.id)
      setCompareSelection(prev => prev.filter(id => id !== shot.id))
      loadData()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  const handleSelectCompare = (shotId) => {
    setCompareSelection(prev => {
      const idx = prev.indexOf(shotId)
      if (idx !== -1) {
        return prev.filter(id => id !== shotId)
      }
      if (prev.length === 0) {
        return [shotId]
      }
      if (prev.length === 1) {
        return [prev[0], shotId]
      }
      return [prev[1], shotId]
    })
  }

  const resetCompareSelection = () => {
    setCompareSelection([])
    setShowCompare(false)
    setCompareMode(false)
  }

  const startCompare = () => {
    if (compareSelection.length < 2) {
      alert('请选择两张截图进行对比')
      return
    }
    setShowCompare(true)
  }

  const handleSmartCreated = (smartShot) => {
    setGroupedScreenshots(prev => prev.map(group => {
      if (group.id === smartShot.parent_id) {
        const existing = group.smartVersions.find(s => s.id === smartShot.id)
        if (!existing) {
          return {
            ...group,
            smartVersions: [...group.smartVersions, smartShot]
          }
        }
        return {
          ...group,
          smartVersions: group.smartVersions.map(s =>
            s.id === smartShot.id ? smartShot : s
          )
        }
      }
      return group
    }))
  }

  const handleTriggerScreenshot = async () => {
    if (!confirm('确定立即执行截图吗？')) return
    setIsTriggering(true)
    try {
      const res = await triggerScreenshot(id)
      if (res.data?.fullpage) {
        const newGroup = {
          ...res.data.fullpage,
          smartVersions: res.data.smart ? [res.data.smart] : []
        }
        setGroupedScreenshots(prev => [newGroup, ...prev])
      }
      alert('截图成功！')
    } catch (err) {
      alert('截图失败: ' + err.message)
    } finally {
      setIsTriggering(false)
    }
  }

  const handleChangeDefaultStrategy = async (strategy) => {
    try {
      const res = await updateDefaultStrategy(id, strategy)
      setUrlInfo(res.data)
    } catch (err) {
      alert('设置失败: ' + err.message)
    }
  }

  const getSmartPreview = (group) => {
    const defaultStrat = urlInfo?.default_strategy || 'hybrid'
    return group.smartVersions?.find(s => s.strategy === defaultStrat && !s.is_manual_region) ||
      group.smartVersions?.find(s => !s.is_manual_region) ||
      group.smartVersions?.[0]
  }

  const totalCount = groupedScreenshots.length
  const smartCount = groupedScreenshots.filter(g => (g.smartVersions?.length || 0) > 0).length

  const groupedByDate = groupedScreenshots.reduce((acc, shot) => {
    const date = dayjs(shot.created_at).format('YYYY-MM-DD')
    if (!acc[date]) acc[date] = []
    acc[date].push(shot)
    return acc
  }, {})

  const findShotById = (shotId) => {
    for (const group of groupedScreenshots) {
      if (group.id === shotId) return group
      if (group.smartVersions) {
        const found = group.smartVersions.find(s => s.id === shotId)
        if (found) return group
      }
    }
    return null
  }

  const firstShot = firstCompareId ? findShotById(firstCompareId) : null
  const secondShot = secondCompareId ? findShotById(secondCompareId) : null

  const orderedShots = firstShot && secondShot
    ? dayjs(firstShot.created_at).isBefore(secondShot.created_at)
      ? [firstShot, secondShot]
      : [secondShot, firstShot]
    : null

  const getSmartPreviewUrl = (filePath) => {
    if (!filePath) return ''
    return getScreenshotUrl(filePath)
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          ← 返回列表
        </button>
        <div className="h-6 w-px bg-gray-300"></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-800 truncate">
            {urlInfo?.name || '加载中...'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{urlInfo?.url}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-gray-600">
              共 <span className="font-medium text-gray-900">{totalCount}</span> 组截图
              {smartCount > 0 && (
                <span className="ml-3 text-emerald-600">
                  (<span className="font-medium">{smartCount}</span> 组含智能裁剪)
                </span>
              )}
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">默认策略:</span>
              <select
                value={urlInfo?.default_strategy || 'hybrid'}
                onChange={(e) => handleChangeDefaultStrategy(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500"
              >
                {strategies.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTriggerScreenshot}
              disabled={isTriggering}
              className="text-sm bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
            >
              {isTriggering ? '截图中...' : '立即截图'}
            </button>
          </div>

          {compareMode ? (
            <div className="flex gap-2">
              <span className="text-sm text-gray-500 py-1.5">
                已选: {compareSelection.length} / 2
                {compareSelection.length === 2 && ' (再点将替换较早的那张)'}
              </span>
              <button
                onClick={startCompare}
                disabled={compareSelection.length < 2}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                开始对比
              </button>
              <button
                onClick={resetCompareSelection}
                className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (totalCount < 2) {
                  alert('至少需要两组截图才能对比')
                  return
                }
                setCompareSelection([])
                setShowCompare(false)
                setCompareMode(true)
              }}
              className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg text-sm hover:bg-blue-100"
            >
              对比模式
            </button>
          )}
        </div>
      </div>

      {groupedScreenshots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          暂无截图，等待首次执行或点击上方"立即截图"按钮
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([date, shots]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-lg font-semibold text-gray-800">{date}</div>
                <div className="flex-1 h-px bg-gray-200"></div>
                <div className="text-sm text-gray-500">{shots.length} 组</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {shots.map((group) => {
                  const isFirst = firstCompareId === group.id
                  const isSecond = secondCompareId === group.id
                  const fullImgUrl = getScreenshotUrl(group.file_path)
                  const smartPreview = getSmartPreview(group)
                  const smartImgUrl = getSmartPreviewUrl(smartPreview?.file_path)

                  return (
                    <div
                      key={group.id}
                      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
                        isFirst || isSecond
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:shadow-md'
                      } ${compareMode ? 'cursor-pointer' : ''}`}
                      onClick={() => compareMode && handleSelectCompare(group.id)}
                    >
                      <div
                        className="relative bg-gray-100"
                        style={{ aspectRatio: '16/9' }}
                        onClick={(e) => {
                          if (!compareMode) {
                            e.stopPropagation()
                            setViewerShot(group)
                          }
                        }}
                      >
                        {smartPreview ? (
                          <div className="absolute inset-0 flex">
                            <div className="relative w-1/2 h-full overflow-hidden border-r border-gray-300">
                              <img
                                src={fullImgUrl}
                                alt={`full-${group.id}`}
                                className="w-full h-full object-cover object-top"
                                loading="lazy"
                              />
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] text-white bg-black/60 rounded">
                                全页
                              </div>
                            </div>
                            <div className="relative w-1/2 h-full overflow-hidden">
                              <img
                                src={smartImgUrl}
                                alt={`smart-${group.id}`}
                                className="w-full h-full object-cover object-top"
                                loading="lazy"
                              />
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] text-white bg-emerald-600/90 rounded">
                                智能
                              </div>
                              <div className="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] text-white bg-emerald-600/90 rounded">
                                {getStrategyLabel(smartPreview.strategy).substring(0, 2)}
                              </div>
                            </div>
                            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-full bg-white/80 shadow-md pointer-events-none"></div>
                          </div>
                        ) : (
                          <img
                            src={fullImgUrl}
                            alt={`screenshot-${group.id}`}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        )}
                        {(isFirst || isSecond) && (
                          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded z-10">
                            {isFirst ? '已选 1' : '已选 2'}
                          </div>
                        )}
                        {group.smartVersions?.length > 0 && (
                          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded z-10">
                            {group.smartVersions.length} 版本
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-700 font-medium">
                            {dayjs(group.created_at).format('HH:mm:ss')}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span>{group.width}×{group.height}</span>
                          </div>
                        </div>
                        {group.smartVersions?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {group.smartVersions.slice(0, 4).map((sv, idx) => (
                              <span
                                key={sv.id || idx}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  sv.is_manual_region
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {getStrategyLabel(sv.strategy).substring(0, 4)}
                                {sv.is_manual_region && ' (手)'}
                              </span>
                            ))}
                            {group.smartVersions.length > 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                +{group.smartVersions.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        {!compareMode && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setViewerShot(group)
                              }}
                              className="flex-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              查看/调整
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(group)
                              }}
                              className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100"
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewerShot && (
        <SmartViewer
          screenshot={viewerShot}
          smartVersions={viewerShot.smartVersions || []}
          urlInfo={urlInfo}
          onClose={() => setViewerShot(null)}
          onSmartCreated={handleSmartCreated}
        />
      )}

      {showCompare && orderedShots && (
        <ImageCompare
          beforeImage={getScreenshotUrl(orderedShots[0].file_path)}
          afterImage={getScreenshotUrl(orderedShots[1].file_path)}
          beforeLabel={dayjs(orderedShots[0].created_at).format('YYYY-MM-DD HH:mm:ss')}
          afterLabel={dayjs(orderedShots[1].created_at).format('YYYY-MM-DD HH:mm:ss')}
          onClose={resetCompareSelection}
        />
      )}
    </div>
  )
}
