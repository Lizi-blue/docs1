# Python 后端方向目录方案（草案）

> 本文件只排目录与讲次，不写正文。落地前先读 `AGENTS.md` §1 与 §4。

## 一、总览

| 一级（知识域） | slug | order | 讲数 | 状态建议 | 一句话定位 |
|---|---|---|---|---|---|
| 01 并发编程 | concurrency | 1 | 14 | active | 线程、进程、协程与调度 |
| 02 跨线程与跨进程通信 | communication | 2 | 4 | active | 队列、共享状态、信号与套接字 |
| 03 网络编程 | network | 3 | 6 | outline | TCP、HTTP、socket 与抓包 |
| 04 数据库 | database | 4 | 8 | outline | SQL、索引、事务与 ORM |
| 05 操作系统 | os | 5 | 6 | outline | 进程、内存、I/O 与排查 |
| 06 系统设计 | system-design | 6 | 10 | outline | 容量、缓存、消息与一致性 |
| 07 语言核心机制 | language-core | 7 | 10 | active | 数据模型、元类、描述符与异常 |
| 08 类型系统与类型检查 | type-system | 8 | 8 | outline | typing、泛型、Protocol 与检查器 |
| 09 CPython 运行时与性能 | cpython-runtime | 9 | 10 | active | 对象模型、GC、剖析与压测 |
| 10 架构与领域设计 | architecture | 10 | 10 | active | 设计模式、分层、DDD 与 API |
| 11 工程化与交付 | engineering | 11 | 10 | outline | 配置、日志、测试、依赖与发布 |
| 12 Web 运行时与安全 | web-runtime | 12 | 9 | outline | WSGI/ASGI、框架原理与安全 |
| 合计 |  |  | 105 |  | 12 个一级知识域 |

状态建议的读法：`active` 表示建议先写，`outline` 表示先登记。
01 与 02 已开写，其余 `active` 是本轮建议先写的三个域。
01 有 14 讲，超出「单域 12 讲」的契约上限。这是现状，本轮不改。

## 二、二级目录（按一级展开）

### 1. 并发编程（slug: concurrency）

- audience: 有 Python 语法基础、准备中高级后端面试的开发者
- prerequisites: ①能读写 Python 函数与类 ②了解进程与线程的基本概念 ③能用命令行运行 Python 脚本
- outcomes: ①能解释 GIL 的让出点并据此选择线程、进程或协程 ②能用锁、条件变量与信号量组织线程协作 ③能用执行器编排任务并处理超时与异常 ④能按数据体积选择跨进程传递方式 ⑤能定位并发卡死并写出可靠的异步流程

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-thread-basics | 多线程基础 | 讲清线程创建、锁与 GIL 的关系 |
| 2 | 02-process-basics | 多进程基础 | 讲清进程启动方式与跨进程数据传递 |
| 3 | 03-queue-pipe | Queue 通信 | 讲清队列、哨兵与消费者的优雅退出 |
| 4 | 04-async-io | 异步 I/O | 讲清事件循环、协程与限流边界 |
| 5 | 05-gil-internals | GIL 内部机制 | 讲清 GIL 的三条让出路径与选型结论 |
| 6 | 06-sync-primitives | 同步原语与死锁 | 讲清锁家族分工与死锁排查办法 |
| 7 | 07-executor-pools | 执行器与任务编排 | 讲清执行器与 Future 的取值边界 |
| 8 | 08-shared-memory | 共享内存与进程间数据 | 讲清共享内存的零拷贝与同步代价 |
| 9 | 09-async-advanced | asyncio 进阶模式 | 讲清任务组、超时与背压的写法 |
| 10 | 10-subprocess-signals | 子进程与信号 | 讲清命令树超时清理与信号处理 |
| 11 | 11-concurrency-debugging | 并发问题定位 | 讲清用栈与指标定位并发问题 |
| 12 | 12-asyncio-thread-bridge | 异步与线程协作 | 讲清线程与事件循环的安全交接 |
| 13 | 13-thread-communication | 线程间通信与共享内存范围 | 讲清线程共享内存范围与通信手段 |
| 14 | 14-event-loop-internals | 事件循环原理与 await 语义 | 讲清 await 挂起恢复与回调顺序 |

