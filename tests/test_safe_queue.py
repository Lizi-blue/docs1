"""组件自测：进程安全队列（001 T027 / 宪法 VI）。

单一事实源：被测源码直接从组件页的 ```python 代码块提取，不在仓内放第二份实现。
这样测试同时证明「页面里写的源码真的能跑」。

运行：python3 -m pytest tests/ -q
"""
from __future__ import annotations

import re
import sys
import pathlib
import textwrap
import types

import pytest

# 顶层函数：spawn / forkserver 启动方式下必须可 pickle（CI 实测 Python 3.14 默认 forkserver）
def square(value: int) -> int:
    return value * value


def identity(value: int) -> int:
    return value


def boom(value: int) -> int:
    raise RuntimeError(f"boom-{value}")


PAGE = pathlib.Path(__file__).resolve().parents[1] / "docs" / "backend" / "components" / "01-safe-queue.md"


def _semaphores_available() -> bool:
    """探测进程间同步原语是否可用（沙箱会拒绝 sem_open）。"""
    import multiprocessing as mp

    try:
        sem = mp.Semaphore(1)
        sem.acquire()
        sem.release()
        queue = mp.Queue()
        queue.close()
        return True
    except (PermissionError, OSError):
        return False


NEEDS_MP = pytest.mark.skipif(
    not _semaphores_available(),
    reason="本环境禁止创建 POSIX 信号量，跨进程队列无法运行；CI 镜像内会真实执行",
)


def load_component() -> types.ModuleType:
    """从组件页提取核心源码并执行，返回模块对象。"""
    text = PAGE.read_text(encoding="utf-8")
    blocks = re.findall(r"```python\n(.*?)```", text, flags=re.S)
    source = None
    for block in blocks:
        if "class SafeQueue" in block:
            source = block
            break
    assert source is not None, "组件页里找不到 SafeQueue 的核心源码块"
    module = types.ModuleType("safe_queue")
    # dataclass 需要按 __module__ 找到命名空间，先注册再执行
    sys.modules["safe_queue"] = module
    exec(compile(textwrap.dedent(source), str(PAGE), "exec"), module.__dict__)
    return module


@NEEDS_MP
def test_normal_path_returns_results() -> None:
    safe_queue = load_component()
    with safe_queue.SafeQueue(square, workers=2) as queue:
        queue.submit(range(10))
        results = queue.drain(10, timeout=30)
    assert len(results) == 10
    assert all(item.ok for item in results)
    assert sorted(item.value for item in results) == [i * i for i in range(10)]


@NEEDS_MP
def test_child_exception_is_returned_not_lost() -> None:
    safe_queue = load_component()

    def boom(value: int) -> int:
        raise RuntimeError(f"boom-{value}")

    with safe_queue.SafeQueue(boom, workers=1) as queue:
        queue.submit([1])
        results = queue.drain(1, timeout=30)
    assert results[0].ok is False
    assert "boom-1" in (results[0].error or "")
    assert results[0].traceback_text


@NEEDS_MP
def test_sentinel_count_matches_workers() -> None:
    safe_queue = load_component()
    with safe_queue.SafeQueue(identity, workers=3) as queue:
        queue.submit([1, 2, 3])
        results = queue.drain(3, timeout=30)
    assert len(results) == 3
    assert all(item.ok for item in results)


def test_workers_must_be_positive() -> None:
    safe_queue = load_component()
    with pytest.raises(ValueError):
        safe_queue.SafeQueue(identity, workers=0)


def test_worker_functions_are_picklable() -> None:
    """spawn / forkserver 下 target 必须可 pickle，这条断言不依赖进程间原语。"""
    import pickle

    for func in (square, identity, boom):
        assert pickle.loads(pickle.dumps(func)) is func
