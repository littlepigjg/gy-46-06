import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const getUrls = () => api.get('/urls')
export const addUrl = (data) => api.post('/urls', data)
export const deleteUrl = (id) => api.delete(`/urls/${id}`)
export const updateUrl = (id, data) => api.put(`/urls/${id}`, data)
export const getUrl = (id) => api.get(`/urls/${id}`)
export const getScreenshots = (urlId) => api.get(`/urls/${urlId}/screenshots`)
export const deleteScreenshot = (id) => api.delete(`/screenshots/${id}`)
export const triggerScreenshot = (urlId) => api.post(`/urls/${urlId}/screenshot`)

export const getStrategies = () => api.get('/strategies')
export const getScreenshotRegions = (screenshotId) => api.get(`/screenshots/${screenshotId}/regions`)
export const updateScreenshotRegion = (screenshotId, region) =>
  api.put(`/screenshots/${screenshotId}/region`, region)
export const reAnalyzeScreenshot = (screenshotId, strategy) =>
  api.post(`/screenshots/${screenshotId}/reanalyze`, { strategy })
export const cropScreenshot = (screenshotId, regionData) =>
  api.post(`/screenshots/${screenshotId}/crop`, regionData)
export const getGroupedScreenshots = (urlId) => api.get(`/urls/${urlId}/screenshots-grouped`)
export const updateDefaultStrategy = (urlId, strategy) =>
  api.put(`/urls/${urlId}/default-strategy`, { strategy })

export default api
