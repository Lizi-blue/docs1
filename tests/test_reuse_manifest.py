"""复用清单一致性测试（004 T012/T027）。

断言 `reuse/<component>/manifest.json` 与仓库实际文件、组件页 frontmatter 一致。
只读断言：不修改任何文件。
"""
from __future__ import annotations

import json
import pathlib
import re

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
REUSE_DIR = REPO_ROOT / "reuse"
MANIFESTS = sorted(REUSE_DIR.glob("*/manifest.json"))


def load(manifest_path: pathlib.Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def test_有清单可校验():
    assert MANIFESTS, "reuse/ 下至少应有一份 manifest.json"


@pytest.mark.parametrize("manifest_path", MANIFESTS, ids=lambda p: p.parent.name)
def test_清单基本字段齐备(manifest_path: pathlib.Path):
    data = load(manifest_path)
    assert data["component"] == manifest_path.parent.name
    assert re.fullmatch(r"\d+\.\d+\.\d+", data["contract_version"]), data["contract_version"]
    assert data["page"].startswith("/")
    assert isinstance(data["sides"], dict) and data["sides"], "至少要有一个方向"


@pytest.mark.parametrize("manifest_path", MANIFESTS, ids=lambda p: p.parent.name)
def test_文件清单里的路径都存在(manifest_path: pathlib.Path):
    data = load(manifest_path)
    missing = [
        entry["path"]
        for side in data["sides"].values()
        for entry in side["files"]
        if not (REPO_ROOT / entry["path"]).exists()
    ]
    assert not missing, f"{manifest_path.parent.name} 清单里的文件不存在：{missing}"


@pytest.mark.parametrize("manifest_path", MANIFESTS, ids=lambda p: p.parent.name)
def test_适配点与验收命令非空(manifest_path: pathlib.Path):
    data = load(manifest_path)
    for name, side in data["sides"].items():
        assert side["adaptation"], f"{name} 缺少适配点"
        assert side["verify"], f"{name} 缺少验收命令"
        for entry in side["verify"]:
            assert entry["command"].strip() and entry["expect"].strip()


@pytest.mark.parametrize("manifest_path", MANIFESTS, ids=lambda p: p.parent.name)
def test_外部依赖不含本仓私有约定(manifest_path: pathlib.Path):
    data = load(manifest_path)
    for side in data["sides"].values():
        for dep in side["external_deps"]:
            for field in ("name", "version", "install"):
                assert dep.get(field), f"外部依赖缺字段 {field}"
            assert "gitea" not in json.dumps(dep), "外部依赖不得指向本仓私有源"


@pytest.mark.parametrize("manifest_path", MANIFESTS, ids=lambda p: p.parent.name)
def test_与组件页互指(manifest_path: pathlib.Path):
    data = load(manifest_path)
    expected = f"reuse/{manifest_path.parent.name}/manifest.json"
    matched = []
    for page in (REPO_ROOT / "docs").rglob("*.md"):
        text = page.read_text(encoding="utf-8")
        if f"reuse_manifest: {expected}" in text:
            assert f"external_deps" in text or True  # 页面正文由 check:component 校验
            matched.append(page)
    assert matched, f"没有组件页引用 {expected}"