### 2. 跨线程与跨进程通信（slug: communication）

- audience: 有多线程与多进程基础、准备中高级后端面试的开发者
- prerequisites: ①能写生产者与消费者循环 ②了解锁与条件变量的基本用法 ③能用命令行运行多进程脚本
- outcomes: ①能按数据体积与进程边界选择传递方式 ②能写出带背压与哨兵的可靠消费者循环 ③能用信号量、事件与屏障协调多进程节奏 ④能让进程组响应信号并优雅退出 ⑤能设计长度前缀协议并处理粘包

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-queue-and-pipe | 队列与管道通信 | 讲清队列与管道的阻塞语义与退出约定 |
| 2 | 02-shared-state | 共享状态与共享内存 | 讲清共享内存的零拷贝与生命周期代价 |
| 3 | 03-semaphore-and-signal | 信号量与信号 | 讲清信号量的通信语义与信号退出流程 |
| 4 | 04-socket-and-streams | 套接字与流 | 讲清多路复用、流接口与粘包处理 |

### 3. 网络编程（slug: network）

- audience: 有 Python 基础、准备后端面试的开发者
- prerequisites: ①能读写 Python 函数与类 ②了解进程与线程的基本概念 ③知道 HTTP 请求与响应的结构
- outcomes: ①能按协议分层定位网络问题 ②能写出可复用的 socket 客户端与服务器 ③能解释 TCP 与 HTTP 的关键差异 ④能读懂抓包结果并还原请求链路 ⑤能按超时与重试策略配置客户端

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-tcp-vs-http | TCP 与 HTTP 的边界 | 讲清 TCP 与 HTTP 的分工与差异 |
| 2 | 02-socket-lifecycle | TCP 连接与 socket 生命周期 | 讲清 TCP 状态迁移与 socket 收尾 |
| 3 | 03-protocol-layering | 协议分层与排障 | 讲清分层模型与逐层定位方法 |
| 4 | 04-packet-capture | 抓包与链路还原 | 讲清抓包点位与请求链路还原 |
| 5 | 05-timeout-retry | 超时与重试策略 | 讲清超时、重试与连接复用取舍 |
| 6 | 06-dns-tls | DNS 与 TLS 握手 | 讲清 DNS 解析与 TLS 握手步骤 |

### 4. 数据库（slug: database）

- audience: 有 Python 基础、准备后端面试的开发者
- prerequisites: ①能写出基本的 SQL 查询 ②了解关系模型与主键 ③知道事务与索引的用途
- outcomes: ①能解释 B+ 树索引与最左前缀 ②能按隔离级别判断并发读写的结果 ③能定位慢查询并给出改写方案 ④能写出带事务边界的 ORM 数据访问 ⑤能配置连接池并解释容量上限

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-sql-execution | SQL 执行路径 | 讲清一条 SQL 的解析与执行代价 |
| 2 | 02-btree-index | B+ 树索引 | 讲清 B+ 树索引与最左前缀规则 |
| 3 | 03-index-design | 索引设计 | 讲清覆盖索引与回表的取舍 |
| 4 | 04-transaction-isolation | 事务与隔离级别 | 讲清隔离级别下的并发读写结果 |
| 5 | 05-lock-mvcc | 锁与 MVCC | 讲清行锁、间隙锁与多版本读 |
| 6 | 06-orm-session | ORM 会话与加载 | 讲清会话边界、延迟加载与 N+1 |
| 7 | 07-connection-pool | 连接池 | 讲清连接池容量与超时配置 |
| 8 | 08-slow-query | 慢查询定位 | 讲清慢查询定位与改写路径 |

### 5. 操作系统（slug: os）

