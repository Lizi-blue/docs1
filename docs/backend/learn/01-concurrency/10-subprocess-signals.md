---
title: "子进程与信号"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 10
level: intermediate
tags: [subprocess, signal, timeout, process-group]
description: "拉起外部进程、超时回收与信号处理"
source_module: "subprocess"
api_methods:
  - "subprocess.run"
  - "subprocess.Popen"
  - "subprocess.TimeoutExpired"
  - "signal.signal"
  - "os.killpg"
prerequisites:
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/process-basics
  - /backend/learn/concurrency/executor-pools
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

程序常要调用外部命令，例如压缩、转码或外部工具。命令可能卡住，也可能留下僵尸子进程。这一讲把拉起、超时与回收讲清。

## TL;DR

> 一次性命令用 run。需要边读边写用 Popen。超时要杀整个进程组，不能只杀直接子进程。
> 服务要处理 SIGTERM，收到后先把在跑任务收尾再退出。

## 概念定义

子进程管理分三步：拉起、通信、回收。

拉起时可用 shell 或参数列表。参数列表更安全，能避免注入。通信可以走管道、文件或共享内存。回收指等待结束并读取退出码，否则会留下僵尸进程。超时处理要连子进程派生的进程一起终止，所以要用进程组。

## 原理图解

下图对比进程独立地址空间与父子的回收关系。

<DiagramFrame src="/diagrams/process-model.html" title="线程与进程的内存模型（Archify 交互图）" :height="500" />

## 关键对比

| 需求 | 选择 | 注意 |
|---|---|---|
| 跑一条命令取输出 | run | 设 timeout 与 check |
| 长驻或流式输出 | Popen | 自己管理管道与等待 |
| 需要 shell 特性 | run(shell=True) | 命令拼接有注入风险 |
| 超时要连子孙一起杀 | 进程组加 killpg | 单独 kill 只杀直接子进程 |
| 服务要优雅退出 | signal 处理函数 | 处理函数里只做标记 |

### 官方依据与版本差异

