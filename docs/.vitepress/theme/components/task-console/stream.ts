/**
 * 前端控制台对象二：EventStream。
 *
 * 职责：建立与关闭 SSE 连接，把事件交给回调。
 * 边界：不解析业务字段，不管重连节奏，不碰界面。
 * 被谁持有：TaskConsole 组件在打开输出流时创建一个实例。
 */
export interface StreamCallbacks {
  onOpen(): void
  onOutput(raw: string): void
  onStatus(raw: string): void
  onEnd(raw: string): void
  /** 连接被彻底关闭时回调，由调用方决定是否重建。 */
  onClosed(): void
}

export class EventStream {
  private source: EventSource | null = null

  constructor(private readonly callbacks: StreamCallbacks) {}

  open(url: string): void {
    this.close()
    const stream = new EventSource(url)
    this.source = stream
    stream.onopen = () => this.callbacks.onOpen()
    stream.addEventListener('output', (event) => {
      this.callbacks.onOutput((event as MessageEvent).data)
    })
    stream.addEventListener('status', (event) => {
      this.callbacks.onStatus((event as MessageEvent).data)
    })
    stream.addEventListener('end', (event) => {
      this.callbacks.onEnd((event as MessageEvent).data)
    })
    stream.onerror = () => {
      // 浏览器会自动重连并带上 Last-Event-ID。彻底关闭时由调用方按序号重建。
      if (stream.readyState === EventSource.CLOSED) this.callbacks.onClosed()
    }
  }

  close(): void {
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }
}