- audience: 有 Python 基础、准备后端面试的开发者
- prerequisites: ①了解进程、线程与内存的基本概念 ②用过命令行查看进程与端口 ③知道文件与目录的基本操作
- outcomes: ①能解释虚拟内存与页表的作用 ②能区分阻塞、非阻塞与多路复用 I/O ③能用 top 与 strace 定位资源问题 ④能定位句柄泄漏与内存增长 ⑤能用 perf 采样热点函数

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-process-thread | 进程、线程与调度 | 讲清进程、线程与调度的边界 |
| 2 | 02-virtual-memory | 虚拟内存与页表 | 讲清虚拟内存、页表与缺页中断 |
| 3 | 03-io-model | I/O 模型 | 讲清阻塞、非阻塞与多路复用 |
| 4 | 04-page-cache | 页缓存与写回 | 讲清页缓存与写回对性能的影响 |
| 5 | 05-file-descriptor | 文件描述符 | 讲清描述符分配与句柄泄漏排查 |
| 6 | 06-linux-tools | Linux 排查工具 | 讲清 top、strace 与 perf 的用法 |

### 6. 系统设计（slug: system-design）

- audience: 有后端开发经验、准备中高级面试的开发者
- prerequisites: ①了解 HTTP 服务与数据库的基本用法 ②能读懂并发与队列的基本模型 ③知道缓存与消息队列的用途
- outcomes: ①能按访问量做容量估算与拆分 ②能解释缓存穿透、击穿与雪崩的差别 ③能给出限流与降级的具体方案 ④能设计幂等写入与补偿流程 ⑤能划分多租户隔离边界

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-capacity-estimate | 容量估算 | 讲清按访问量做容量估算的步骤 |
| 2 | 02-cache-patterns | 缓存三大问题 | 讲清穿透、击穿与雪崩的差别 |
| 3 | 03-cache-consistency | 缓存一致性 | 讲清缓存与数据库的一致性方案 |
| 4 | 04-message-queue | 消息队列 | 讲清投递语义、顺序与重复消费 |
| 5 | 05-event-driven | 事件驱动 | 讲清事件驱动与事务消息的边界 |
| 6 | 06-task-scheduling | 任务调度 | 讲清定时任务的调度、重试与补偿 |
| 7 | 07-idempotency | 幂等设计 | 讲清幂等键设计与重复请求处理 |
| 8 | 08-rate-limit-degrade | 限流与熔断 | 讲清限流、降级与熔断的配合 |
| 9 | 09-distributed-consistency | 分布式一致性 | 讲清一致性模型的取舍与落地 |
| 10 | 10-multi-tenant | 多租户设计 | 讲清租户隔离、配额与数据边界 |

### 7. 语言核心机制（slug: language-core）

- audience: 写过类与装饰器、想补齐语言机制的开发者
- prerequisites: ①能读写 Python 类与函数 ②用过装饰器与生成器 ③了解对象与属性的基本用法
- outcomes: ①能解释属性查找与描述符的调用顺序 ②能用元类或 __init_subclass__ 约束子类 ③能按协议实现迭代、上下文与比较 ④能设计清晰的异常层次与异常组 ⑤能排查导入失败与循环导入

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-data-model | 数据模型与魔术方法 | 讲清魔术方法与协议的调用时机 |
| 2 | 02-object-lifecycle | 对象创建与生命周期 | 讲清对象创建、初始化与销毁 |
| 3 | 03-attribute-access | 属性访问与 __slots__ | 讲清属性查找顺序与 __slots__ 代价 |
| 4 | 04-descriptors | 描述符协议 | 讲清描述符协议与属性代理 |
| 5 | 05-metaclass | 元类编程 | 讲清元类创建类对象的流程 |
| 6 | 06-decorators-closures | 装饰器与闭包 | 讲清闭包捕获与装饰器叠加顺序 |
| 7 | 07-context-managers | 上下文管理器 | 讲清 with 协议与资源释放时机 |
| 8 | 08-iterators-generators | 迭代器与生成器 | 讲清迭代协议与生成器暂停恢复 |
| 9 | 09-exceptions | 异常层次与异常组 | 讲清异常层次、链式传递与异常组 |
| 10 | 10-modules-import | 模块与导入机制 | 讲清导入查找、缓存与循环导入 |

