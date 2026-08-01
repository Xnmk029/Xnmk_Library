"""
SketchUp-MCP-Bridge — MCP Server (Python)
==========================================
标准 MCP Server, 向 LLM 暴露 SketchUp 操作工具。
通过 HTTP 与 SketchUp 内部的 Ruby Bridge 通信。

运行方式:
    python server.py                  # 默认 stdio 传输
    python server.py --port 18234     # 指定 Ruby Bridge 端口

依赖:
    pip install mcp httpx
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ─────────────────────────────────────────────
# 配置
# ─────────────────────────────────────────────
RUBY_BRIDGE_HOST = "127.0.0.1"
RUBY_BRIDGE_PORT = 18234
REQUEST_TIMEOUT = 35.0  # 秒, 略大于 Ruby 端 30s 超时

# ─────────────────────────────────────────────
# MCP Server 实例
# ─────────────────────────────────────────────
mcp = FastMCP(
    "SketchUp-MCP-Bridge",
    instructions="Real-time bridge to a running SketchUp instance via local HTTP.",
)


# ─────────────────────────────────────────────
# 通信层: 向 Ruby Bridge 发送请求
# ─────────────────────────────────────────────
def _bridge_url() -> str:
    return f"http://{RUBY_BRIDGE_HOST}:{RUBY_BRIDGE_PORT}/execute"


def call_sketchup(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    向 SketchUp Ruby Bridge 发送指令并返回解析后的 JSON 响应。
    所有网络/解析异常统一转为 MCP 可读错误。
    """
    payload = {"action": action, "params": params or {}}

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            resp = client.post(
                _bridge_url(),
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except httpx.ConnectError:
        return {
            "success": False,
            "error": (
                f"Cannot connect to SketchUp MCP Bridge at {RUBY_BRIDGE_HOST}:{RUBY_BRIDGE_PORT}. "
                "Please ensure SketchUp is running and the MCP Bridge plugin is active "
                "(Plugins > MCP Bridge > Start Server)."
            ),
        }
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": f"Request to SketchUp timed out after {REQUEST_TIMEOUT}s. "
            "The model operation may be too heavy or SketchUp is unresponsive.",
        }
    except Exception as e:
        return {"success": False, "error": f"Unexpected communication error: {e}"}

    # 解析响应
    if resp.status_code != 200:
        try:
            body = resp.json()
            err_msg = body.get("error", resp.text)
        except Exception:
            err_msg = resp.text
        return {"success": False, "error": f"Bridge HTTP {resp.status_code}: {err_msg}"}

    try:
        return resp.json()
    except json.JSONDecodeError:
        return {"success": False, "error": f"Invalid JSON from bridge: {resp.text[:200]}"}


def format_result(result: dict[str, Any]) -> str:
    """将 bridge 响应格式化为 LLM 友好的文本。"""
    if result.get("success"):
        data = result.get("data", {})
        return json.dumps(data, indent=2, ensure_ascii=False)
    else:
        return f"[ERROR] {result.get('error', 'Unknown error')}"


