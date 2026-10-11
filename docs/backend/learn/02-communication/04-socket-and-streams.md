---
title: "套接字与流"
type: knowledge
domain: backend
knowledge_domain: communication
order: 4
level: advanced
tags: [socket, selectors, asyncio-streams, framing]
description: "阻塞套接字、selectors 多路复用与 asyncio 流接口"
source_module: "socket"
api_methods:
  - "socket.socket"
  - "socket.accept"
  - "socket.sendall"
  - "asyncio.open_connection"
  - "asyncio.start_server"
prerequisites:
  - /backend/learn/communication/queue-and-pipe
  - /backend/learn/concurrency/async-io
related_knowledge:
  - /backend/learn/concurrency/asyncio-thread-bridge
  - /backend/learn/communication/semaphore-and-signal
  - /backend/learn/concurrency/concurrency-debugging
related_components:
  - /backend/components/safe-queue
---

# 套接字与流

### 本讲要解决的问题

两个进程不在同一台机器时，队列就不好用了。
跨进程的通道怎么延伸到网络与 Unix 域？
这一讲用套接字回答这个问题。
重点是超时、多路复用与消息边界三件事。

## TL;DR

> 套接字给的是字节流，读到的长度与写入的长度不保证一致。
> 阻塞套接字要配 `settimeout`，否则一条慢连接拖住整条流程。
> 单线程管很多连接用 `selectors`，协程用 `asyncio` 流接口。
> 消息边界自己定，最常用的是四字节长度前缀。

## 概念定义

套接字是内核提供的一条双向字节通道。
TCP 流没有消息边界，所以粘包与拆包都是常态。
多路复用指一个线程同时等多个套接字上的事件。
`selectors` 是标准库的多路复用封装，屏蔽各平台接口差异。
`asyncio` 流把套接字事件接到协程上，写法接近同步代码。
Unix 域套接字走本地文件路径，不经过网络协议栈。

## 原理图解

下图画出事件循环等待网络事件，以及协程之间的轮转。

<DiagramFrame src="/diagrams/async-event-loop.html" title="事件循环等待网络事件（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | 阻塞套接字 | selectors | asyncio 流 | Unix 域 |
|---|---|---|---|---|
| 并发模型 | 一线程一连接 | 单线程多连接 | 单线程多协程 | 四种都可用 |
| 写法 | 最直白 | 事件回调 | 顺序式 | 顺序式 |
| 超时 | `settimeout` | 每轮超时 | `wait_for` | 同左 |
| 适用 | 连接数少 | 中等并发 | 高并发 | 本机进程 |

### 官方依据与版本差异

