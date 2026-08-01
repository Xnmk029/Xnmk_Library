import sys
import json
import time
import win32com.client
import pythoncom

print("Connecting to Photoshop COM server (LocalServer32)...")
start_time = time.time()

try:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Photoshop.Application")
    elapsed = time.time() - start_time
    print(f"Connected in {elapsed:.2f} seconds!")
    print("App Name:", getattr(app, "Name", "Photoshop"))
    print("App Version:", getattr(app, "Version", "Unknown"))
    
    docs_count = app.Documents.Count
    print("Open Documents Count:", docs_count)
    
    if docs_count > 0:
        active_doc = app.ActiveDocument
        print(f"Active Document: {active_doc.Name}")
        print(f"Canvas Size: {active_doc.Width} x {active_doc.Height} (Resolution: {active_doc.Resolution})")
        print("Layers Count:", active_doc.Layers.Count)
        layers_info = []
        for i in range(1, active_doc.Layers.Count + 1):
            layer = active_doc.Layers.Item(i)
            layers_info.append({"name": layer.Name, "visible": layer.Visible})
            print(f"  - Layer {i}: {layer.Name} (Visible: {layer.Visible})")
    else:
        print("No open document in Photoshop workspace.")
        
except Exception as e:
    print("Connection failed:", e)
finally:
    pythoncom.CoUninitialize()
