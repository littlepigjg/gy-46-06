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

export const STRATEGY_COLORS = {
  [STRATEGIES.DOM]: '#3b82f6',
  [STRATEGIES.VISUAL]: '#10b981',
  [STRATEGIES.HYBRID]: '#8b5cf6',
  manual: '#f59e0b'
}

export const STRATEGY_BG_COLORS = {
  [STRATEGIES.DOM]: '#3b82f633',
  [STRATEGIES.VISUAL]: '#10b98133',
  [STRATEGIES.HYBRID]: '#8b5cf633',
  manual: '#f59e0b33'
}

export const VIEW_MODES = {
  FULLPAGE: 'fullpage',
  SMART: 'smart',
  EDIT: 'edit'
}

export const getStrategyLabel = (strategy) => {
  return STRATEGY_LABELS[strategy] || strategy || '智能综合'
}

export const getStrategyColor = (strategy) => {
  return STRATEGY_COLORS[strategy] || '#6b7280'
}

export const getStrategyBgColor = (strategy) => {
  return STRATEGY_BG_COLORS[strategy] || '#6b728033'
}