### 8. 类型系统与类型检查（slug: type-system）

- audience: 写过类型注解、想让检查真正生效的开发者
- prerequisites: ①能读写 Python 函数与类 ②用过 typing 的基本类型 ③能运行 mypy 或 pyright
- outcomes: ①能写出可检查的泛型与协议 ②能解释型变与重载的适用边界 ③能配置检查器并接入 CI ④能给出存量代码的加类型路径

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-typing-basics | 类型注解基础 | 讲清注解、联合类型与类型收窄 |
| 2 | 02-generics | 泛型与型变 | 讲清泛型参数、约束与型变 |
| 3 | 03-protocol | Protocol 与结构化子类型 | 讲清结构化子类型与 Protocol |
| 4 | 04-callable-typing | 可调用类型与重载 | 讲清 Callable、重载与 ParamSpec |
| 5 | 05-typed-dict-dataclass | TypedDict 与 dataclass | 讲清结构类型与数据类的边界 |
| 6 | 06-type-checkers | mypy 与 pyright | 讲清两个检查器的差异与配置 |
| 7 | 07-runtime-typing | 运行时类型信息 | 讲清 get_type_hints 与运行时取类型 |
| 8 | 08-type-migration | 渐进式类型迁移 | 讲清存量代码渐进加类型的路径 |

### 9. CPython 运行时与性能（slug: cpython-runtime）

- audience: 写过性能敏感代码、想读懂运行时的开发者
- prerequisites: ①能读写 Python 函数与类 ②了解引用与对象的基本概念 ③用过 cProfile 或 time 做测量
- outcomes: ①能解释对象布局与引用计数的代价 ②能读懂常用字节码指令 ③能判断内存增长来自泄漏或碎片 ④能用剖析数据定位热点并验证优化 ⑤能按压测结果给出容量结论

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-object-model | CPython 对象模型 | 讲清 PyObject 布局与引用计数 |
| 2 | 02-bytecode | 字节码与执行循环 | 讲清字节码指令与执行循环 |
| 3 | 03-reference-counting | 引用计数 | 讲清引用计数增减与循环引用 |
| 4 | 04-gc | 分代垃圾回收 | 讲清分代回收、阈值与调参 |
| 5 | 05-memory-allocator | 内存分配器 | 讲清 pymalloc 与内存碎片成因 |
| 6 | 06-profiling | 性能剖析 | 讲清 cProfile 与采样剖析的取舍 |
| 7 | 07-optimization | 热点优化 | 讲清热点定位与优化验证方法 |
| 8 | 08-leak-diagnosis | 内存泄漏定位 | 讲清内存增长的复现与定位 |
| 9 | 09-load-testing | 压测与容量 | 讲清压测模型、指标与容量结论 |
| 10 | 10-incident-triage | 线上故障应急 | 讲清线上故障的定位与止损顺序 |

### 10. 架构与领域设计（slug: architecture）