# ─────────────────────────────────────────────
# Tool 1: 获取模型信息
# ─────────────────────────────────────────────
@mcp.tool()
def su_get_model_info() -> str:
    """Get information about the currently open SketchUp model.

    Returns: file name/path, measurement unit, entity counts (groups,
    component instances, faces, edges), current selection overview,
    layer count, and scene/page count.

    Use this tool first to understand the model context before performing
    any queries or modifications.
    """
    result = call_sketchup("get_model_info")
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 2: 查询包围盒尺寸
# ─────────────────────────────────────────────
@mcp.tool()
def su_query_dimensions(name: str) -> str:
    """Query the bounding box dimensions of a group or component instance.

    Args:
        name: The name of the group/component, or its numeric entity ID.
              For component instances, matches either the instance name
              or the definition name.

    Returns: entity type, ID, name, and bounding box with min/max corners,
    width (X), depth (Y), height (Z), and diagonal length.
    All lengths are in the model's internal unit (inches).
    """
    result = call_sketchup("query_dimensions", {"name": name})
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 3: 创建几何体
# ─────────────────────────────────────────────
@mcp.tool()
def su_create_geometry(
    width: float = 10.0,
    depth: float = 10.0,
    height: float = 10.0,
    origin_x: float = 0.0,
    origin_y: float = 0.0,
    origin_z: float = 0.0,
    name: str = "MCP_Box",
) -> str:
    """Create a box (cuboid/wall) at the specified position and group it.

    Creates a rectangular solid by drawing a base rectangle and push-pulling
    it to the given height. The result is automatically wrapped in a Group.

    Args:
        width:    X-axis size in inches (default 10).
        depth:    Y-axis size in inches (default 10).
        height:   Z-axis extrusion height in inches (default 10).
        origin_x: X coordinate of the base corner (default 0).
        origin_y: Y coordinate of the base corner (default 0).
        origin_z: Z coordinate of the base corner (default 0).
        name:     Name assigned to the created group (default "MCP_Box").

    Returns: the created group's entity ID, name, dimensions, and bounding box.
    The operation is wrapped in a SketchUp undo transaction.
    """
    params = {
        "width": width,
        "depth": depth,
        "height": height,
        "origin": {"x": origin_x, "y": origin_y, "z": origin_z},
        "name": name,
    }
    result = call_sketchup("create_geometry", params)
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 4: 设置相机视角
# ─────────────────────────────────────────────
@mcp.tool()
def su_set_camera_view(
    eye_x: float,
    eye_y: float,
    eye_z: float,
    target_x: float,
    target_y: float,
    target_z: float,
    up_x: float = 0.0,
    up_y: float = 0.0,
    up_z: float = 1.0,
) -> str:
    """Set the active camera view in SketchUp by specifying eye and target points.

    Positions the perspective camera at the 'eye' point looking toward the
    'target' point, with the given 'up' vector. Useful for pre-setting
    render viewpoints or inspecting geometry from a specific angle.

    Args:
        eye_x, eye_y, eye_z:       Camera position (inches).
        target_x, target_y, target_z: Look-at target point (inches).
        up_x, up_y, up_z:          Camera up vector (default Z-up: 0,0,1).

    Returns: the applied camera parameters (eye, target, up, perspective mode).
    """
    params = {
        "eye": {"x": eye_x, "y": eye_y, "z": eye_z},
        "target": {"x": target_x, "y": target_y, "z": target_z},
        "up": {"x": up_x, "y": up_y, "z": up_z},
    }
    result = call_sketchup("set_camera_view", params)
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 5: 添加尺寸标注线
# ─────────────────────────────────────────────
@mcp.tool()
def su_add_dimension(
    point1_x: float,
    point1_y: float,
    point1_z: float,
    point2_x: float,
    point2_y: float,
    point2_z: float,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 1.0,
    text: str = "",
) -> str:
    """Add an engineering-style linear dimension line between two 3D points.

    Creates a DimensionLinear entity in SketchUp that displays the measured
    distance between point1 and point2, with the dimension line offset in
    the direction of the offset vector (controls which side the annotation
    appears on and how far from the measured edge).

    Args:
        point1_x, point1_y, point1_z: Start point of the measurement (inches).
        point2_x, point2_y, point2_z: End point of the measurement (inches).
        offset_x, offset_y, offset_z: Offset vector direction for the dimension
            line placement (default Z-up: 0,0,1). The dimension line will be
            pushed in this direction away from the measured segment.
        text: Optional custom text override for the dimension label.
            If empty, SketchUp auto-displays the measured length.

    Returns: entity ID, both points, offset vector, measured length, and
    displayed text. The operation is wrapped in a SketchUp undo transaction.
    """
    params = {
        "point1": {"x": point1_x, "y": point1_y, "z": point1_z},
        "point2": {"x": point2_x, "y": point2_y, "z": point2_z},
        "offset_vector": {"x": offset_x, "y": offset_y, "z": offset_z},
        "text": text,
    }
    result = call_sketchup("add_dimension", params)
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 6: 批量标注组件内所有子实体
# ─────────────────────────────────────────────
@mcp.tool()
def su_annotate_component(
    name: str,
    offset: float = 3.0,
) -> str:
    """Batch-annotate every sub-entity inside a named component or group.

    Enters the specified component/group, iterates all child entities
    (groups, component instances, and faces), computes each child's
    world-space bounding box, and adds three engineering-style dimension
    lines per child: width (X), depth (Y), and height (Z). Degenerate
    dimensions (near-zero length) are skipped automatically.

    Use this tool to quickly generate a full dimension-annotation pass
    over an assembly (e.g. a furniture panel set or a mechanical part).

    Args:
        name: The name of the component/group, or its numeric entity ID.
        offset: Distance (inches) to offset each dimension line away from
            the measured edge (default 3.0). Larger values push annotations
            further from the geometry.

    Returns: number of children annotated, total dimension lines created,
    and per-child detail (name, type, entity ID, and each dimension's axis,
    displayed text, and entity ID). The whole batch is wrapped in a single
    SketchUp undo transaction.
    """
    params = {
        "name": name,
        "offset": offset,
    }
    result = call_sketchup("annotate_component", params)
    return format_result(result)


# ─────────────────────────────────────────────
# Tool 7: 缺角(凹口)检测与标注
# ─────────────────────────────────────────────
@mcp.tool()
def su_annotate_notches(
    name: str,
    offset: float = 1.5,
) -> str:
    """Detect and dimension the notches (cut-outs) on boards inside a component.

    For each board (child group/component) inside the named component, this
    tool inspects the top-face outline. A plain rectangle (4 vertices) has no
    notch and is skipped. For L-shaped or stepped outlines, the edges that do
    NOT lie on the outline's bounding box are the notch edges; a dimension
    line is added along each such edge, offset into the notch cavity so the
    reading stays clear of the solid material.

    Use this after su_annotate_component when the parts include notched or
    L-shaped panels and the notch width/depth must be called out explicitly.

    Args:
        name: The name of the component/group, or its numeric entity ID.
        offset: Distance (inches) to push each notch dimension line into the
            notch cavity (default 1.5).

    Returns: number of boards that have notches, total notch dimension lines
    created, and per-board detail (name, outline vertex count, and each notch
    dimension's displayed text and entity ID). Wrapped in a single undo
    transaction.
    """
    params = {
        "name": name,
        "offset": offset,
    }
    result = call_sketchup("annotate_notches", params)
    return format_result(result)


# ─────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────
def main():
    global RUBY_BRIDGE_PORT

    parser = argparse.ArgumentParser(description="SketchUp MCP Bridge Server")
    parser.add_argument(
        "--bridge-port",
        type=int,
        default=18234,
        help="Port of the Ruby HTTP bridge inside SketchUp (default: 18234)",
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="MCP transport mode (default: stdio)",
    )
    args = parser.parse_args()

    RUBY_BRIDGE_PORT = args.bridge_port

    # 启动前做一次连通性提示 (非阻塞)
    print(
        f"[SketchUp-MCP-Bridge] Targeting Ruby bridge at "
        f"{RUBY_BRIDGE_HOST}:{RUBY_BRIDGE_PORT}",
        file=sys.stderr,
    )

    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
