import { useState, useRef, useEffect, useCallback } from 'react'
import {
  STRATEGY_LABELS,
  STRATEGY_COLORS,
  getStrategyLabel,
  getStrategyColor
} from '../constants/strategies.js'
import { calculateMegaPixels } from '../utils/screenshot.js'

const MIN_SIZE = 50
const HANDLE_SIZE = 10

const HANDLES = [
  { position: 'nw', cursor: 'nw-resize', x: 0, y: 0 },
  { position: 'n', cursor: 'n-resize', x: 0.5, y: 0 },
  { position: 'ne', cursor: 'ne-resize', x: 1, y: 0 },
  { position: 'e', cursor: 'e-resize', x: 1, y: 0.5 },
  { position: 'se', cursor: 'se-resize', x: 1, y: 1 },
  { position: 's', cursor: 's-resize', x: 0.5, y: 1 },
  { position: 'sw', cursor: 'sw-resize', x: 0, y: 1 },
  { position: 'w', cursor: 'w-resize', x: 0, y: 0.5 }
]

export default function RegionEditor({
  imageSrc,
  imageWidth,
  imageHeight,
  initialRegion,
  onRegionChange,
  onSave,
  onCancel,
  disabled = false,
  regions = [],
  activeRegionId = null,
  onSelectRegion = null
}) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [region, setRegion] = useState(
    initialRegion || { region_x: 50, region_y: 50, region_width: 400, region_height: 300 }
  )

  const updateScale = useCallback(() => {
    if (containerRef.current && imageWidth) {
      const containerWidth = containerRef.current.clientWidth
      setScale(containerWidth / imageWidth)
    }
  }, [imageWidth])

  useEffect(() => {
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [updateScale])

  useEffect(() => {
    if (initialRegion) {
      setRegion(initialRegion)
    }
  }, [initialRegion])

  const getScaledCoords = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    }
  }

  const handleMouseDown = (e, handle = null) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    const coords = getScaledCoords(e.clientX, e.clientY)
    setDragging(handle)
    setDragStart({
      ...coords,
      region: { ...region }
    })
  }

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !dragStart) return

    const coords = getScaledCoords(e.clientX, e.clientY)
    const dx = coords.x - dragStart.x
    const dy = coords.y - dragStart.y
    const r = { ...dragStart.region }

    if (dragging === null) {
      r.region_x = Math.max(0, Math.min(imageWidth - r.region_width, r.region_x + dx))
      r.region_y = Math.max(0, Math.min(imageHeight - r.region_height, r.region_y + dy))
    } else {
      const [dirX, dirY] = dragging.split('')
      const leftEdges = ['w', 'nw', 'sw']
      const topEdges = ['n', 'nw', 'ne']
      const rightEdges = ['e', 'ne', 'se']
      const bottomEdges = ['s', 'se', 'sw']

      let newX = r.region_x
      let newY = r.region_y
      let newW = r.region_width
      let newH = r.region_height

      if (leftEdges.includes(dragging)) {
        const maxDx = r.region_width - MIN_SIZE
        const actualDx = Math.min(Math.max(dx, -r.region_x), maxDx)
        newX = r.region_x + actualDx
        newW = r.region_width - actualDx
      }
      if (rightEdges.includes(dragging)) {
        const maxDx = imageWidth - (r.region_x + r.region_width)
        newW = Math.max(MIN_SIZE, Math.min(r.region_width + dx, r.region_width + maxDx))
      }
      if (topEdges.includes(dragging)) {
        const maxDy = r.region_height - MIN_SIZE
        const actualDy = Math.min(Math.max(dy, -r.region_y), maxDy)
        newY = r.region_y + actualDy
        newH = r.region_height - actualDy
      }
      if (bottomEdges.includes(dragging)) {
        const maxDy = imageHeight - (r.region_y + r.region_height)
        newH = Math.max(MIN_SIZE, Math.min(r.region_height + dy, r.region_height + maxDy))
      }

      r.region_x = Math.round(newX)
      r.region_y = Math.round(newY)
      r.region_width = Math.round(newW)
      r.region_height = Math.round(newH)
    }

    setRegion(r)
    if (onRegionChange) onRegionChange(r)
  }, [dragging, dragStart, scale, imageWidth, imageHeight, onRegionChange])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setDragStart(null)
  }, [])

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  const scaledStyle = (val) => val * scale

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">当前区域：</span>
          <span className="ml-2">
            X: {region.region_x}, Y: {region.region_y}, W: {region.region_width}, H: {region.region_height}
          </span>
          <span className="ml-3 text-gray-500">
            ({calculateMegaPixels(region.region_width, region.region_height)} MP)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={() => onSave && onSave(region)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            disabled={disabled}
          >
            保存区域
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative bg-gray-900 rounded-lg overflow-auto flex-shrink-0"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <div
          className="relative inline-block"
          style={{ width: scaledStyle(imageWidth) }}
        >
          <img
            src={imageSrc}
            alt="screenshot"
            className="block w-full select-none"
            draggable={false}
          />

          {regions.map((r, idx) => {
            const isActive = r.id === activeRegionId ||
              (activeRegionId === null && idx === 0 && !initialRegion)
            const isCurrentRegion = r === initialRegion ||
              (r.region_x === region.region_x && r.region_y === region.region_y)

            if (isCurrentRegion && dragging === null) return null

            return (
              <div
                key={r.id || idx}
                className="absolute cursor-pointer transition-all"
                style={{
                  left: scaledStyle(r.region_x),
                  top: scaledStyle(r.region_y),
                  width: scaledStyle(r.region_width),
                  height: scaledStyle(r.region_height),
                  border: `2px solid ${getStrategyColor(r.strategy)}`,
                  backgroundColor: isActive ? `${getStrategyColor(r.strategy)}20` : 'transparent',
                  boxShadow: isActive ? `0 0 0 2px ${getStrategyColor(r.strategy)}40` : 'none'
                }}
                onClick={() => onSelectRegion && onSelectRegion(r)}
              >
                <div
                  className="absolute -top-6 left-0 px-2 py-0.5 text-xs text-white rounded whitespace-nowrap"
                  style={{ backgroundColor: getStrategyColor(r.strategy) }}
                >
                  {getStrategyLabel(r.strategy)}
                  {r.confidence > 0 && ` (${Math.round(r.confidence * 100)}%)`}
                </div>
              </div>
            )
          })}

          {!disabled && (
            <div
              className="absolute cursor-move"
              style={{
                left: scaledStyle(region.region_x),
                top: scaledStyle(region.region_y),
                width: scaledStyle(region.region_width),
                height: scaledStyle(region.region_height),
                border: '2px solid #f59e0b',
                backgroundColor: '#f59e0b15',
                boxShadow: '0 0 0 1px #f59e0b40'
              }}
              onMouseDown={(e) => handleMouseDown(e)}
            >
              <div className="absolute -top-6 left-0 px-2 py-0.5 text-xs text-white rounded bg-amber-500 whitespace-nowrap">
                调整中
              </div>

              {HANDLES.map((handle) => (
                <div
                  key={handle.position}
                  className="absolute bg-amber-500 border border-amber-600 rounded-sm"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    left: `calc(${handle.x * 100}% - ${HANDLE_SIZE / 2}px)`,
                    top: `calc(${handle.y * 100}% - ${HANDLE_SIZE / 2}px)`,
                    cursor: handle.cursor
                  }}
                  onMouseDown={(e) => handleMouseDown(e, handle.position)}
                />
              ))}

              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] text-white bg-black/60 rounded">
                {region.region_width} × {region.region_height}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 px-1">
        <div className="text-xs text-gray-500 mb-2">识别策略图例：</div>
        <div className="flex gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STRATEGY_COLORS.dom }}></div>
            <span className="text-gray-600">{STRATEGY_LABELS.dom}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STRATEGY_COLORS.visual }}></div>
            <span className="text-gray-600">{STRATEGY_LABELS.visual}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STRATEGY_COLORS.hybrid }}></div>
            <span className="text-gray-600">{STRATEGY_LABELS.hybrid}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STRATEGY_COLORS.manual }}></div>
            <span className="text-gray-600">手动调整</span>
          </div>
        </div>
      </div>
    </div>
  )
}