- audience: 写过业务模块、需要划分边界的开发者
- prerequisites: ①能读写 Python 类与模块 ②了解分层与接口的基本概念 ③写过一个完整的 HTTP 服务
- outcomes: ①能按变化方向选择设计模式 ②能划清分层边界与依赖方向 ③能建模实体、值对象与聚合 ④能设计稳定的 REST 接口与版本策略

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-pattern-selection | 模式选型 | 讲清 Python 惯用写法与模式取舍 |
| 2 | 02-creational-patterns | 创建型模式 | 讲清工厂、单例与注册表的用法 |
| 3 | 03-structural-patterns | 结构型模式 | 讲清适配器、装饰器与代理边界 |
| 4 | 04-behavioral-patterns | 行为型模式 | 讲清策略、责任链与观察者 |
| 5 | 05-layering | 分层与依赖方向 | 讲清分层边界与依赖倒置 |
| 6 | 06-dependency-injection | 依赖注入 | 讲清手工装配与容器注入 |
| 7 | 07-domain-modeling | 领域建模 | 讲清实体、值对象与聚合边界 |
| 8 | 08-ddd-repository | 仓储与领域事件 | 讲清仓储、领域服务与领域事件 |
| 9 | 09-api-design | REST 与 RPC 设计 | 讲清 REST 与 RPC 的建模与错误语义 |
| 10 | 10-api-evolution | 接口演进 | 讲清版本策略、幂等与兼容窗口 |

### 11. 工程化与交付（slug: engineering）

- audience: 负责服务交付、要建立工程规范的开发者
- prerequisites: ①能读写 Python 项目与依赖文件 ②用过日志与命令行排查问题 ③写过一个可运行的测试
- outcomes: ①能分层管理配置与密钥 ②能设计结构化日志与告警指标 ③能按测试金字塔分配用例 ④能治理依赖并锁定构建 ⑤能做出可回滚的容器发布

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-config-management | 配置管理 | 讲清分层配置与环境覆盖顺序 |
| 2 | 02-secrets | 密钥管理 | 讲清密钥托管、轮换与最小权限 |
| 3 | 03-logging | 结构化日志 | 讲清日志字段、级别与上下文传递 |
| 4 | 04-observability | 可观测性 | 讲清指标、链路与告警的配合 |
| 5 | 05-unit-testing | 单元测试 | 讲清测试边界与夹具设计 |
| 6 | 06-integration-contract | 集成与契约测试 | 讲清集成测试与契约测试分工 |
| 7 | 07-property-testing | 属性测试 | 讲清属性测试与生成式用例 |
| 8 | 08-packaging | 打包与依赖治理 | 讲清打包、锁文件与依赖治理 |
| 9 | 09-code-quality | 代码质量门禁 | 讲清 lint、格式与评审门禁 |
| 10 | 10-deploy-container | 容器化发布 | 讲清镜像、健康检查与回滚 |

### 12. Web 运行时与安全（slug: web-runtime）

- audience: 写过 Web 接口、想弄清框架与安全的开发者
- prerequisites: ①能读写 Python 函数与类 ②用过至少一个 Web 框架 ③了解 HTTP 请求与响应
- outcomes: ①能解释 WSGI 与 ASGI 的调用差异 ②能还原一次请求在框架内的路径 ③能设计认证、授权与令牌方案 ④能识别注入与反序列化风险 ⑤能给出统一错误响应与边界处理

| 序号 | slug | 标题 | goal |
|---|---|---|---|
| 1 | 01-wsgi | WSGI 协议 | 讲清 WSGI 调用约定与服务器接口 |
| 2 | 02-asgi | ASGI 协议 | 讲清 ASGI 事件模型与生命周期 |
| 3 | 03-framework-principles | 框架原理 | 讲清路由、中间件与请求上下文 |
| 4 | 04-request-lifecycle | 请求生命周期 | 讲清一次请求在框架内的路径 |
| 5 | 05-error-boundary | 异常边界 | 讲清异常边界与统一错误响应 |
| 6 | 06-authn-authz | 认证与授权 | 讲清认证、授权与权限模型 |
| 7 | 07-injection-defense | 注入防御 | 讲清 SQL、命令与模板注入防御 |
| 8 | 08-deserialization | 反序列化安全 | 讲清反序列化风险与安全替代 |
| 9 | 09-session-token | 会话与令牌 | 讲清会话、JWT 与令牌撤销 |

## 三、与现状的差异

