"""组件自测：进程安全队列（001 T027 / 宪法 VI）。

单一事实源：被测源码直接从组件页的 ```python 代码块提取。
提取后写成临时模块文件并加入 `sys.path`，因为 spawn 与 forkserver
会在子进程里按模块名重新导入。

运行：python3 -m pytest tests/ -q
"""
from __future__ import annotations

import contextlib
import importlib
import pathlib
import re
import sys
import tempfile
import textwrap
import types
from collections.abc import Iterator

import pytest

PAGE = pathlib.Path(__file__).resolve().parents[1] / "docs" / "backend" / "components" / "01-safe-queue.md"


# 顶层函数：spawn 与 forkserver 下 target 必须可 pickle（Python 3.14 起 Linux 默认 forkserver）
def square(value: int) -> int:
    return value * value


def identity(value: int) -> int:
    return value


def boom(value: int) -> int:
    raise RuntimeError(f"boom-{value}")


def load_component() -> types.ModuleType:
    """把组件页的核心源码落到临时模块文件，返回已导入的模块。"""
    text = PAGE.read_text(encoding="utf-8")
    source = None
    for block in re.findall(r"```python\n(.*?)```", text, flags=re.S):
        if "class SafeQueue" in block:
            source = block
            break
    assert source is not None, "组件页里找不到 SafeQueue 的核心源码块"

    module_dir = pathlib.Path(tempfile.mkdtemp(prefix="safe_queue_mod_"))
    (module_dir / "safe_queue.py").write_text(textwrap.dedent(source), encoding="utf-8")
    if str(module_dir) not in sys.path:
        sys.path.insert(0, str(module_dir))
    return importlib.import_module("safe_queue")


@contextlib.contextmanager
def run_component(func, workers: int) -> Iterator[object]:
    """进入执行器。环境缺少进程间原语时跳过，而不是报失败。"""
    module = load_component()
    try:
        with module.SafeQueue(func, workers) as queue:
            yield queue
    except (PermissionError, OSError) as exc:
        pytest.skip(f"本环境禁止进程间原语（{type(exc).__name__}），CI 镜像内会真实执行")


def test_normal_path_returns_results() -> None:
    with run_component(square, workers=2) as queue:
        queue.submit(range(10))
        results = queue.drain(10, timeout=30)
    assert len(results) == 10
    assert all(item.ok for item in results)
    assert sorted(item.value for item in results) == [i * i for i in range(10)]


def test_child_exception_is_returned_not_lost() -> None:
    with run_component(boom, workers=1) as queue:
        queue.submit([1])
        results = queue.drain(1, timeout=30)
    assert results[0].ok is False
    assert "boom-1" in (results[0].error or "")
    assert results[0].traceback_text


def test_sentinel_count_matches_workers() -> None:
    with run_component(identity, workers=3) as queue:
        queue.submit([1, 2, 3])
        results = queue.drain(3, timeout=30)
    assert len(results) == 3
    assert all(item.ok for item in results)


def test_workers_must_be_positive() -> None:
    module = load_component()
    with pytest.raises(ValueError):
        module.SafeQueue(identity, workers=0)


def test_worker_functions_are_picklable() -> None:
    """spawn 与 forkserver 下 target 必须可 pickle。这条断言不依赖进程间原语。"""
    import pickle

    for func in (square, identity, boom):
        assert pickle.loads(pickle.dumps(func)) is func
