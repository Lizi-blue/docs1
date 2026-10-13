/**
 * 前端控制台对象一：ApiClient。
 *
 * 职责：发 HTTP 请求、解析 JSON、把错误体翻成一句中文提示。
 * 边界：不碰 Vue 状态，不碰订阅，不写界面。
 * 被谁持有：TaskConsole 组件持有一个实例。
 */
export interface ApiResult {
  status: number
  data: unknown
}

export class ApiClient {
  /** 发一次请求。返回状态码与解析后的数据；解析失败时 data 为 null。 */
  async request(path: string, init?: RequestInit): Promise<ApiResult> {
    const response = await fetch(path, init)
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    return { status: response.status, data }
  }

  /** 从错误体里取一句可读原因。 */
  static messageOf(data: unknown, fallback: string): string {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      for (const key of ['detail', 'error', 'message']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
    }
    return fallback
  }
}