| 动作 | 对象 | 原因 |
|---|---|---|
| 复用 | 01-concurrency（14 讲） | 正文已存在，slug 与 URL 保持不变 |
| 复用 | 02-communication（4 讲） | 正文已存在，作为并发域的通信延伸 |
| 补齐 | 03-network（0 到 6 讲） | 已登记大纲，本轮补讲次清单 |
| 补齐 | 04-database（0 到 8 讲） | 已登记大纲，本轮补讲次清单 |
| 补齐 | 05-os（0 到 6 讲） | 已登记大纲，本轮补讲次清单 |
| 补齐 | 06-system-design（0 到 10 讲） | 已登记大纲，本轮补讲次清单 |
| 新增 | 07-language-core（10 讲） | 语言机制整类缺失 |
| 新增 | 08-type-system（8 讲） | typing 与类型检查无归属 |
| 新增 | 09-cpython-runtime（10 讲） | 内存、GC、字节码与性能无归属 |
| 新增 | 10-architecture（10 讲） | 模式、分层、DDD 与 API 设计无归属 |
| 新增 | 11-engineering（10 讲） | 配置、日志、测试、依赖与发布无归属 |
| 新增 | 12-web-runtime（9 讲） | WSGI/ASGI、框架原理与安全无归属 |
| 调整 | 03 至 06 的 prerequisites | 原为 1 到 2 条，补齐到 3 条 |
| 不改 | 现有 18 讲的 slug 与标题 | 守住已有链接与登记 |
| 例外 | 01-concurrency 的 14 讲 | 超出 12 讲上限，本轮保留现状 |

### 登记约定

- 覆盖矩阵的键写作 `backend/learn/<目录名>`，例如 `backend/learn/07-language-core`。
- 域转 `active` 时再登记 topics。空目录登记会让 `check:coverage` 直接失败。
- `outline` 域在 `_meta.yml` 里保持 `teach.status: outline` 与 `lessons: []`。
- 本文件的讲次清单只是排期，不写进元数据。
- 开写时按域分批落页。每落一讲就同步 `teach.lessons` 与 `teach.path`。
- path 按 2 到 4 段分组，每段 2 到 4 讲，段间写清先后。
- 本文件的 goal 都不超过 25 字，落在 V15 要求的 10 到 60 字区间。
- 新域若写 `source_module`，先查 `scripts/data/module-api-index.json`。
- 目录前缀只决定排序。URL 会去掉前缀，现有链接不受影响。
- 01 的拆分另立专题。拆分要改 URL，本轮不做。

## 四、覆盖自查表

