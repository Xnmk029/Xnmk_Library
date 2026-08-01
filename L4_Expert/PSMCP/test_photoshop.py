import sys
import json
from photoshop_controller import PhotoshopController

def test_controller():
    print("=== Testing Photoshop Controller ===")
    controller = PhotoshopController()
    
    status = controller.get_status()
    print("Photoshop Status:")
    print(json.dumps(status, indent=2, ensure_ascii=False))

    if not status.get("running"):
        print("\nPhotoshop COM status returned false or Photoshop is not open.")
        print("Note: COM automation will launch Photoshop automatically when commands are invoked if Photoshop is installed.")
        return

    print("\nAttempting test JavaScript execution...")
    res = controller.execute_javascript("app.name;")
    print("Result:", res)

if __name__ == "__main__":
    test_controller()
