import win32com.client
import winreg

def find_photoshop_progids():
    progids = []
    try:
        key = winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "")
        i = 0
        while True:
            try:
                subkey_name = winreg.EnumKey(key, i)
                if "photoshop.application" in subkey_name.lower():
                    progids.append(subkey_name)
                i += 1
            except OSError:
                break
    except Exception as e:
        print("Registry error:", e)
    return progids

print("Found Photoshop ProgIDs in Registry:", find_photoshop_progids())

progids_to_try = find_photoshop_progids() + ["Photoshop.Application"]
for progid in set(progids_to_try):
    print(f"\n--- Trying ProgID: {progid} ---")
    try:
        app = win32com.client.GetActiveObject(progid)
        print(f"GetActiveObject SUCCESS for {progid}!")
        print("App Name:", getattr(app, 'Name', 'N/A'))
        print("Version:", getattr(app, 'Version', 'N/A'))
        if hasattr(app, 'Documents'):
            print("Open Documents Count:", app.Documents.Count)
            if app.Documents.Count > 0:
                doc = app.ActiveDocument
                print("Active Document Name:", doc.Name)
                print(f"Dimensions: {doc.Width} x {doc.Height}")
                print("Layers:")
                for layer in doc.Layers:
                    print(f"  - {layer.Name} (Visible: {layer.Visible})")
        break
    except Exception as e:
        print(f"GetActiveObject failed for {progid}: {e}")
        try:
            app = win32com.client.Dispatch(progid)
            print(f"Dispatch SUCCESS for {progid}!")
            print("App Name:", getattr(app, 'Name', 'N/A'))
            print("Version:", getattr(app, 'Version', 'N/A'))
            if hasattr(app, 'Documents'):
                print("Open Documents Count:", app.Documents.Count)
                if app.Documents.Count > 0:
                    doc = app.ActiveDocument
                    print("Active Document Name:", doc.Name)
                    print(f"Dimensions: {doc.Width} x {doc.Height}")
                    print("Layers:")
                    for layer in doc.Layers:
                        print(f"  - {layer.Name} (Visible: {layer.Visible})")
            break
        except Exception as e2:
            print(f"Dispatch failed for {progid}: {e2}")
