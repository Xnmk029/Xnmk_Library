(function() {
    var info = {};
    if (app.documents.length === 0) {
        info = { status: "no_documents", message: "Photoshop is open, but no documents are currently open." };
    } else {
        var doc = app.activeDocument;
        var layerNames = [];
        for (var i = 0; i < doc.layers.length; i++) {
            layerNames.push(doc.layers[i].name);
        }
        info = {
            status: "success",
            doc_name: doc.name,
            width: doc.width.value,
            height: doc.height.value,
            resolution: doc.resolution,
            mode: doc.mode.toString(),
            layers: layerNames
        };
    }
    
    var file = new File("g:/产品/新benchmark/PSMCP/ps_info.json");
    file.open("w");
    file.write(JSON.stringify(info));
    file.close();
})();