- [socket 官方文档](https://docs.python.org/3/library/socket.html) — 3.11 起 `create_connection` 增加 `all_errors` 参数。
- [selectors 官方文档](https://docs.python.org/3/library/selectors.html) — 3.4 起进入标准库，接口稳定至今。
- [asyncio 流文档](https://docs.python.org/3/library/asyncio-stream.html) — `open_connection` 与 `start_server` 自 3.4 提供，3.8 起流对象接口稳定。
- [PEP 3156 asyncio](https://peps.python.org/pep-3156/) — 3.4 起进入标准库。

## API 手册：套接字与流

<ApiTable :items='[{&quot;name&quot;:&quot;socket.socket&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;socket(family=AF_INET, type=SOCK_STREAM, proto=0, fileno=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;family&quot;,&quot;type&quot;:&quot;AddressFamily&quot;,&quot;default&quot;:&quot;AF_INET&quot;,&quot;desc&quot;:&quot;地址族，本机通信用 AF_UNIX&quot;},{&quot;name&quot;:&quot;type&quot;,&quot;type&quot;:&quot;SocketKind&quot;,&quot;default&quot;:&quot;SOCK_STREAM&quot;,&quot;desc&quot;:&quot;传输类型，数据报用 SOCK_DGRAM&quot;},{&quot;name&quot;:&quot;proto&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;协议号，通常留 0&quot;}],&quot;returns&quot;:&quot;套接字对象&quot;,&quot;methods&quot;:[&quot;bind(address) — 绑定地址&quot;,&quot;listen(backlog) — 开始监听&quot;,&quot;accept() — 接受连接&quot;,&quot;connect(address) — 发起连接&quot;,&quot;recv(bufsize) — 读取字节&quot;,&quot;sendall(data) — 写完整个缓冲区&quot;,&quot;settimeout(value) — 设置超时&quot;,&quot;shutdown(how) — 半关闭&quot;,&quot;close() — 关闭套接字&quot;],&quot;effect&quot;:&quot;得到一条内核维护的双向字节通道&quot;,&quot;scenario&quot;:&quot;跨机器或本机进程之间的自定义协议&quot;,&quot;example&quot;:&quot;import socket\n\nwith socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:\n    srv.bind((\&quot;127.0.0.1\&quot;, 0))\n    srv.listen(1)\n    print(srv.getsockname())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;用 with 时只保证 close，不保证对端已经收到数据&quot;},{&quot;name&quot;:&quot;socket.bind&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;bind(address)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;address&quot;,&quot;type&quot;:&quot;tuple | str&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;AF_INET 用 (host, port)，AF_UNIX 用路径&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;把套接字固定到一个本地地址&quot;,&quot;scenario&quot;:&quot;服务端占住端口等待连接&quot;,&quot;example&quot;:&quot;srv.bind((\&quot;0.0.0.0\&quot;, 9000))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;端口被占用时抛 OSError，重启服务要先放开 TIME_WAIT&quot;},{&quot;name&quot;:&quot;socket.listen&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;listen(backlog=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;backlog&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;等待接受的连接队列长度&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;把套接字转入监听状态&quot;,&quot;scenario&quot;:&quot;服务端开始接收连接请求&quot;,&quot;example&quot;:&quot;srv.listen(128)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;backlog 太小会直接拒绝洪峰连接，不是排队等待&quot;},{&quot;name&quot;:&quot;socket.accept&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;accept()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;(conn, address) 二元组&quot;,&quot;effect&quot;:&quot;阻塞到有新连接，返回一条新套接字&quot;,&quot;scenario&quot;:&quot;服务端主循环逐条接受连接&quot;,&quot;example&quot;:&quot;conn, address = srv.accept()\nwith conn:\n    print(address, conn.recv(1024))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;返回的新套接字要自己关，原监听套接字不能复用&quot;},{&quot;name&quot;:&quot;socket.connect&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;connect(address)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;address&quot;,&quot;type&quot;:&quot;tuple | str&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;目标地址&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;发起三次握手，成功后才返回&quot;,&quot;scenario&quot;:&quot;客户端连接已知的服务地址&quot;,&quot;example&quot;:&quot;client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\nclient.settimeout(2.0)\nclient.connect((\&quot;127.0.0.1\&quot;, 9000))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;不设超时可能挂很久，连接前先 settimeout&quot;},{&quot;name&quot;:&quot;socket.recv&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;recv(bufsize, flags=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;bufsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;本次最多读取的字节数&quot;},{&quot;name&quot;:&quot;flags&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;读取标志&quot;}],&quot;returns&quot;:&quot;bytes，对端关闭时返回空串&quot;,&quot;effect&quot;:&quot;从内核缓冲区取走至多 bufsize 字节&quot;,&quot;scenario&quot;:&quot;按协议长度循环读满正文&quot;,&quot;example&quot;:&quot;def recv_exact(conn: socket.socket, size: int) -&gt; bytes:\n    data = b\&quot;\&quot;\n    while len(data) &lt; size:\n        chunk = conn.recv(size - len(data))\n        if not chunk:\n            raise ConnectionError(\&quot;对端提前关闭\&quot;)\n        data += chunk\n    return data&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;返回空串是关闭信号，当成空消息处理会死循环&quot;},{&quot;name&quot;:&quot;socket.sendall&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;sendall(data, flags=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;data&quot;,&quot;type&quot;:&quot;bytes&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;要发送的字节&quot;},{&quot;name&quot;:&quot;flags&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;发送标志&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;循环调用 send，直到全部字节交给内核&quot;,&quot;scenario&quot;:&quot;发送完整的协议帧&quot;,&quot;example&quot;:&quot;srv.sendall(header + body)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;只保证写进内核缓冲区，不代表对端已经收走&quot;},{&quot;name&quot;:&quot;socket.close&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;close()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;关闭套接字并释放描述符&quot;,&quot;scenario&quot;:&quot;连接处理结束后立刻释放资源&quot;,&quot;example&quot;:&quot;conn.close()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;重复关闭会抛 OSError，用 with 更省心&quot;},{&quot;name&quot;:&quot;socket.settimeout&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;settimeout(value)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;value&quot;,&quot;type&quot;:&quot;float | None&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;超时秒数，None 表示一直阻塞，0 表示非阻塞&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;给阻塞操作加一个时间上限&quot;,&quot;scenario&quot;:&quot;防止一条慢连接拖住整个处理流程&quot;,&quot;example&quot;:&quot;conn.settimeout(5.0)\nconn.recv(1024)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;超时抛 TimeoutError，套接字状态不变，可继续重试&quot;},{&quot;name&quot;:&quot;socket.shutdown&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;shutdown(how)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;how&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;SHUT_RD、SHUT_WR 或 SHUT_RDWR&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;关闭一个方向，把半关闭状态告诉对端&quot;,&quot;scenario&quot;:&quot;请求发完后通知对端不再发送&quot;,&quot;example&quot;:&quot;conn.shutdown(socket.SHUT_WR)\nprint(conn.recv(1024))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;它不发 FIN 之外的语义，只关闭方向，不释放描述符&quot;},{&quot;name&quot;:&quot;socket.setsockopt&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;setsockopt(level, optname, value)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;level&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;选项层级，如 SOL_SOCKET&quot;},{&quot;name&quot;:&quot;optname&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;选项名，如 SO_REUSEADDR&quot;},{&quot;name&quot;:&quot;value&quot;,&quot;type&quot;:&quot;int | bytes&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;选项值&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;调整内核套接字行为&quot;,&quot;scenario&quot;:&quot;服务重启时立刻复用地址、开长连接保活&quot;,&quot;example&quot;:&quot;srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;必须在 bind 之前设置，事后设置不生效&quot;},{&quot;name&quot;:&quot;socket.setdefaulttimeout&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;setdefaulttimeout(timeout)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float | None&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;新套接字的默认超时秒数&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;给之后新建的套接字定默认超时&quot;,&quot;scenario&quot;:&quot;项目级统一兜底，避免漏设超时&quot;,&quot;example&quot;:&quot;socket.setdefaulttimeout(3.0)\nprint(socket.getdefaulttimeout())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;只影响之后新建的套接字，已有连接不受影响&quot;},{&quot;name&quot;:&quot;socket.AF_UNIX&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;socket.AF_UNIX&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;地址族常量&quot;,&quot;effect&quot;:&quot;用文件系统路径寻址，不经过网络协议栈&quot;,&quot;scenario&quot;:&quot;同一台机器上的进程间通信&quot;,&quot;example&quot;:&quot;srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)\nsrv.bind(\&quot;/tmp/app.sock\&quot;)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;路径被占用时 bind 失败，要先清掉残留文件&quot;},{&quot;name&quot;:&quot;socket.AF_INET&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;socket.AF_INET&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;地址族常量&quot;,&quot;effect&quot;:&quot;用 IPv4 地址与端口寻址&quot;,&quot;scenario&quot;:&quot;跨机器通信与本地回环调试&quot;,&quot;example&quot;:&quot;srv.bind((\&quot;127.0.0.1\&quot;, 9000))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;监听 127.0.0.1 时容器外无法访问，要按需改 0.0.0.0&quot;},{&quot;name&quot;:&quot;socket.SOCK_STREAM&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;socket.SOCK_STREAM&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;传输类型常量&quot;,&quot;effect&quot;:&quot;面向连接的可靠字节流&quot;,&quot;scenario&quot;:&quot;需要有序可靠传输的协议&quot;,&quot;example&quot;:&quot;s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;字节流没有消息边界，必须自己定帧&quot;},{&quot;name&quot;:&quot;socket.SOCK_DGRAM&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;socket.SOCK_DGRAM&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;传输类型常量&quot;,&quot;effect&quot;:&quot;保留消息边界的数据报，不保证送达&quot;,&quot;scenario&quot;:&quot;指标上报、日志收集、局域网发现&quot;,&quot;example&quot;:&quot;udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)\nudp.sendto(b\&quot;ping\&quot;, (\&quot;127.0.0.1\&quot;, 9001))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;单包过大会被截断，读的时候要给足缓冲区&quot;},{&quot;name&quot;:&quot;socket.create_connection&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;create_connection(address, timeout=..., source_address=None, all_errors=False)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;address&quot;,&quot;type&quot;:&quot;tuple&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;目标 (host, port)&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float | None&quot;,&quot;default&quot;:&quot;全局默认&quot;,&quot;desc&quot;:&quot;连接超时秒数&quot;},{&quot;name&quot;:&quot;all_errors&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;False&quot;,&quot;desc&quot;:&quot;3.11 起可收集全部尝试的异常&quot;}],&quot;returns&quot;:&quot;已连接的套接字&quot;,&quot;effect&quot;:&quot;按地址列表逐个尝试，成功即返回&quot;,&quot;scenario&quot;:&quot;客户端快速建连，省去手工解析&quot;,&quot;example&quot;:&quot;import socket\n\nwith socket.create_connection((\&quot;127.0.0.1\&quot;, 9000), timeout=2) as conn:\n    conn.sendall(b\&quot;ping\&quot;)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;域名解析慢也会占用同一个超时预算&quot;},{&quot;name&quot;:&quot;socket.getaddrinfo&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;getaddrinfo(host, port, family=0, type=0, proto=0, flags=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;host&quot;,&quot;type&quot;:&quot;str | None&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;主机名或地址&quot;},{&quot;name&quot;:&quot;port&quot;,&quot;type&quot;:&quot;int | str | None&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;端口或服务名&quot;},{&quot;name&quot;:&quot;family&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;地址族过滤&quot;},{&quot;name&quot;:&quot;type&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;传输类型过滤&quot;}],&quot;returns&quot;:&quot;五元组列表&quot;,&quot;effect&quot;:&quot;一次拿到地址族、类型与具体地址的组合&quot;,&quot;scenario&quot;:&quot;同时兼容 IPv4 与 IPv6 的客户端&quot;,&quot;example&quot;:&quot;import socket\n\nfor family, kind, proto, _, addr in socket.getaddrinfo(\&quot;localhost\&quot;, 9000):\n    print(family, kind, addr)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;结果要逐个尝试并捕获异常，不要只取第一条&quot;},{&quot;name&quot;:&quot;asyncio.open_connection&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;await asyncio.open_connection(host, port)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;host&quot;,&quot;type&quot;:&quot;str&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;目标主机&quot;},{&quot;name&quot;:&quot;port&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;目标端口&quot;},{&quot;name&quot;:&quot;limit&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;65536&quot;,&quot;desc&quot;:&quot;读缓冲区上限&quot;}],&quot;returns&quot;:&quot;(StreamReader, StreamWriter) 二元组&quot;,&quot;effect&quot;:&quot;在事件循环上建连并返回两个流对象&quot;,&quot;scenario&quot;:&quot;高并发客户端，一个线程管成百上千条连接&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def main() -&gt; None:\n    reader, writer = await asyncio.open_connection(\&quot;127.0.0.1\&quot;, 9000)\n    writer.write(b\&quot;ping\&quot;)\n    await writer.drain()\n    print(await reader.read(4))\n    writer.close()\n\nasyncio.run(main())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;不 await drain 就可能把写缓冲区撑爆，内存一路涨&quot;},{&quot;name&quot;:&quot;asyncio.start_server&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;await asyncio.start_server(client_connected_cb, host=None, port=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;client_connected_cb&quot;,&quot;type&quot;:&quot;callable&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;接收 (reader, writer) 的回调&quot;},{&quot;name&quot;:&quot;host&quot;,&quot;type&quot;:&quot;str | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;监听地址&quot;},{&quot;name&quot;:&quot;port&quot;,&quot;type&quot;:&quot;int | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;监听端口&quot;}],&quot;returns&quot;:&quot;Server 对象，可当异步上下文管理器&quot;,&quot;effect&quot;:&quot;每条新连接自动起一个协程处理&quot;,&quot;scenario&quot;:&quot;异步服务端，连接数远超线程数&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def handle(reader, writer) -&gt; None:\n    writer.write(await reader.read(64))\n    await writer.drain()\n\nasync def main() -&gt; None:\n    server = await asyncio.start_server(handle, \&quot;127.0.0.1\&quot;, 9000)\n    async with server:\n        await server.serve_forever()\n\nasyncio.run(main())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;回调里阻塞事件循环会让全部连接一起卡住&quot;},{&quot;name&quot;:&quot;asyncio.StreamReader.read&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;await reader.read(n=-1)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;n&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;-1&quot;,&quot;desc&quot;:&quot;最多读取的字节数，-1 表示读到结束&quot;}],&quot;returns&quot;:&quot;bytes&quot;,&quot;effect&quot;:&quot;读到 n 字节或对端关闭就返回&quot;,&quot;scenario&quot;:&quot;按长度前缀协议读满正文&quot;,&quot;example&quot;:&quot;header = await reader.readexactly(4)\n(length,) = struct.unpack(\&quot;!I\&quot;, header)\nbody = await reader.readexactly(length)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;read 不保证读满，要读满长度得用 readexactly&quot;},{&quot;name&quot;:&quot;asyncio.StreamWriter.drain&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;await writer.drain()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;等缓冲区降到水位以下再继续写&quot;,&quot;scenario&quot;:&quot;连续发送时做背压&quot;,&quot;example&quot;:&quot;writer.write(payload)\nawait writer.drain()\nwriter.close()\nawait writer.wait_closed()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;write 不阻塞也不等待，只有 drain 才会施加背压&quot;},{&quot;name&quot;:&quot;selectors.DefaultSelector&quot;,&quot;rank&quot;:&quot;进阶&quot;,&quot;signature&quot;:&quot;selectors.DefaultSelector()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;当前平台最优的多路复用器&quot;,&quot;methods&quot;:[&quot;register(fileobj, events, data) — 登记关注的事件&quot;,&quot;select(timeout=None) — 等待就绪事件&quot;,&quot;modify / unregister — 调整或取消登记&quot;,&quot;close() — 释放资源&quot;],&quot;effect&quot;:&quot;一个线程同时等待多个套接字的可读可写事件&quot;,&quot;scenario&quot;:&quot;不想引入 asyncio 的中等并发服务&quot;,&quot;example&quot;:&quot;import selectors\n\nsel = selectors.DefaultSelector()\nsel.register(srv, selectors.EVENT_READ, data=None)\nfor key, _ in sel.select(timeout=1.0):\n    print(key.fileobj)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;就绪不等于能读满，仍要按协议长度循环读&quot;}]' />

## 组合用法：四字节长度前缀的消息通道

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [队列与管道通信](/backend/learn/communication/queue-and-pipe) | 本机进程间的等价通道 |
| [异步 I/O](/backend/learn/concurrency/async-io) | 事件循环接管等待 |
| [并发问题定位](/backend/learn/concurrency/concurrency-debugging) | 卡住与半包问题的排查 |

### 数据流图解

下图画出客户端与服务端分处两个进程，以及中间的通道。

<DiagramFrame src="/diagrams/process-model.html" title="客户端与服务端的进程边界（Archify 交互图）" :height="480" />

### 分步实现

1. 服务端绑定地址并开始监听。
2. 客户端连接后先发四字节长度。
3. 紧跟消息体，两端都按长度切分。
4. 接收方循环读满长度再读正文。
5. 每条连接设超时，超时就关闭。
6. 关闭前调用 `shutdown()` 通知对端。

### 对比表格

| 方案 | 边界 | 超时 | 跨机 |
|---|---|---|---|
| 阻塞加长度前缀 | 自己定 | `settimeout` | 可以 |
| selectors | 自己定 | 每轮超时 | 可以 |
| asyncio 流 | 自己定 | `wait_for` | 可以 |
| Unix 域套接字 | 自己定 | 同阻塞 | 不行 |

## 完整 Demo：Unix 域上的长度前缀回显

### 场景描述

服务端用 Unix 域套接字监听一个文件路径。
客户端连上后发送两条长度前缀消息。
服务端按长度切分并原样回显。

### 完整代码

```python
"""长度前缀协议：Unix 域套接字上的回显服务。"""
import os
import socket
import struct
import threading

PATH = "/tmp/framing_demo.sock"
HEADER = struct.Struct("!I")


def recv_exact(conn: socket.socket, size: int) -> bytes:
    chunks: list = []
    remaining = size
    while remaining > 0:
        chunk = conn.recv(remaining)
        if not chunk:
            raise ConnectionError("对端提前关闭")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def serve(listener: socket.socket) -> None:
    conn, _ = listener.accept()
    with conn:
        conn.settimeout(5.0)
        while True:
            try:
                header = recv_exact(conn, HEADER.size)
            except (ConnectionError, TimeoutError, OSError):
                return
            (length,) = HEADER.unpack(header)
            body = recv_exact(conn, length)
            conn.sendall(HEADER.pack(len(body)) + body)


def main() -> None:
    if os.path.exists(PATH):
        os.unlink(PATH)
    listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    listener.bind(PATH)
    listener.listen(1)
    thread = threading.Thread(target=serve, args=(listener,), daemon=True)
    thread.start()

    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(5.0)
        client.connect(PATH)
        for text in (b"hello", b"framing"):
            client.sendall(HEADER.pack(len(text)) + text)
            (length,) = HEADER.unpack(recv_exact(client, HEADER.size))
            print(recv_exact(client, length).decode())
    thread.join(timeout=5)
    listener.close()


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 framing_demo.py
```

输出两行：hello 与 framing。

### 常见误区

- 「一次 `recv()` 就是一条消息」是错的。字节流会粘包，也会拆包。
- 「设了超时就万事大吉」是错的。超时只救本端，对端仍要自己收尾。
- 「Unix 域套接字要配端口」是错的。它绑定文件路径，权限也按文件算。
- 「`sendall()` 返回就代表对端收到」是错的。数据只进了内核缓冲区。

### 面试追问链

<details>
<summary>Q1：粘包到底是谁造成的？</summary>

TCP 只保证字节顺序，不保留写入边界。
一次读可能拿走两次写的内容，一次写也可能分两次到。

</details>

<details>
<summary>Q2：长度前缀协议怎么解决它？</summary>

先读固定四字节，得到正文长度。
再按长度循环读满，缺一字节就继续等。

</details>

<details>
<summary>Q3：为什么长度用 `!I` 而不是本机格式？</summary>

`!I` 固定为大端四字节，与机器无关。
跨机器通信时，字节序必须显式约定。

</details>

<details>
<summary>Q4：`asyncio` 流接口能复用这套协议吗？</summary>

可以，而且更省事。
`readexactly()` 直接按长度读满，不用手写循环。

</details>

<details>
<summary>Q5：一个线程管一千条连接怎么办？</summary>

改用 `selectors` 或 `asyncio`。
阻塞式一线程一连接会先耗尽线程与内存。

</details>

### 下一讲衔接

本域四讲到此收束。
回到 [渐进式学习入口](/backend/learn/) 看完整路径，或读 [进程安全队列](/backend/components/safe-queue) 看落地写法。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 处理的是本机队列。
需要跨机器时，把它的通道换成这里讲的套接字协议即可。
