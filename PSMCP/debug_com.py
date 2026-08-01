import sys
import win32com.client
import pythoncom

print("Python version:", sys.version)

progids = [
    "Photoshop.Application",
    "Photoshop.Application.160", # CC 2025 / 2024
    "Photoshop.Application.150",
    "Photoshop.Application.140",
    "Photoshop.Application.130",
    "Photoshop.Application.120",
    "Photoshop.Application.110",
]

for progid in progids:
    print(f"\n--- Testing ProgID: {progid} ---")
    
    # Test GetActiveObject
    try:
        pythoncom.CoInitialize()
        obj = win32com.client.GetActiveObject(progid)
        print(f"[GetActiveObject SUCCESS] {progid}")
        print("  App Name:", getattr(obj, "Name", "N/A"))
        print("  Version:", getattr(obj, "Version", "N/A"))
        print("  Docs Count:", obj.Documents.Count)
        if obj.Documents.Count > 0:
            doc = obj.ActiveDocument
            print(f"  Active Doc: {doc.Name} ({doc.Width}x{doc.Height})")
            print("  Layers:", [l.Name for l in doc.Layers])
        pythoncom.CoUninitialize()
        sys.exit(0)
    except Exception as e:
        print(f"[GetActiveObject FAIL] {e}")

    # Test DispatchEx
    try:
        pythoncom.CoInitialize()
        obj = win32com.client.DispatchEx(progid)
        print(f"[DispatchEx SUCCESS] {progid}")
        print("  App Name:", getattr(obj, "Name", "N/A"))
        print("  Version:", getattr(obj, "Version", "N/A"))
        if hasattr(obj, "Documents"):
            print("  Docs Count:", obj.Documents.Count)
            if obj.Documents.Count > 0:
                doc = obj.ActiveDocument
                print(f"  Active Doc: {doc.Name} ({doc.Width}x{doc.Height})")
                print("  Layers:", [l.Name for l in doc.Layers])
        pythoncom.CoUninitialize()
        sys.exit(0)
    except Exception as e:
        print(f"[DispatchEx FAIL] {e}")
