import sys
import json
import threading
import win32com.client
import pythoncom

result_container = {}

def inspect_ps():
    pythoncom.CoInitialize()
    try:
        app = win32com.client.Dispatch("Photoshop.Application")
        res = {
            "name": getattr(app, "Name", "Photoshop"),
            "version": getattr(app, "Version", "Unknown"),
            "doc_count": app.Documents.Count if hasattr(app, "Documents") else 0
        }
        if res["doc_count"] > 0:
            doc = app.ActiveDocument
            res["active_doc"] = {
                "name": doc.Name,
                "width": float(doc.Width),
                "height": float(doc.Height),
                "resolution": float(doc.Resolution),
                "layers": [layer.Name for layer in doc.Layers]
            }
        result_container["data"] = res
    except Exception as e:
        result_container["error"] = str(e)
    finally:
        pythoncom.CoUninitialize()

t = threading.Thread(target=inspect_ps)
t.daemon = True
t.start()
t.join(timeout=3.0)

if t.is_alive():
    print(json.dumps({"status": "timeout", "message": "Photoshop COM 接口响应超时（可能正停留在启动页、新建弹窗或等待确认框）"}, ensure_ascii=False))
elif "data" in result_container:
    print(json.dumps({"status": "success", "info": result_container["data"]}, indent=2, ensure_ascii=False))
else:
    print(json.dumps({"status": "error", "error": result_container.get("error")}, ensure_ascii=False))
