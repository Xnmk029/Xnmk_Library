import os
import sys
import tempfile
import win32com.client
from typing import Dict, Any, List, Optional

class PhotoshopController:
    """
    Controller for interacting with Adobe Photoshop via Windows COM and ExtendScript.
    """
    def __init__(self):
        self._app = None

    def get_app(self):
        """
        Retrieves or initializes the Photoshop Application COM object.
        """
        try:
            # Try connecting to active or launching Photoshop
            self._app = win32com.client.Dispatch("Photoshop.Application")
            return self._app
        except Exception as e:
            raise RuntimeError(f"Unable to connect to Adobe Photoshop via COM: {str(e)}")

    def is_running(self) -> bool:
        try:
            app = self.get_app()
            _ = app.Name
            return True
        except Exception:
            return False

    def get_status(self) -> Dict[str, Any]:
        """
        Get current Photoshop application status.
        """
        try:
            app = self.get_app()
            docs_count = len(app.Documents) if hasattr(app, 'Documents') else 0
            active_doc_name = None
            if docs_count > 0:
                try:
                    active_doc_name = app.ActiveDocument.Name
                except Exception:
                    active_doc_name = None

            return {
                "running": True,
                "app_name": getattr(app, "Name", "Adobe Photoshop"),
                "version": getattr(app, "Version", "Unknown"),
                "open_documents_count": docs_count,
                "active_document": active_doc_name
            }
        except Exception as e:
            return {
                "running": False,
                "error": str(e)
            }

    def execute_javascript(self, js_code: str) -> Dict[str, Any]:
        """
        Executes arbitrary ExtendScript / JavaScript inside Photoshop.
        """
        try:
            app = self.get_app()
            result = app.doJavaScript(js_code)
            return {
                "success": True,
                "result": str(result) if result is not None else "OK"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def create_document(
        self,
        width: int = 1920,
        height: int = 1080,
        resolution: int = 72,
        name: str = "Untitled-1",
        color_mode: str = "RGB",
        fill: str = "white"
    ) -> Dict[str, Any]:
        """
        Create a new document.
        """
        # We can use ExtendScript for clean document creation without unit preference issues
        fill_mode = "NewDocumentFill.WHITE"
        if fill.lower() == "transparent":
            fill_mode = "NewDocumentFill.TRANSPARENT"
        elif fill.lower() == "background":
            fill_mode = "NewDocumentFill.BACKGROUNDCOLOR"

        js = f"""
        (function() {{
            var origUnits = app.preferences.rulerUnits;
            app.preferences.rulerUnits = Units.PIXELS;
            var docRef = app.documents.add({width}, {height}, {resolution}, "{name}", NewDocumentMode.RGB, {fill_mode});
            app.preferences.rulerUnits = origUnits;
            return docRef.name;
        }})();
        """
        res = self.execute_javascript(js)
        if res["success"]:
            return {"success": True, "message": f"Created document '{res['result']}' ({width}x{height} px)", "doc_name": res['result']}
        return res

    def open_document(self, file_path: str) -> Dict[str, Any]:
        """
        Opens an image or PSD file in Photoshop.
        """
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            return {"success": False, "error": f"File not found: {abs_path}"}
        
        escaped_path = abs_path.replace("\\", "/")
        js = f"""
        (function() {{
            var fileRef = new File("{escaped_path}");
            var doc = app.open(fileRef);
            return doc.name;
        }})();
        """
        res = self.execute_javascript(js)
        if res["success"]:
            return {"success": True, "message": f"Opened document '{res['result']}'", "doc_name": res['result']}
        return res

    def save_document(self, file_path: str, format_type: str = "PSD") -> Dict[str, Any]:
        """
        Saves active document to PSD, PNG, JPEG, etc.
        """
        abs_path = os.path.abspath(file_path)
        dir_name = os.path.dirname(abs_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
            
        escaped_path = abs_path.replace("\\", "/")
        fmt = format_type.upper()

        if fmt == "PSD":
            js = f"""
            (function() {{
                var file = new File("{escaped_path}");
                var options = new PhotoshopSaveOptions();
                app.activeDocument.saveAs(file, options, true);
                return "Saved as PSD: " + file.fsName;
            }})();
            """
        elif fmt in ("PNG", "PNG24", "PNG8"):
            js = f"""
            (function() {{
                var file = new File("{escaped_path}");
                var options = new ExportOptionsSaveForWeb();
                options.format = SaveDocumentType.PNG;
                options.PNG8 = false;
                options.transparency = true;
                app.activeDocument.exportDocument(file, ExportType.SAVEFORWEB, options);
                return "Exported PNG: " + file.fsName;
            }})();
            """
        elif fmt in ("JPG", "JPEG"):
            js = f"""
            (function() {{
                var file = new File("{escaped_path}");
                var options = new ExportOptionsSaveForWeb();
                options.format = SaveDocumentType.JPEG;
                options.quality = 85;
                app.activeDocument.exportDocument(file, ExportType.SAVEFORWEB, options);
                return "Exported JPEG: " + file.fsName;
            }})();
            """
        else:
            return {"success": False, "error": f"Unsupported export format: {format_type}. Use PSD, PNG, or JPG."}

        return self.execute_javascript(js)

    def get_active_document_info(self) -> Dict[str, Any]:
        """
        Retrieves detailed metadata, dimensions, and layer tree of active document.
        """
        js = """
        (function() {
            if (app.documents.length === 0) {
                return JSON.stringify({ error: "No active document open." });
            }
            var doc = app.activeDocument;
            
            function getLayersInfo(container) {
                var layers = [];
                for (var i = 0; i < container.layers.length; i++) {
                    var l = container.layers[i];
                    var item = {
                        name: l.name,
                        typename: l.typename,
                        visible: l.visible,
                        opacity: l.opacity
                    };
                    if (l.typename === "LayerSet") {
                        item.children = getLayersInfo(l);
                    }
                    layers.push(item);
                }
                return layers;
            }

            var info = {
                name: doc.name,
                width: doc.width.value,
                height: doc.height.value,
                resolution: doc.resolution,
                mode: doc.mode.toString(),
                activeLayer: doc.activeLayer ? doc.activeLayer.name : null,
                layers: getLayersInfo(doc)
            };

            return JSON.stringify(info);
        })();
        """
        res = self.execute_javascript(js)
        if not res["success"]:
            return res
        try:
            import json
            data = json.loads(res["result"])
            return {"success": True, "data": data}
        except Exception as e:
            return {"success": False, "raw_result": res["result"], "parse_error": str(e)}

    def add_art_layer(self, name: str = "New Layer") -> Dict[str, Any]:
        """
        Adds a new pixel art layer.
        """
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.artLayers.add();
            layer.name = "{name}";
            return layer.name;
        }})();
        """
        return self.execute_javascript(js)

    def add_layer_set(self, name: str = "New Group") -> Dict[str, Any]:
        """
        Adds a new layer folder (LayerSet).
        """
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var group = doc.layerSets.add();
            group.name = "{name}";
            return group.name;
        }})();
        """
        return self.execute_javascript(js)

    def add_text_layer(
        self,
        text: str,
        font_name: str = "ArialMT",
        font_size: float = 24.0,
        color_hex: str = "000000",
        x: float = 100.0,
        y: float = 100.0,
        alignment: str = "LEFT"
    ) -> Dict[str, Any]:
        """
        Adds a text layer to the active document.
        """
        clean_hex = color_hex.lstrip("#")
        if len(clean_hex) == 3:
            clean_hex = "".join([c*2 for c in clean_hex])
        r = int(clean_hex[0:2], 16) if len(clean_hex) >= 2 else 0
        g = int(clean_hex[2:4], 16) if len(clean_hex) >= 4 else 0
        b = int(clean_hex[4:6], 16) if len(clean_hex) >= 6 else 0

        align_const = "Justification.LEFT"
        if alignment.upper() == "CENTER":
            align_const = "Justification.CENTER"
        elif alignment.upper() == "RIGHT":
            align_const = "Justification.RIGHT"

        escaped_text = text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.artLayers.add();
            layer.kind = LayerKind.TEXT;
            var textItem = layer.textItem;
            textItem.contents = "{escaped_text}";
            textItem.size = {font_size};
            textItem.justification = {align_const};
            
            try {{
                textItem.font = "{font_name}";
            }} catch(e) {{
                // fallback if font name not found
            }}

            var textColor = new SolidColor();
            textColor.rgb.red = {r};
            textColor.rgb.green = {g};
            textColor.rgb.blue = {b};
            textItem.color = textColor;

            textItem.position = [{x}, {y}];
            return layer.name;
        }})();
        """
        return self.execute_javascript(js)

    def fill_active_layer(self, color_hex: str = "FF0000") -> Dict[str, Any]:
        """
        Fills active layer with specified hex color.
        """
        clean_hex = color_hex.lstrip("#")
        if len(clean_hex) == 3:
            clean_hex = "".join([c*2 for c in clean_hex])
        r = int(clean_hex[0:2], 16) if len(clean_hex) >= 2 else 0
        g = int(clean_hex[2:4], 16) if len(clean_hex) >= 4 else 0
        b = int(clean_hex[4:6], 16) if len(clean_hex) >= 6 else 0

        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var color = new SolidColor();
            color.rgb.red = {r};
            color.rgb.green = {g};
            color.rgb.blue = {b};
            doc.selection.selectAll();
            doc.selection.fill(color);
            doc.selection.deselect();
            return "Filled with #" + "{clean_hex}";
        }})();
        """
        return self.execute_javascript(js)

    def export_preview(self, output_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Exports quick preview PNG of active document.
        """
        if not output_path:
            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, "ps_preview.png")

        res = self.save_document(output_path, format_type="PNG")
        if res["success"]:
            return {
                "success": True,
                "preview_path": output_path,
                "message": f"Preview exported to {output_path}"
            }
        return res

    def set_layer_visibility(self, layer_name: str, visible: bool) -> Dict[str, Any]:
        """
        Set layer visibility by name.
        """
        js_vis = "true" if visible else "false"
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.layers.getByName("{layer_name}");
            layer.visible = {js_vis};
            return layer.name + " visibility set to " + {js_vis};
        }})();
        """
        return self.execute_javascript(js)

    def set_layer_opacity(self, layer_name: str, opacity: float) -> Dict[str, Any]:
        """
        Set layer opacity (0-100).
        """
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.layers.getByName("{layer_name}");
            layer.opacity = {opacity};
            return layer.name + " opacity set to " + {opacity};
        }})();
        """
        return self.execute_javascript(js)

    def delete_layer(self, layer_name: str) -> Dict[str, Any]:
        """
        Delete layer by name.
        """
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.layers.getByName("{layer_name}");
            layer.remove();
            return "Deleted layer " + "{layer_name}";
        }})();
        """
        return self.execute_javascript(js)

    def duplicate_layer(self, layer_name: str, new_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Duplicate layer.
        """
        new_name_code = f'dup.name = "{new_name}";' if new_name else ""
        js = f"""
        (function() {{
            var doc = app.activeDocument;
            var layer = doc.layers.getByName("{layer_name}");
            var dup = layer.duplicate();
            {new_name_code}
            return dup.name;
        }})();
        """
        return self.execute_javascript(js)