- [subprocess 官方文档](https://docs.python.org/3/library/subprocess.html) — run 自 3.5 起提供。
- [signal 官方文档](https://docs.python.org/3/library/signal.html) — 3.8 及以后行为一致，只在主线程生效。
- [os.killpg](https://docs.python.org/3/library/os.html#os.killpg) — POSIX 专用，3.8 及以后可用。

## API 手册：subprocess 与 signal

<ApiTable :items='[{"name": "subprocess.run", "rank": "必会", "signature": "run(args, timeout=None, check=False, capture_output=False)", "params": [{"name": "args", "type": "list | str", "default": "必填", "desc": "命令与参数"}, {"name": "timeout", "type": "float", "default": "None", "desc": "超时秒数，超时抛 TimeoutExpired"}, {"name": "check", "type": "bool", "default": "False", "desc": "非零退出码是否抛错"}, {"name": "capture_output", "type": "bool", "default": "False", "desc": "是否捕获标准输出与错误"}], "returns": "CompletedProcess 对象", "methods": ["run() — 阻塞到命令结束", "CompletedProcess.returncode — 退出码", "CompletedProcess.stdout — 标准输出"], "effect": "一条命令跑完再返回", "scenario": "调用外部工具并读取结果", "example": "import subprocess\n\nresult = subprocess.run([\"python3\", \"-c\", \"print(1)\"], capture_output=True, text=True, timeout=5)\nprint(result.stdout.strip())", "exampleLang": "python"}, {"name": "subprocess.Popen", "rank": "常用", "signature": "Popen(args, stdout=None, stderr=None, start_new_session=False)", "params": [{"name": "start_new_session", "type": "bool", "default": "False", "desc": "是否新建进程组，便于整组终止"}, {"name": "text", "type": "bool", "default": "False", "desc": "是否按文本读写"}], "returns": "Popen 对象", "methods": ["poll() — 非阻塞查状态", "wait(timeout=None) — 等待结束", "communicate(timeout=None) — 交互并等待", "terminate() 与 kill() — 发送终止信号"], "effect": "命令持续运行时边读边写", "scenario": "流式日志、交互式子进程", "example": "import subprocess\n\nproc = subprocess.Popen([\"python3\", \"-c\", \"print(2)\"], stdout=subprocess.PIPE, text=True, start_new_session=True)\nout, _ = proc.communicate(timeout=5)\nprint(out.strip())", "exampleLang": "python"}, {"name": "signal.signal", "rank": "常用", "signature": "signal(signalnum, handler)", "params": [{"name": "signalnum", "type": "int", "default": "必填", "desc": "如 SIGTERM"}, {"name": "handler", "type": "callable", "default": "必填", "desc": "处理函数，收到信号时在主线程调用"}], "returns": "旧的处理函数", "methods": ["SIGTERM 处理 — 标记退出", "SIGINT 处理 — 响应中断"], "effect": "让服务收到终止信号后收尾", "scenario": "容器里的优雅停机", "example": "import signal\nimport threading\n\nstopping = threading.Event()\n\ndef handle(signum, frame):\n    stopping.set()\n\nsignal.signal(signal.SIGTERM, handle)\nprint(stopping.is_set())", "exampleLang": "python"}, {"name": "os.killpg", "rank": "进阶", "signature": "killpg(pgid, sig)", "params": [{"name": "pgid", "type": "int", "default": "必填", "desc": "进程组号"}, {"name": "sig", "type": "int", "default": "必填", "desc": "信号，如 SIGTERM 或 SIGKILL"}], "returns": "无", "methods": ["killpg() — 给整组发信号", "os.getpgid(pid) — 取进程组号"], "effect": "一次终止子进程及其派生进程", "scenario": "超时清理命令树", "example": "import os\nimport signal\nimport subprocess\n\nproc = subprocess.Popen([\"sleep\", \"60\"], start_new_session=True)\ntry:\n    proc.wait(timeout=1)\nexcept subprocess.TimeoutExpired:\n    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)", "exampleLang": "python"}, {"name": "subprocess.TimeoutExpired", "rank": "必会", "signature": "TimeoutExpired(cmd, timeout)", "params": [{"name": "cmd", "type": "list", "default": "属性", "desc": "超时的命令"}, {"name": "timeout", "type": "float", "default": "属性", "desc": "设定的超时秒数"}], "returns": "异常对象", "methods": ["捕获后处理 — 终止并回收进程"], "effect": "把超时变成可处理的控制流", "scenario": "给外部命令设上限", "example": "import subprocess\n\ntry:\n    subprocess.run([\"sleep\", \"5\"], timeout=1, check=True)\nexcept subprocess.TimeoutExpired as exc:\n    print(f\"超过 {exc.timeout} 秒\")", "exampleLang": "python"}]' />

## 组合用法：带超时的外部命令执行器

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [子进程与信号](/backend/learn/concurrency/subprocess-signals) | 拉起与回收 |
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 并发跑多条命令 |
| [进程间数据](/backend/learn/concurrency/shared-memory) | 大输出落文件而非管道 |

### 数据流图解

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="任务与子进程的回收关系（Archify 交互图）" :height="460" />

### 分步实现

1. 用参数列表拼命令，避免注入。
2. 新建进程组，便于整组终止。
3. 设超时并在超时后发 SIGTERM。
4. 宽限期后仍不退就发 SIGKILL。
5. 读取退出码并记录耗时。

### 对比表格

| 终止方式 | 作用范围 | 适用 |
|---|---|---|
| terminate | 直接子进程 | 子进程无派生 |
| killpg SIGTERM | 整个进程组 | 子进程会派生 |
| killpg SIGKILL | 整个进程组 | 宽限期后仍不退 |
| 仅关闭管道 | 不终止进程 | 无 |

## 完整 Demo：超时清理命令树

### 场景描述

拉起一个会派生子进程的命令。一秒后超时，按进程组终止并打印退出码。

### 完整代码

```python
import os
import signal
import subprocess
import time

COMMAND = ["python3", "-c", "import time; time.sleep(60)"]


def run_with_timeout(command: list[str], timeout: float) -> int:
    start = time.perf_counter()
    proc = subprocess.Popen(command, start_new_session=True)
    try:
        return proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        try:
            return proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            return proc.wait()
    finally:
        print(f"耗时 {time.perf_counter() - start:.2f}s")


if __name__ == "__main__":
    print(f"退出码 {run_with_timeout(COMMAND, 1)}")
```

### 运行方式

```bash
python3 subprocess_demo.py
```

### 常见误区

- 只 kill 直接子进程。派生进程会变成孤儿继续跑。
- 在信号处理函数里做复杂操作。它随时可能被打断，只适合置标记。
- 用 shell=True 拼用户输入。会带来命令注入。
- 忘记 wait 就退出。可能留下僵尸进程。

### 面试追问链

<details>
<summary>Q1：为什么超时要杀进程组？</summary>

命令常自行派生进程。只杀直接子进程会留下孤儿进程。

</details>

<details>
<summary>Q2：信号处理函数里能做什么？</summary>

只做置标记这类幂等动作。复杂逻辑放到主循环里处理。

</details>

<details>
<summary>Q3：容器里收不到 SIGTERM 会怎样？</summary>

宽限期后容器被强杀。在跑请求直接失败，可能留下脏数据。

</details>

<details>
<summary>Q4：命令输出很大怎么办？</summary>

落文件或流式读取。整块读进内存容易把服务拖垮。

</details>

### 下一讲衔接

外部进程讲完，本域只差收尾。接着读[并发问题定位](/backend/learn/concurrency/concurrency-debugging)，学怎么用栈与指标判断卡死。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 展示了跨进程任务与优雅退出的完整写法。
