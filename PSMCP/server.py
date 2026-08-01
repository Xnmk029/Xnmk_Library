import os
import sys
import json
from typing import Optional
from mcp.server.fastmcp import FastMCP
from photoshop_controller import PhotoshopController

# Initialize FastMCP Server for Photoshop
mcp = FastMCP("Photoshop MCP Server")

# Instantiate Photoshop Controller
controller = PhotoshopController()

@mcp.tool()
def ps_get_status() -> str:
    """
    Get the current connection status of Adobe Photoshop, version, open documents count, and active document name.
    """
    status = controller.get_status()
    return json.dumps(status, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_create_document(
    width: int = 1920,
    height: int = 1080,
    resolution: int = 72,
    name: str = "Untitled-1",
    fill: str = "white"
) -> str:
    """
    Create a new document in Photoshop with specified width, height, resolution, name, and fill (white, transparent, background).
    """
    res = controller.create_document(width=width, height=height, resolution=resolution, name=name, fill=fill)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_open_document(file_path: str) -> str:
    """
    Open an existing image file (PSD, PNG, JPG, TIFF, etc.) in Photoshop.
    """
    res = controller.open_document(file_path)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_save_document(file_path: str, format_type: str = "PSD") -> str:
    """
    Save or export the active Photoshop document to file_path. Supported formats: PSD, PNG, JPG.
    """
    res = controller.save_document(file_path=file_path, format_type=format_type)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_get_active_doc_info() -> str:
    """
    Retrieve metadata, dimensions, resolution, active layer, and layer hierarchy tree of the active document.
    """
    res = controller.get_active_document_info()
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_add_art_layer(name: str = "New Layer") -> str:
    """
    Create a new blank pixel layer in the active document.
    """
    res = controller.add_art_layer(name=name)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_add_layer_group(name: str = "New Group") -> str:
    """
    Create a new layer group (folder) in the active document.
    """
    res = controller.add_layer_set(name=name)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_add_text_layer(
    text: str,
    font_name: str = "ArialMT",
    font_size: float = 24.0,
    color_hex: str = "000000",
    x: float = 100.0,
    y: float = 100.0,
    alignment: str = "LEFT"
) -> str:
    """
    Create a styled text layer at coordinates (x, y) with specified text content, font name, font size (pt), color hex, and alignment (LEFT, CENTER, RIGHT).
    """
    res = controller.add_text_layer(
        text=text,
        font_name=font_name,
        font_size=font_size,
        color_hex=color_hex,
        x=x,
        y=y,
        alignment=alignment
    )
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_fill_active_layer(color_hex: str = "FF0000") -> str:
    """
    Fill the currently active layer or selection with a solid hex color (e.g. 'FF0000', '00FF00', '336699').
    """
    res = controller.fill_active_layer(color_hex=color_hex)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_set_layer_visibility(layer_name: str, visible: bool) -> str:
    """
    Show or hide a target layer by name.
    """
    res = controller.set_layer_visibility(layer_name=layer_name, visible=visible)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_set_layer_opacity(layer_name: str, opacity: float) -> str:
    """
    Set opacity (0.0 to 100.0) of a target layer by name.
    """
    res = controller.set_layer_opacity(layer_name=layer_name, opacity=opacity)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_duplicate_layer(layer_name: str, new_name: Optional[str] = None) -> str:
    """
    Duplicate a layer by name, optionally setting a new name for the duplicated layer.
    """
    res = controller.duplicate_layer(layer_name=layer_name, new_name=new_name)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_delete_layer(layer_name: str) -> str:
    """
    Delete a target layer by name.
    """
    res = controller.delete_layer(layer_name=layer_name)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_export_preview(output_path: Optional[str] = None) -> str:
    """
    Export a PNG preview image of the current Photoshop canvas for visual inspection.
    """
    res = controller.export_preview(output_path=output_path)
    return json.dumps(res, indent=2, ensure_ascii=False)

@mcp.tool()
def ps_execute_extendscript(script_code: str) -> str:
    """
    Execute arbitrary ExtendScript (Photoshop JavaScript) code block. Grants full access to Photoshop DOM API & ActionManager.
    """
    res = controller.execute_javascript(js_code=script_code)
    return json.dumps(res, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # Run standard MCP server over stdio
    mcp.run()