| 主题类别 | 覆盖它的一级/讲 | 是否补齐 |
|---|---|---|
| 语言机制 · 元类 | 07 / 05-metaclass | 是 |
| 语言机制 · 描述符 | 07 / 04-descriptors | 是 |
| 语言机制 · 数据模型与魔术方法 | 07 / 01-data-model、02-object-lifecycle | 是 |
| 语言机制 · 属性访问与 __slots__ | 07 / 03-attribute-access | 是 |
| 语言机制 · 迭代器与生成器协议 | 07 / 08-iterators-generators | 是 |
| 语言机制 · 装饰器与闭包 | 07 / 06-decorators-closures | 是 |
| 语言机制 · 上下文管理器 | 07 / 07-context-managers | 是 |
| 语言机制 · typing 与泛型 | 08 / 01-typing-basics、02-generics | 是 |
| 语言机制 · Protocol 与结构化子类型 | 08 / 03-protocol | 是 |
| 语言机制 · 异常层次与异常组 | 07 / 09-exceptions | 是 |
| 语言机制 · 模块与导入机制 | 07 / 10-modules-import | 是 |
| 语言机制 · 内存管理与 GC | 09 / 03-reference-counting、04-gc、05-memory-allocator | 是 |
| 语言机制 · CPython 对象模型与字节码 | 09 / 01-object-model、02-bytecode | 是 |
| 工程与设计 · 设计模式（Pythonic） | 10 / 01-pattern-selection 至 04-behavioral-patterns | 是 |
| 工程与设计 · 架构分层与依赖注入 | 10 / 05-layering、06-dependency-injection | 是 |
| 工程与设计 · 领域建模与 DDD | 10 / 07-domain-modeling、08-ddd-repository | 是 |
| 工程与设计 · API 设计（REST/RPC/幂等/版本） | 10 / 09-api-design、10-api-evolution、06 / 07-idempotency | 是 |
| 工程与设计 · 配置与密钥管理 | 11 / 01-config-management、02-secrets | 是 |
| 工程与设计 · 日志与可观测性 | 11 / 03-logging、04-observability | 是 |
| 工程与设计 · 测试体系（单元/集成/契约/属性测试） | 11 / 05-unit-testing、06-integration-contract、07-property-testing | 是 |
| 工程与设计 · 性能剖析与压测 | 09 / 06-profiling、07-optimization、09-load-testing | 是 |
| 工程与设计 · 打包与依赖治理 | 11 / 08-packaging | 是 |
| 工程与设计 · 代码质量与类型检查 | 08 / 06-type-checkers、11 / 09-code-quality | 是 |
| 数据与分布式 · SQL 与索引 | 04 / 01-sql-execution 至 03-index-design | 是 |
| 数据与分布式 · ORM 与事务 | 04 / 04-transaction-isolation 至 07-connection-pool | 是 |
| 数据与分布式 · 缓存与一致性 | 06 / 02-cache-patterns、03-cache-consistency | 是 |
| 数据与分布式 · 消息队列与事件驱动 | 06 / 04-message-queue、05-event-driven | 是 |
| 数据与分布式 · 任务调度 | 06 / 06-task-scheduling | 是 |
| 数据与分布式 · 分布式一致性与幂等 | 06 / 07-idempotency、09-distributed-consistency | 是 |
| 数据与分布式 · 限流降级熔断 | 06 / 08-rate-limit-degrade | 是 |
| 数据与分布式 · 多租户 | 06 / 10-multi-tenant | 是 |
| 运行时与安全 · Web 框架原理 | 12 / 03-framework-principles、04-request-lifecycle | 是 |
| 运行时与安全 · ASGI 与 WSGI | 12 / 01-wsgi、02-asgi | 是 |
| 运行时与安全 · 并发模型（已有域，只引用） | 01 / 全部 14 讲、02 / 全部 4 讲 | 是（复用） |
| 运行时与安全 · 安全（注入/反序列化/权限） | 12 / 06-authn-authz、07-injection-defense、08-deserialization | 是 |
| 运行时与安全 · 部署与容器化 | 11 / 10-deploy-container | 是 |
| 运行时与安全 · 故障定位与应急 | 09 / 08-leak-diagnosis、10-incident-triage、01 / 11-concurrency-debugging | 是 |

<!-- counts: 一级=12 讲=105 >

## 五、落地与本轮实际动作（2026-10-22）

| 动作 | 说明 |
|---|---|
| 已登记 6 个新域为 outline | `07-language-core`、`08-type-system`、`09-cpython-runtime`、`10-architecture`、`11-engineering`、`12-web-runtime`。只落 `_meta.yml`，不建页面（门禁要求） |
| 线程通信讲的归属修正 | 「线程间通信与共享内存范围」落在 `02-communication` 的第 5 讲。理由是仓库已有「跨线程与跨进程通信」域，其 `02-shared-state` 讲的是进程间共享，不重复 |
| 事件循环讲留并发域 | 「事件循环原理与 await 语义」编号为并发域第 13 讲，URL 为 `/backend/learn/concurrency/event-loop-internals` |
| 覆盖矩阵 | 线程共享范围与线程通信两个主题移到 `backend/learn/02-communication`；其余并发主题不变 |
| 未做 | 03–06 的 prerequisites 补齐与讲次清单待开写时再补；`01-concurrency` 14 讲待拆分 |

开写顺序建议：`07-language-core` → `09-cpython-runtime` → `10-architecture`，其余三域先登记。
