// written by DaddelZeit
// DO NOT USE WITHOUT PERMISSION

//console.log("load gaugesScreen");
angular.module('gaugesScreen', [])
.directive('bngMapRenderUncompressed', function () {
  return {
    template: `<svg width="100%" height="100%" class="container"></svg>`,
    scope: {
      map: '<',
      color: '@?',
      width: '@?',
      drivability: '@?'
    },
    replace: true,
    restrict: 'E',
    link: function (scope, element, attrs) {
      "use strict";
      var svg = element[0]
        , mapScale = 1
        , domElems = {}
        , getColor = (rClass) => scope.color || (rClass === 0 ? 'black' : 'white') // if there is a color set use that otherwise use the defaults
        ;

      function getDrivabilityColor(d) {
        if (d <= 0.1) return '#967864'; //'#967864'
        if (d > 0.1 && d < 0.9) return '#969678'; //'#969678'
        return '#CCCCCC'; //orig '#DCDCDC', changed as too bright '#CCCCCC'
      }

      function isEmpty (obj) {
        return Object.keys(obj).length === 0;
      }

      function calcRadius (radius) {
        return  Math.min(Math.max(radius, 0), 5) * 3
      }

      scope.$watch('map', function (newVal) {
        if (newVal && !isEmpty(newVal)) {
          setupMap(newVal, angular.element(svg));
        }
      })

      function _createLine(p1, p2, color) {
         return hu('<line>', svg).attr({
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          stroke: color,
          strokeWidth: Math.max(p1.radius, p2.radius),
          strokeLinecap: "round",
        });
      }

      function drawRoads(nodes, drivabilityMin, drivabilityMax) {
        var drawn = {};
        for (var key in nodes) {
          var el = nodes[key];
          // walk the links of the node
          if (el.links !== undefined) { // links
            for (var key2 in el.links) {
              var el2 = nodes[key2];
              var drivability = el.links[key2].drivability;
              if (el2 !== undefined) {
                if (drivability >= drivabilityMin && drivability <= drivabilityMax) {
                  // TODO: can we find a better key here please?
                  drawn[key + '.' + key2 + drivabilityMin + drivabilityMax] = true;
                  if (domElems[key + '.' + key2 + drivabilityMin + drivabilityMax] !== undefined) {
                    domElems[key + '.' + key2 + drivabilityMin + drivabilityMax].remove();
                  }
                  domElems[key + '.' + key2 + drivabilityMin + drivabilityMax] = _createLine({
                    x: el.pos[0] / mapScale,
                    y: -el.pos[1] / mapScale,
                    radius: calcRadius(el.radius)
                  }, {
                      x: el2.pos[0] / mapScale,
                      y: -el2.pos[1] / mapScale,
                      radius: calcRadius(el2.radius)    // prevents massive blobs due to waypoints having larger radius'
                    }, getDrivabilityColor(drivability)
                  );
                }
              }
            }
          }
        }

        // remove all elems that are from previous calls
        for (var key in domElems) {
          if (!drawn[key] && key.endsWith('' + drivabilityMin + drivabilityMax)) {
            domElems[key].remove()
            domElems[key] = undefined; // delete domNode reference and allow for gc
          }
        }
      }

      function setupMap(data) {
        if (data != null) {
          svg.setAttribute('viewBox', data.viewParams.join(' '));

          var minX = -999, maxX = 999;
          var minY = -999, maxY = 999;
          var nodes = data.nodes

          // draw dirt roads and then normal on top
          if (scope.drivability !== 'false') {
            drawRoads(data.nodes, 0, 0.9);
            drawRoads(data.nodes, 0.9, 1);
          } else {
            drawRoads(data.nodes, 0, 1);
          }
        }
      }
    }
  };
})

  .controller('GaugesScreenController', function ($scope, $element, $window) {
    "use strict";
    var vm = this;

    var svg;
    var navContainer = $element[0].children[0].children[0];
    var navDimensions = [];

    var overlays = {};
    var screen = {};
    var zeidio = {};

    var ready = false;

    let settings = {};
    settings.mapState = [false,false];

    var lastIgnitionState = 5
    let state = ""
    let steamSet = false

    // Make sure SVG is loaded
    $scope.onSVGLoaded = function () {
      svg = $element[0].children[1].children[0];

      overlays.boot = hu('#bootscreen', screen.root)
      overlays.block = hu('#block', screen.root)
      overlays.time = hu('#time_text', screen.root)
      zeidio.text = hu('#zeidio_text', screen.root)
      zeidio.phoneName = hu('#phone_name', screen.root)
      zeidio.phoneNameAnim = hu('#phone_name_animated', screen.root)
      zeidio.phoneNameAnim.text("")
      zeidio.tspan = document.getElementById("tspan18565")
      screen.navi = { root: hu('#layer2', screen.root)}
      screen.navi.marker = hu('#navmarker', screen.navi.root)
      screen.navi.marker.css({"transform-origin": "center"})

      screen.pksa = { root: hu('#pksa', screen.root)}
      screen.pksa.sensors = {
        front: [
          [
            hu('#sensor_frr_green', screen.pksa.root),
            hu('#sensor_frr_yellow', screen.pksa.root),
            hu('#sensor_frr_red', screen.pksa.root)
          ],
          [
            hu('#sensor_fr_green', screen.pksa.root),
            hu('#sensor_fr_yellow', screen.pksa.root),
            hu('#sensor_fr_red', screen.pksa.root)
          ],
          [
            hu('#sensor_fl_green', screen.pksa.root),
            hu('#sensor_fl_yellow', screen.pksa.root),
            hu('#sensor_fl_red', screen.pksa.root)
          ],
          [
            hu('#sensor_fll_green', screen.pksa.root),
            hu('#sensor_fll_yellow', screen.pksa.root),
            hu('#sensor_fll_red', screen.pksa.root)
          ],
        ],
        rear: [
          [
            hu('#sensor_rrr_green', screen.pksa.root),
            hu('#sensor_rrr_yellow', screen.pksa.root),
            hu('#sensor_rrr_red', screen.pksa.root)
          ],
          [
            hu('#sensor_rr_green', screen.pksa.root),
            hu('#sensor_rr_yellow', screen.pksa.root),
            hu('#sensor_rr_red', screen.pksa.root)
          ],
          [
            hu('#sensor_rl_green', screen.pksa.root),
            hu('#sensor_rl_yellow', screen.pksa.root),
            hu('#sensor_rl_red', screen.pksa.root)
          ],
          [
            hu('#sensor_rll_green', screen.pksa.root),
            hu('#sensor_rll_yellow', screen.pksa.root),
            hu('#sensor_rll_red', screen.pksa.root)
          ]
        ]
      }

      ready = true;
    }

    // overwriting plain javascript function so we can access from within the controller
    $window.setup = (data) => {
      if(!ready){
        console.log("calling setup while svg not fully loaded");
        setTimeout(function(){ $window.setup(data) }, 100);
        return;
      }
      //console.log("setup",data);
    }

    $window.initMap = (data) => {
      navDimensions = data.viewParams = [
        data.terrainOffset[0],
        data.terrainOffset[1],
        data.terrainSize[0],
        data.terrainSize[1]
      ];

      if (data.minimapImage && data.terrainOffset && data.terrainSize) {
        navContainer.style.backgroundSize = "100%"
        navContainer.style.backgroundImage = "url('/" + data.minimapImage + "')"

        //var bgImage = hu('<image>', svg).attr({
        //  'x': data.terrainOffset[0],
        //  'y': data.terrainOffset[1],
        //  'width': data.terrainSize[0],
        //  'height': data.terrainSize[1],
        //  'transform': "scale(-1,-1)",
        //  'xlink:href': "/" + data.minimapImage,
        //}).prependTo(svg)

      }

      $scope.$apply(() => {
        vm.mapData = data;
      });

      navContainer.style.width = data.terrainSize[0] + "px";
      navContainer.style.height = data.terrainSize[1] + "px";
    }

    $window.updateMap = (data) => {
      if (screen.navi !== undefined) {
        var focusX = -data.x;
        var focusY = data.y;
        var origin = `${((navDimensions[0] * -1)) - focusX}px ${((navDimensions[1] * -1)) - focusY}px`;
        navContainer.style.transformOrigin = origin;
        var translateX = (navDimensions[0] + 512 + focusX);
        var translateY = (navDimensions[1] + 256 + focusY);
        navContainer.style.transform = `translate3d(${translateX}px,${translateY}px, 0px) rotateX(${settings.mapState[0]==true?70:0}deg) rotateZ(${settings.mapState[1]==false?(180 + (data.rotation + 360)):0}deg) scale(1.5)`;
        screen.navi.marker.css({'transform': `rotateX(${settings.mapState[0]==true?50:0}deg) rotateZ(${settings.mapState[1]==true?(180 + (-data.rotation + 360)):0}deg)`});
      }
    }

    function fixClock(v, fill="0"){
      return (v<10)? fill+v : v;
    }

    $window.zeidioSongChanged = (data) => {
      let songData = data[0]
      let text = ""
      if (songData.name === "empty") {
        zeidio.text.text("NO SONG SELECTED")
      } else {
        text = songData.artist + " - " + songData.name
        zeidio.text.text(text)
      }

      if (text.length > 20) {
        zeidio.text.css({"animation": "marquee 10s linear infinite"})
      } else {
        zeidio.text.css({"animation": "marquee 0s linear infinite"})
      }
    }

    $window.zeidioTimeChanged = (data) => {}
    $window.zeidioPlayPauseChanged = (data) => {}
    $window.screenEnableZeidio = (data) => {}
    $window.updateMarketInfo = (data) => {}

    $window.screenStateUpdate = (data) => {
      state = data[0]
      for (var key in screen) {
        screen[key].root.css({"display": data[0]===key?"inline":"none"})
      }
    }

    $window.execFunc = (data) => {
      var func = new Function("return "+data[0])();
      func(settings)
    }

    $window.updateData = (data) => {
      if (data) {
        if(!ready){console.log("not ready");return;}

        if (data.electrics.ignitionLevel != lastIgnitionState) {
          if (data.electrics.ignitionLevel === 0) {
            overlays.block.css({"opacity": "1"})
          } else if (data.electrics.ignitionLevel === 1) {
            overlays.boot.n.style.transition = ""
            overlays.boot.css({"opacity": "1"})
            overlays.block.css({"opacity": "0"})
          } else {
            overlays.boot.n.style.transition = "opacity 2s ease-in 1.5s"
            overlays.boot.css({"opacity": "0"})
            overlays.block.css({"opacity": "0"})
          }
          lastIgnitionState = data.electrics.ignitionLevel
        }

        if (data.customModules.zeitRadio.steamData !== undefined && steamSet === false) {
          let connectText = "'"+data.customModules.zeitRadio.steamData.name+"'s Phone' Connected"
          if (connectText.length > 25) {
            zeidio.phoneName.text("")
            zeidio.phoneNameAnim.text(connectText)
            zeidio.phoneNameAnim.css({"animation": "marquee 10s linear infinite"})
          } else {
            zeidio.phoneNameAnim.text("")
            zeidio.phoneName.text(connectText)
            zeidio.phoneName.css({"animation": "marquee 0s linear infinite"})
          }
          steamSet = true
        }

        let current_time = new Date(Date.now());
        overlays.time.text(fixClock(current_time.getHours()) + ":" + fixClock(current_time.getMinutes()));

        if (state === "pksa") {
          let hits = data.electrics.parkingSensorHits.frontBumper.reverse()
          for (let i = 0; i < hits.length; i+=(hits.length/4)) {
            let dist = Math.min(hits[i], hits[i+1], hits[i+2])
            let index = i/(hits.length/4)
            screen.pksa.sensors.front[index][0].css({"fill": dist<1.5?"#00ff00ff":"#202020ff"})
            screen.pksa.sensors.front[index][1].css({"fill": dist<0.9?"#ffff00ff":"#202020ff"})
            screen.pksa.sensors.front[index][2].css({"fill": dist<0.4?"#ff0000ff":"#202020ff"})
          }

          hits = data.electrics.parkingSensorHits.rearBumper
          for (let i = 0; i < hits.length; i+=(hits.length/4)) {
            let dist = Math.min(hits[i], hits[i+1], hits[i+2])
            let index = i/(hits.length/4)
            screen.pksa.sensors.rear[index][0].css({"fill": dist<1.5?"#00ff00ff":"#202020ff"})
            screen.pksa.sensors.rear[index][1].css({"fill": dist<0.9?"#ffff00ff":"#202020ff"})
            screen.pksa.sensors.rear[index][2].css({"fill": dist<0.4?"#ff0000ff":"#202020ff"})
          }
        }
      }
    }
    //ready = true;
    //$window.updateConsum({current:0, average:0, range:0});
  });