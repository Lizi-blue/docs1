"""任务服务的配置与提交校验。

判据来源：specs/003-task-dispatch/spec.md 的 FR-002 与 FR-008/FR-009。
设计要点：白名单只放安全命令；参数拒绝 shell 元字符与控制字符；
工作目录必须落在工作区内。校验失败一律给可读原因。
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

# 参数里禁止出现的元字符：这些字符交给 shell 会改变命令语义
FORBIDDEN_ARG_CHARS = set(";|&$><`\\\"'(){}[]*?!~\n\r")
CONTROL_CHAR = re.compile(r"[\x00-\x1f\x7f]")
ENV_KEY = re.compile(r"^[A-Z_][A-Z0-9_]{0,63}$")

DEFAULT_CONFIG = Path(__file__).with_name("config.json")


class ValidationError(ValueError):
    """提交体不合法。message 会原样返回给调用方。"""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class AllowItem:
    name: str
    desc: str
    example: str


class Allowlist:
    """命令白名单与参数校验。

    对象职责：判断命令是否放行，校验参数与环境变量的形态。
    对象边界：不管并发、超时与工作区，那些属于 Limits。
    被谁持有：Limits 持有唯一实例。
    """

    def __init__(self, items: dict[str, "AllowItem"], env_keys: list[str],
                 args_max: int, arg_len_max: int) -> None:
        self.items = items
        self.env_keys = env_keys
        self.args_max = args_max
        self.arg_len_max = arg_len_max

    def names(self) -> list[str]:
        return sorted(self.items)

    def get(self, name: str) -> "AllowItem | None":
        return self.items.get(name)

    def validate_command(self, payload: dict) -> str:
        command = payload.get("command")
        if not isinstance(command, str) or not command:
            raise ValidationError("缺少 command 字段")
        if command not in self.items:
            raise ValidationError(f"命令不在白名单内：{command}")
        return command

    def validate_args(self, raw_args: object) -> list[str]:
        if raw_args is None:
            raw_args = []
        if not isinstance(raw_args, list):
            raise ValidationError("args 必须是字符串数组")
        if len(raw_args) > self.args_max:
            raise ValidationError(f"参数个数超过上限 {self.args_max}")
        args: list[str] = []
        for item in raw_args:
            if not isinstance(item, str):
                raise ValidationError("args 里每一项都必须是字符串")
            if len(item) > self.arg_len_max:
                raise ValidationError(f"单个参数长度超过上限 {self.arg_len_max}")
            if CONTROL_CHAR.search(item):
                raise ValidationError("参数包含控制字符")
            hit = FORBIDDEN_ARG_CHARS.intersection(item)
            if hit:
                raise ValidationError(f"参数包含被禁止的字符：{''.join(sorted(hit))}")
            args.append(item)
        return args

    def validate_env(self, raw_env: object) -> dict[str, str]:
        env: dict[str, str] = {}
        raw_env = raw_env or {}
        if not isinstance(raw_env, dict):
            raise ValidationError("env 必须是对象")
        for key, value in raw_env.items():
            if key not in self.env_keys:
                raise ValidationError(f"env 键不在白名单内：{key}")
            if not isinstance(value, str) or CONTROL_CHAR.search(value):
                raise ValidationError(f"env[{key}] 必须是可读字符串")
            env[key] = value
        return env


class Limits:
    """从配置文件加载限额、白名单与工作区，支持环境变量覆盖。"""

    def __init__(self, config_path: str | os.PathLike[str] | None = None) -> None:
        path = Path(config_path or os.environ.get("DOCS1_SERVICE_CONFIG") or DEFAULT_CONFIG)
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.version: str = raw.get("version", "0.0.0")
        allow_items: dict[str, AllowItem] = {
            name: AllowItem(name, item.get("desc", ""), item.get("example", ""))
            for name, item in raw.get("allowlist", {}).items()
        }
        limits = dict(raw.get("limits", {}))
        self.allowlist = Allowlist(
            allow_items,
            list(raw.get("env_allowlist", ["LC_ALL", "LANG", "TZ"])),
            int(limits.get("args_max", 32)),
            int(limits.get("arg_len_max", 256)),
        )
        self.max_concurrency = int(os.environ.get("DOCS1_MAX_CONCURRENCY", limits.get("max_concurrency", 4)))
        self.timeout_max_s = int(os.environ.get("DOCS1_TIMEOUT_MAX_S", limits.get("timeout_max_s", 300)))
        self.output_max_bytes = int(os.environ.get("DOCS1_OUTPUT_MAX_BYTES", limits.get("output_max_bytes", 1 << 20)))
        self.keep = int(os.environ.get("DOCS1_KEEP", limits.get("keep", 50)))
        self.workspace = Path(
            os.environ.get("DOCS1_WORKSPACE") or raw.get("workspace", "/var/lib/docs1-tasks")
        ).resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)

    # ---- 对外快照 ----
    def public(self) -> dict:
        return {
            "version": self.version,
            "max_concurrency": self.max_concurrency,
            "timeout_max_s": self.timeout_max_s,
            "output_max_bytes": self.output_max_bytes,
            "keep": self.keep,
            "allowlist": [
                {"name": self.allowlist.get(name).name,
                 "desc": self.allowlist.get(name).desc,
                 "example": self.allowlist.get(name).example}
                for name in self.allowlist.names()
            ],
        }

    # ---- 提交校验 ----
    def validate_submit(self, payload: object) -> dict:
        if not isinstance(payload, dict):
            raise ValidationError("提交体必须是 JSON 对象")
        command = self.allowlist.validate_command(payload)
        args = self.allowlist.validate_args(payload.get("args", []))

        timeout_s = payload.get("timeout_s")
        if timeout_s is None:
            timeout_s = min(60, self.timeout_max_s)
        if isinstance(timeout_s, bool) or not isinstance(timeout_s, (int, float)):
            raise ValidationError("timeout_s 必须是数字")
        if timeout_s <= 0 or timeout_s > self.timeout_max_s:
            raise ValidationError(f"timeout_s 必须在 0 到 {self.timeout_max_s} 之间")

        cwd = self.resolve_cwd(payload.get("cwd"))

        env = self.allowlist.validate_env(payload.get("env"))

        return {"command": command, "args": args, "cwd": str(cwd), "timeout_s": float(timeout_s), "env": env}

    def resolve_cwd(self, raw_cwd: object) -> Path:
        """工作目录必须落在工作区内，越界即拒。"""
        if raw_cwd in (None, "", "workspace"):
            return self.workspace
        if not isinstance(raw_cwd, str):
            raise ValidationError("cwd 必须是字符串")
        if CONTROL_CHAR.search(raw_cwd) or "\x00" in raw_cwd:
            raise ValidationError("cwd 包含控制字符")
        candidate = (self.workspace / raw_cwd).resolve() if not os.path.isabs(raw_cwd) else Path(raw_cwd).resolve()
        try:
            candidate.relative_to(self.workspace)
        except ValueError as error:
            raise ValidationError("cwd 越出工作区") from error
        if not candidate.is_dir():
            raise ValidationError(f"cwd 不存在：{candidate}")
        return candidate
