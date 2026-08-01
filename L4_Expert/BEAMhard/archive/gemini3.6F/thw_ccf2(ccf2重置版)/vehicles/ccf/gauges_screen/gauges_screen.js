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

    var text = {  };
    var driveMode = {  };
    var gears = {};
    var isInPark = false;
    let eccfSet = false;
    let leftScreenMode = "mode";
    let economyScreen = ["avg_consumption_reset", "avg_consumption_refuel", "trip_elapsed", "cruise_range"]
    let updateInfoNow = true

    var infoDisplay = {comfortLines: {}};
    var navDisplay = {};
    var electrics = {lights:{} };
    var gauges = {fuel:{},temp:{}};
    var gForcesVisible = false;
    var crawlModeVisible = false;

    var speedoInitialised = true;
    var currentGear = 0;
    var lastIgnitionLevel = 5;

    var warningBoxes = {boxes:{}}
    var latchBoxes = {boxes:{}}

    var ready = false;

    var units = {uiUnitConsumptionRate: "metric",
    uiUnitDate: "ger",
    uiUnitEnergy: "metric",
    uiUnitLength: "metric",
    uiUnitPower: "hp",
    uiUnitPressure: "bar",
    uiUnitTemperature: "c",
    uiUnitTorque: "metric",
    uiUnitVolume: "l",
    uiUnitWeight: "kg"};
    var unitspeedConv = 3.6;

    // Make sure SVG is loaded
    $scope.onSVGLoaded = function () {
      svg = $element[0].children[1].children[0];

      //text.root = hu('#text', svg)
      //text.temp_unit = hu('#temp_unit', text.root)
      //text.outside_temp = hu('#outside_temp', text.root)
      text.time = hu('#text_time', gauges.root)
      text.date = hu('#text_date', gauges.root)
      text.speedLimitDoubleDigit = hu('#speed_limit_doubledigit', gauges.root)
      text.speedLimitTripleDigit = hu('#speed_limit_tripledigit', gauges.root)

      text.odo1 = hu('#odo_digit_one_text', gauges.root)
      text.odo2 = hu('#odo_digit_two_text', gauges.root)
      text.odo3 = hu('#odo_digit_thr_text', gauges.root)
      text.odo4 = hu('#odo_digit_fou_text', gauges.root)
      text.odo5 = hu('#odo_digit_fiv_text', gauges.root)
      text.odo6 = hu('#odo_digit_six_text', gauges.root)
      text.odoFill = hu('#odo_fill_text', gauges.root)
      text.trip1 = hu('#trip_digit_one_text', gauges.root)
      text.trip2 = hu('#trip_digit_two_text', gauges.root)
      text.trip3 = hu('#trip_digit_thr_text', gauges.root)
      text.trip4 = hu('#trip_digit_fou_text', gauges.root)
      text.trip5 = hu('#trip_digit_fiv_text', gauges.root)
      text.trip6 = hu('#trip_digit_six_text', gauges.root)
      text.tripFill = hu('#trip_fill_text', gauges.root)
      text.odoUnit = hu('#odo_unit_text', gauges.root)

      gauges.bootscreen = hu('#bootscreen', gauges.root)
      gauges.bootscreen.css({"transition":"opacity 0.2s ease-in 1s"})
      gauges.temp = hu('#oil_temperature', gauges.root)
      gauges.fuel_needle = hu('#fuel_needle', gauges.root)
      gauges.temp_needle = hu('#oil_needle', gauges.root)

      //
      electrics.root = hu('#electrics', svg)
      electrics.lights.lowfuel = hu('#lowfuel', electrics.root)
      electrics.lights_hightemp = hu('#watertemp', electrics.root)
      electrics.speedValues = [
        hu('#speedo_text1', electrics.root),
        hu('#speedo_text2', electrics.root),
        hu('#speedo_text3', electrics.root)
      ]
      electrics.speedoUnit = hu('#speedo_text_unit', electrics.root)
      electrics.speedoFill = hu('#speedo_text_fill', electrics.root)

      // dse
      electrics.tcs = hu('#tcs', electrics.root)
      electrics.lights_tcsDisabled = hu('#tcs_off', electrics.root)
      electrics.esc = hu('#esc_off', electrics.root)

      // lighting
      electrics.lights_running = hu('#drl', electrics.root)
      electrics.lights.fog = hu('#nebelschlussleuchte', electrics.root)
      electrics.lights.lowhighbeam = hu('#lowbeam', electrics.root)
      electrics.lights.highbeam = hu('#highbeam', electrics.root)
      electrics.lights.longrange = hu('#long_range_light', electrics.root)
      //electrics.lights.signal_L = hu('#signal_left', electrics.root)
      //electrics.lights.signal_R = hu('#signal_right', electrics.root)

      // mechanical related
      //electrics.lights.highBraketemp = hu('#braketemp_light', electrics.root)
      electrics.lights.parkingbrake = hu('#parkingbrake', electrics.root)
      electrics.lights.checkengineBetter = hu('#check_engine', electrics.root)
      electrics.lights.lightBroken = hu('#light_broken', electrics.root)
      //electrics.lights.oilPanLeak = hu('#oilpressure_light', electrics.root)
      electrics.lights.tirepressure = hu('#tire_pressure', electrics.root)
      //electrics.lights_battery = hu('#battery_light', electrics.root)

      // systems related
      electrics.lights.cruiseControlActive = hu('#cruisecontrol', electrics.root)

      // comfort display
      driveMode.drivemode_text = hu('#drivemode_text', gauges.root)
      driveMode.drivemode_colourable1 = hu('#drivemode_colourable1', gauges.root)
      driveMode.drivemode_colourable2 = hu('#drivemode_colourable2', gauges.root)

      infoDisplay.accelerometer = hu('#g_force_display', gauges.root)
      infoDisplay.accelerometer.css({"transition": "opacity 0.3s"})
      infoDisplay.accelerometerMarker = hu('#g_force_meter', infoDisplay.accelerometer)
      infoDisplay.accelerometerText = hu('#g_force_text', infoDisplay.accelerometer)

      infoDisplay.comfort = hu('#comfort_display', gauges.root)
      infoDisplay.comfort.css({"transition": "opacity 0.3s"})
      infoDisplay.comfortLines = [
        {
          val: hu('#info_line1', infoDisplay.comfort),
          text: hu('#info_line1_text', infoDisplay.comfort),
          desc: hu('#info_line1_desc', infoDisplay.comfort),
        },
        {
          val: hu('#info_line2', infoDisplay.comfort),
          text: hu('#info_line2_text', infoDisplay.comfort),
          desc: hu('#info_line2_desc', infoDisplay.comfort),
        },
        {
          val: hu('#info_line3', infoDisplay.comfort),
          text: hu('#info_line3_text', infoDisplay.comfort),
          desc: hu('#info_line3_desc', infoDisplay.comfort),
        },
        {
          val: hu('#info_line4', infoDisplay.comfort),
          text: hu('#info_line4_text', infoDisplay.comfort),
          desc: hu('#info_line4_desc', infoDisplay.comfort),
        },
      ]
      infoDisplay.comfortEV = hu('#comfort_display_ev', gauges.root)
      infoDisplay.comfortEV.css({"transition": "opacity 0.3s"})
      infoDisplay.comfortEVGradient = document.getElementById('linearGradient3691')
      infoDisplay.comfortDisplayEVDistanceUnit = hu('#comfort_display_ev_distance_unit', gauges.root)
      infoDisplay.comfortDisplayEVDistance = hu('#comfort_display_ev_distance', gauges.root)

      infoDisplay.crawl = hu('#crawl_display', gauges.root)
      infoDisplay.crawl.css({"transition": "opacity 0.3s"})
      infoDisplay.crawl.rwd = hu('#rwd_display', infoDisplay.crawl)
      infoDisplay.crawl.awd = hu('#awd_display', infoDisplay.crawl)
      infoDisplay.crawl.rangeBoxGear = hu('#rangebox_gear', infoDisplay.crawl)

      infoDisplay.crawl.lsdFront = hu('#front_diff_lsd', infoDisplay.crawl)
      infoDisplay.crawl.lsdFrontText = hu('#front_diff_lsd_text', infoDisplay.crawl)
      infoDisplay.crawl.lockFront = hu('#front_diff_lock', infoDisplay.crawl)
      infoDisplay.crawl.lockFrontText = hu('#front_diff_lock_text', infoDisplay.crawl)

      infoDisplay.crawl.lsdCenter = hu('#center_diff_lsd', infoDisplay.crawl)
      infoDisplay.crawl.lsdCenterText = hu('#center_diff_lsd_text', infoDisplay.crawl)
      infoDisplay.crawl.lockCenter = hu('#center_diff_lock', infoDisplay.crawl)
      infoDisplay.crawl.lockCenterText = hu('#center_diff_lock_text', infoDisplay.crawl)

      infoDisplay.crawl.lsdRear = hu('#rear_diff_lsd', infoDisplay.crawl)
      infoDisplay.crawl.lsdRearText = hu('#rear_diff_lsd_text', infoDisplay.crawl)
      infoDisplay.crawl.lockRear = hu('#rear_diff_lock', infoDisplay.crawl)
      infoDisplay.crawl.lockRearText = hu('#rear_diff_lock_text', infoDisplay.crawl)

      infoDisplay.crawl.tirepressureUnitsRoot = hu('#g50832', infoDisplay.crawl)
      infoDisplay.crawl.tirepressureUnits = {}
      infoDisplay.crawl.tirepressureUnits.FL = hu('#tirepressure_unit_fl', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressureUnits.FR = hu('#tirepressure_unit_fr', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressureUnits.RL = hu('#tirepressure_unit_rl', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressureUnits.RR = hu('#tirepressure_unit_rr', infoDisplay.crawl.tirepressureRoot)

      infoDisplay.crawl.tirepressureRoot = hu('#g30116', infoDisplay.crawl)
      infoDisplay.crawl.tirepressure = {}
      infoDisplay.crawl.tirepressure.FL = hu('#tirepressure_fl', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressure.FR = hu('#tirepressure_fr', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressure.RL = hu('#tirepressure_rl', infoDisplay.crawl.tirepressureRoot)
      infoDisplay.crawl.tirepressure.RR = hu('#tirepressure_rr', infoDisplay.crawl.tirepressureRoot)

      infoDisplay.crawl.antiRollBarsOff = hu('#crawl_anti_roll_bars_off', infoDisplay.crawl)
      infoDisplay.crawl.antiRollBarsOn = hu('#crawl_anti_roll_bars_on', infoDisplay.crawl)
      infoDisplay.crawl.warningText = hu('#crawl_mode_warning_text', infoDisplay.crawl)

      // gear display
      gears.root = hu('#layer12', gauges.root)
      gears.lastlastGear = hu('#gear_last_last', gears.root)
      gears.lastGear = hu('#gear_last', gears.root)
      gears.mainGear = hu('#gear_main', gears.root)
      gears.nextGear = hu('#gear_next', gears.root)
      gears.nextnextGear = hu('#gear_next_next', gears.root)

      gears.lastlastGear.css({"opacity": "0"})
      gears.nextnextGear.css({"opacity": "0"})

      // warning boxes
      warningBoxes.root = hu('#layer3', gauges.root)
      warningBoxes.boxes.aeb_activate = hu('#aeb_activate', warningBoxes.root).css({"opacity": "0"})
      warningBoxes.boxes.turn_on_engine = hu('#turn_on_engine', warningBoxes.root).css({"opacity": "0"})
      warningBoxes.boxes.brake_overheat = hu('#brake_overheat', warningBoxes.root).css({"opacity": "0"})
      warningBoxes.boxes.engine_overheat = hu('#engine_overheat', warningBoxes.root).css({"opacity": "0"})
      warningBoxes.boxes.engine_broken = hu('#engine_broken', warningBoxes.root)
      warningBoxes.boxes.handbrake = hu('#handbrake', warningBoxes.root)
      warningBoxes.boxes.low_fuel = hu('#low_fuel', warningBoxes.root)
      warningBoxes.boxes.no_fuel = hu('#no_fuel', warningBoxes.root)
      warningBoxes.boxes.crawl_mode = hu('#crawl_mode', warningBoxes.root)
      warningBoxes.boxes.aeb_activate.css({"opacity": "0"})
      warningBoxes.boxes.turn_on_engine.css({"opacity": "0"})
      warningBoxes.boxes.brake_overheat.css({"opacity": "0"})
      warningBoxes.boxes.engine_overheat.css({"opacity": "0"})
      warningBoxes.boxes.engine_broken.css({"opacity": "0"})
      warningBoxes.boxes.handbrake.css({"opacity": "0"})
      warningBoxes.boxes.low_fuel.css({"opacity": "0"})
      warningBoxes.boxes.no_fuel.css({"opacity": "0"})
      warningBoxes.boxes.crawl_mode.css({"opacity": "0"})

      // latch boxes
      latchBoxes.root = hu('#layer2', gauges.root)
      latchBoxes.boxes.latch_car_background = hu('#latch_car_background', latchBoxes.root)
      latchBoxes.boxes.latch_car_bonnet = hu('#latch_car_bonnet', latchBoxes.root)
      latchBoxes.boxes.latch_car_left = hu('#latch_car_left', latchBoxes.root)
      latchBoxes.boxes.latch_car_right = hu('#latch_car_right', latchBoxes.root)
      latchBoxes.boxes.latch_car_boot = hu('#latch_car_boot', latchBoxes.root)
      latchBoxes.boxes.latch_car_background.css({"opacity": "0"})
      latchBoxes.boxes.latch_car_bonnet.css({"opacity": "0"})
      latchBoxes.boxes.latch_car_left.css({"opacity": "0"})
      latchBoxes.boxes.latch_car_right.css({"opacity": "0"})
      latchBoxes.boxes.latch_car_boot.css({"opacity": "0"})

      navDisplay.navMarker = hu('#navMarker', svg)
      //navDisplay.navMarker.n.style.transformOrigin = "758.389px 178.583px"

      ready = true;
    }

    function limitVal(min, val,max){
      return Math.min(Math.max(min,val), max);
    }

    function getGearStringName(inputGear, maxGear) {
      let gear = (inputGear==-2)?"P":inputGear
      gear = (inputGear==-1)?"R":gear
      gear = (inputGear==0)?"N":gear
      return (inputGear>maxGear)?" ":gear
    }

    function setGearNames(index, electricsgear, maxGear) {
      gears.lastlastGear.text(electricsgear==="P"?" ":getGearStringName(index-2, maxGear))
          gears.lastGear.text(electricsgear==="P"?" ":getGearStringName(index-1, maxGear))
          gears.mainGear.text(electricsgear==="P"?"P":getGearStringName(index,   maxGear))
          gears.nextGear.text(electricsgear==="P"?"R":getGearStringName(index+1, maxGear))
      gears.nextnextGear.text(electricsgear==="P"?"N":getGearStringName(index+2, maxGear))
    }

    function resetGearElems() {
      gears.nextnextGear.n.style.transition = ""
      gears.nextnextGear.n.style.opacity = "0"

      gears.nextGear.n.style.transition = ""
      gears.nextGear.n.style.opacity = "1"
      gears.nextGear.n.style.transform = `translate(0px, 0px)`
      document.getElementById("tspan113633").style.transition = ""
      document.getElementById("tspan113633").style.fontSize = "4.93889px"
      document.getElementById("tspan113633").style.fill = "#777777"

      gears.mainGear.n.style.transition = ""
      gears.mainGear.n.style.opacity = "1"
      gears.mainGear.n.style.transform = `translate(0px, 0px)`
      document.getElementById("tspan97905").style.transition = ""
      document.getElementById("tspan97905").style.fontSize = "10.9361px"
      document.getElementById("tspan97905").style.fill = "#ffffff"

      gears.lastGear.n.style.transition = ""
      gears.lastGear.n.style.opacity = "1"
      gears.lastGear.n.style.transform = `translate(0px, 0px)`
      document.getElementById("tspan113633-5").style.transition = ""
      document.getElementById("tspan113633-5").style.fontSize = "4.93889px"
      document.getElementById("tspan113633-5").style.fill = "#777777"

      gears.lastlastGear.n.style.transition = ""
      gears.lastlastGear.n.style.opacity = "0"
    }

    function setAnimDir1() {
      gears.lastGear.n.style.transition = "opacity 0.25s"
      gears.lastGear.n.style.opacity = "0"

      gears.mainGear.n.style.transition = "transform 0.25s"
      gears.mainGear.n.style.transform = `translate(${120.4191/2-135.75787/2}px, ${112.17672/2-116.38361/2}px)`
      document.getElementById("tspan97905").style.transition = "font-size 0.25s, fill 0.25s"
      document.getElementById("tspan97905").style.fontSize = "4.93889px"
      document.getElementById("tspan97905").style.fill = "#777777"

      gears.nextGear.n.style.transition = "transform 0.25s"
      gears.nextGear.n.style.transform = `translate(${135.75787/2-150.82706/2}px, ${116.38361/2-112.01796/2}px)`
      document.getElementById("tspan113633").style.transition = "font-size 0.25s, fill 0.25s"
      document.getElementById("tspan113633").style.fontSize = "10.9361px"
      document.getElementById("tspan113633").style.fill = "#ffffff"

      gears.nextnextGear.n.style.transition = "opacity 0.25s"
      gears.nextnextGear.n.style.opacity = "1"
    }

    function setAnimDir2(gear) {
      if (gear !== "P") {
        gears.lastlastGear.n.style.transition = "opacity 0.25s"
        gears.lastlastGear.n.style.opacity = "1"
      }
      gears.nextGear.n.style.transition = "opacity 0.25s"
      gears.nextGear.n.style.opacity = "0"

      gears.mainGear.n.style.transition = "transform 0.25s"
      gears.mainGear.n.style.transform = `translate(${150.82706/2-135.75787/2}px, ${112.17672/2-116.38361/2}px)`
      document.getElementById("tspan97905").style.transition = "font-size 0.25s, fill 0.25s"
      document.getElementById("tspan97905").style.fontSize = "4.93889px"
      document.getElementById("tspan97905").style.fill = "#777777"

      gears.lastGear.n.style.transition = "transform 0.25s"
      gears.lastGear.n.style.transform = `translate(${135.75787/2-120.4191/2}px, ${116.38361/2-112.17672/2}px)`
      document.getElementById("tspan113633-5").style.transition = "font-size 0.25s, fill 0.25s"
      document.getElementById("tspan113633-5").style.fontSize = "10.9361px"
      document.getElementById("tspan113633-5").style.fill = "#ffffff"
    }

    var animTimeOutSet = false
    var animRunning = false
    var animDone = false
    var targetGear = 0
    var currentGear = 0

    function updateGearIndicator(data) {
      let gearIndex = 0
      if (data.customModules.combustionEngineDataCCF !== undefined) {
        gearIndex = data.customModules.combustionEngineDataCCF.gearIndex
      } else {
        gearIndex = data.electrics.gearIndex
      }

      // only update when gear is changed
      if (gearIndex !== targetGear) {
        targetGear = data.electrics.gear === "P"?-2:gearIndex
      }

      if (currentGear !== targetGear && animRunning === false) {
        animRunning = true
        setTimeout( function() {
          if (targetGear > currentGear) {
            setAnimDir1(data.electrics.gear)
            currentGear = currentGear + 1
          } else if (targetGear < currentGear) {
            setAnimDir2(data.electrics.gear)
            currentGear = currentGear -1
          }
          animDone = true
        }, 50)
      }

      if (animDone === true && animTimeOutSet === false) {
        animTimeOutSet = true
        setTimeout( function() {
          animRunning = false
          animTimeOutSet = false
          animDone = false

          resetGearElems()
          setGearNames(currentGear, data.electrics.gear, data.electrics.maxGearIndex)
        }, 500)
      }
    }

    function getTextSize(text, font) {
      let canvas = document.createElement("canvas")
      let context = canvas.getContext("2d")
      context.font = font
      let measure = context.measureText(text)
      canvas.remove()
      return measure
    }

    function getTextWidth(text, font) {
      return getTextSize(text, font).width
    }

    function updateAccelerometer(data) {
      infoDisplay.accelerometer.css({opacity: 1})
      infoDisplay.accelerometerMarker.css({transformOrigin: '50% 50%', transform: `translate(${limitVal(-10,data.customModules.accelerationData.xSmooth,10)*1.2}px, ${-limitVal(-10,data.customModules.accelerationData.ySmooth,10)*1.2}px`})
      var roundedGX2 = (data.customModules.accelerationData.xSmooth / 10);
      var roundedGY2 = (-data.customModules.accelerationData.ySmooth / 10);
      infoDisplay.accelerometerText.text((Math.abs(roundedGX2)+Math.abs(roundedGY2)).toFixed(1))
    }

    function updateComfortScreen(data) {
      if (updateInfoNow === true) {
        let trip = data.electrics.ccfOdometerTrip*1000
        data = data.customModules.combustionEngineDataCCF
        let fulltime = data.secondsSinceRespawn+data.minutesSinceRespawn*60+data.hoursSinceRespawn*60*60

        for (let i = 0; i < 4; i++) {
          var wanted = economyScreen[i]
          if (wanted == "avg_consumption_reset") {
            infoDisplay.comfortLines[i].val.text(unitspeedConv === 3.6?(data.averageFuelConsumption).toFixed(1):((100*3.785411784)/(1.609344*data.averageFuelConsumption)).toFixed(1))
          } else if (wanted == "avg_consumption_refuel") {
            infoDisplay.comfortLines[i].val.text(unitspeedConv === 3.6?(data.averageFuelConsumptionSinceRefuel).toFixed(1):((100*3.785411784)/(1.609344*data.averageFuelConsumptionSinceRefuel)).toFixed(1))
          } else if (wanted == "trip_elapsed") {
            infoDisplay.comfortLines[i].val.text(data.hoursSinceRespawn + ":" + fixClock(data.minutesSinceRespawn))
          } else if (wanted == "cruise_range") {
            infoDisplay.comfortLines[i].val.text((unitspeedConv === 3.6?data.remainingRange:data.remainingRange*0.6213712).toFixed(0))
          } else if (wanted == "instant_consumption") {
            infoDisplay.comfortLines[i].val.text(unitspeedConv === 3.6?(data.currentFuelConsumption).toFixed(1):((100*3.785411784)/(1.609344*data.currentFuelConsumption)).toFixed(1))
          } else if (wanted == "avg_speed") {
            infoDisplay.comfortLines[i].val.text(((trip/fulltime)*unitspeedConv).toFixed(1))
          }
        }

        updateInfoNow = false
        setTimeout(function() {updateInfoNow = true}, 600)
      }
    }

    function updateComfortScreenEV(data) {
      let power = data.electrics.engineLoad*34.5+25.5
      infoDisplay.comfortEVGradient.setAttribute("x1", power)
      infoDisplay.comfortEVGradient.setAttribute("x2", power+4)

      if (updateInfoNow === true) {
        let distance = data.customModules.electricMotorData.remainingRange.toFixed(0)
        if (distance == 0 || distance>999) { distance = "..." }
        infoDisplay.comfortDisplayEVDistance.text(distance);
        updateInfoNow = false
        setTimeout(function() {updateInfoNow = true}, 600)
      }
    }

    function updateCrawlScreen(data) {
      infoDisplay.crawl.lsdFront.css({"opacity": data.electrics.diffLockF===1?"0":"1"});
      infoDisplay.crawl.lsdFrontText.css({"opacity": data.electrics.diffLockF===1?"0":"1"});
      infoDisplay.crawl.lsdCenter.css({"opacity": data.electrics.diffLockM===1?"0":"1"});
      infoDisplay.crawl.lsdCenterText.css({"opacity": data.electrics.diffLockM===1?"0":"1"});
      infoDisplay.crawl.lsdRear.css({"opacity": data.electrics.diffLockR===1?"0":"1"});
      infoDisplay.crawl.lsdRearText.css({"opacity": data.electrics.diffLockR===1?"0":"1"});

      infoDisplay.crawl.rangeBoxGear.text(data.electrics.modeRangeBox===1?"LOW":"HIGH");
      infoDisplay.crawl.awd.css({"opacity": data.electrics.mode4WD === 1?"1":"0"});
      infoDisplay.crawl.rwd.css({"opacity": data.electrics.mode4WD === 1?"0":"1"});

      if (typeof UiUnits === "object") {
        for (var val in infoDisplay.crawl.tirepressure) {
          let value = UiUnits.pressure(data.customModules.tireData.pressures[val] , units["unitPressure"])
          infoDisplay.crawl.tirepressure[val].text(value.val.toFixed(1))
        }
      }
    }

    function updateGaugeFuel(data) {
      if (speedoInitialised) {
        var offset = (data.electrics.fuel*(106.82318-14.0272)/2)+14.0272/2

        gauges.fuel_needle.attr({d: "m 71.41398,43.925617 h " + offset + " v 3.852997 h " + -offset + " z"})
      }
    }

    function updateGaugeTemp(data) {
      if (speedoInitialised) {
        data.electrics.oiltemp = data.electrics.oiltemp > 60?data.electrics.oiltemp*0.83333333333333333:data.electrics.oiltemp
        var offset = (data.electrics.oiltemp*1.195321125/2)-1.8/2
        gauges.temp_needle.attr({d: "m 0,43.9022295 h " + offset + " v 3.852997 h " + -offset + " z"})
      }
    }

    $window.toggleMessageWindow = (data) => {
      if(!ready){
        setTimeout(function(){ $window.toggleMessageWindow(data) }, 100);
        return;
      }
      if (warningBoxes.boxes[data[0]] !== undefined) {
        warningBoxes.boxes[data[0]].css({"opacity": data[1]})
      }
    }

    $window.hideAllMessageWindows = (data) => {
      if(!ready){
        setTimeout(function(){ $window.toggleMessageWindow(data) }, 100);
        return;
      }
      for (var val in data) {
        warningBoxes.boxes[data[val]].css({"opacity": 0})
      }
    }

    $window.setActiveLatchBoxes = (data) => {
      if(!ready){
        setTimeout(function(){ $window.toggleMessageWindow(data) }, 100);
        return;
      }
      for (var val in latchBoxes.boxes) {
        latchBoxes.boxes.latch_car_background.css({"opacity": "0"})
        latchBoxes.boxes[val].css({"opacity": "0"})
      }
      for (var val in data) {
        latchBoxes.boxes.latch_car_background.css({"opacity": "1"})
        latchBoxes.boxes[data[val]].css({"opacity": "1"})
      }
    }

    // overwriting plain javascript function so we can access from within the controller
    $window.setup = (data) => {
      if(!ready){
        console.log("calling setup while svg not fully loaded");
        setTimeout(function(){ $window.setup(data) }, 100);
        return;
      }

      if (data.uiUnitLength == "metric") {
        document.getElementById("tspan31954").innerHTML = "km/h"
        infoDisplay.comfortDisplayEVDistanceUnit.text("kilometers")
        text.odoUnit.text("km");
        unitspeedConv = 3.6;
      } else {
        document.getElementById("tspan31954").innerHTML = "mph"
        infoDisplay.comfortDisplayEVDistanceUnit.text("miles")
        text.odoUnit.text("miles");
        unitspeedConv = 2.23694;
      }

      for (var val in infoDisplay.crawl.tirepressureUnits) {
        infoDisplay.crawl.tirepressureUnits[val].text(data.uiUnitPressure)
      }

      setGearNames(0, 0, 6)

      eccfSet = data.eccf != undefined
      if (eccfSet === true) {
        gauges.temp.css({"display":"none"})
      }

      units.uiUnitTemperature = data.uiUnitTemperature || ""
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
      var focusX = -data.x;
      var focusY = data.y;
      var origin = `${((navDimensions[0] * -1)) - focusX}px ${((navDimensions[1] * -1)) - focusY}px`;
      navContainer.style.transformOrigin = origin;
      var translateX = (navDimensions[0] + 256 + focusX + 125);
      var translateY = (navDimensions[1] + 128 + focusY - 37.5);
      navContainer.style.transform = `translate3d(${translateX}px,${translateY}px, 0px) rotateX(${50}deg) rotateZ(${180 + (data.rotation + 360)}deg) scale(1)`;
    }

    var drawnMarkers = {}
    function _createLine(p1, p2, color) {
      return hu('<line>', navContainer).attr({
       x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
       stroke: color,
       strokeWidth: Math.max(p1.radius, p2.radius),
       strokeLinecap: "round",
     });
    }

    var hue = 0;

    function setElec(val, state, key){
      if( val === undefined || val === null){console.error("setElec: svg element not found", key); return;}
      if( state === undefined || state === null){console.error("setElec: state not found", key);val.n.style.display = "none"; return;}
      var cssState = (state===true || state>0.1)?"inline":"none";
      val.n.style.display = cssState;
      //val.n.setAttribute("opacity", (state || state>0.1)?1.0:0.3)
    }

    $window.updateElectrics = (data) => {
      let speed = (data.electrics.wheelspeed*unitspeedConv).toFixed(0)
      electrics.speedValues[0].text(speed.substr(-1,1))
      electrics.speedValues[1].text(speed.length>1 ?  speed.substr(-2,1) : " ")
      electrics.speedValues[2].text(speed.length>2 ?  speed.substr(-3,1) : " ")
      electrics.speedoFill.text("0".repeat(3-speed.length))

      if (data.electrics.ignitionLevel != lastIgnitionLevel) {
        if (data.electrics.ignitionLevel >= 2) {
          gauges.bootscreen.css({"opacity":"0"})
        } else {
          gauges.bootscreen.css({"opacity":"1"})
        }
        lastIgnitionLevel = data.electrics.ignitionLevel
      }

      if(data.electrics.cruiseControlActive === undefined){data.electrics.cruiseControlActive = false}
      for(var k in electrics.lights){
        setElec(electrics.lights[k], data.electrics[k], k);
      }

      electrics.esc.n.style.display = (data.electrics["esc"]==1) ?"inline":"none";
      if(data.electrics["esc"] === undefined){
        //nope
      }else{
        if( electrics.esc.n.classList.contains("blink") !== (data.electrics["esc"]===1) && data.electrics["escActive"]){
          electrics.esc.n.classList.toggle("blink", data.electrics["esc"]===1);
        }
        if(electrics.esc.n.classList.contains("blink") && !data.electrics["escActive"]){
          electrics.esc.n.classList.remove("blink");
        }
      }
      electrics.tcs.n.style.display = (data.electrics["tcs"]===1) ?"inline":"none";
      if(data.electrics["tcs"] === undefined){
        //nope
      }else{
        if( electrics.tcs.n.classList.contains("blink") !== (data.electrics["tcs"]===1) && data.electrics["tcsActive"]){
          electrics.tcs.n.classList.toggle("blink", data.electrics["tcs"]===1);
        }
        if(electrics.tcs.n.classList.contains("blink") && !data.electrics["tcsActive"]){
          electrics.tcs.n.classList.remove("blink");
        }
      }

      electrics.lights_hightemp.n.style.display = ( data.electrics.watertemp > 110 )?"inline":"none";

      electrics.lights_tcsDisabled.n.style.display = ( data.electrics.tcsDisabled===true || data.electrics.tcsDisabled===1 )?"inline":"none";

      //electrics.lights_checkengine.n.style.display = (data.electrics.checkengineBetter===1&&data.electrics.startStopActive===0)?"inline":"none";
      //electrics.lights_battery.n.style.display = (data.electrics.engineRunning<0.1&&data.electrics.startStopActive===0)?"inline":"none";
      electrics.lights_running.n.style.display = (data.electrics.running==true || data.electrics.startStopActive===1)?"inline":"none";
      //electrics.lights_hybridReady.n.style.display = (data.electrics.running==true || data.electrics.startStopActive===1)?"inline":"none";

      let conversion = unitspeedConv === 3.6?1:0.6213712
      let odometer = String((data.electrics.ccfOdometer*conversion).toFixed(0))
      text.odo1.text(odometer.charAt(odometer.length-1))
      text.odo2.text(odometer.charAt(odometer.length-2))
      text.odo3.text(odometer.charAt(odometer.length-3))
      text.odo4.text(odometer.charAt(odometer.length-4))
      text.odo5.text(odometer.charAt(odometer.length-5))
      text.odo6.text(odometer.charAt(odometer.length-6))
      text.odoFill.text("0".repeat(6-odometer.length))

      let trip = String((data.electrics.ccfOdometerTrip*conversion).toFixed(0))
      text.trip1.text(trip.charAt(trip.length-1))
      text.trip2.text(trip.charAt(trip.length-2))
      text.trip3.text(trip.charAt(trip.length-3))
      text.trip4.text(trip.charAt(trip.length-4))
      text.trip5.text(trip.charAt(trip.length-5))
      text.trip6.text(trip.charAt(trip.length-6))
      text.tripFill.text("0".repeat(6-trip.length))
    }

    //https://stackoverflow.com/a/56266358
    function isColor(strColor){
      var s = new Option().style;
      s.color = strColor;
      return s.color !== "";
    }

    $window.speedLimitChanged = (speedlimit) => {
      if(!ready){
        setTimeout(function(){ $window.speedLimitChanged(speedlimit) }, 100);
        return;
      }
      let actualSpeedLimit = Math.round((speedlimit*unitspeedConv).toFixed(0)/10)*10
      if (actualSpeedLimit < 100) {
        text.speedLimitTripleDigit.text("")
        text.speedLimitDoubleDigit.text(actualSpeedLimit)
      } else {
        text.speedLimitDoubleDigit.text("")
        text.speedLimitTripleDigit.text(actualSpeedLimit)
      }
    }

    function updateEconomyScreenLines() {
      for (let i = 0; i < 4; i++) {
        var wanted = economyScreen[i]
        if (wanted == "avg_consumption_reset") {
          infoDisplay.comfortLines[i].text.text(unitspeedConv === 3.6?"l/100km":"mpg")
          infoDisplay.comfortLines[i].desc.text("after reset")
        } else if (wanted == "avg_consumption_refuel") {
          infoDisplay.comfortLines[i].text.text(unitspeedConv === 3.6?"l/100km":"mpg")
          infoDisplay.comfortLines[i].desc.text("after refuel")
        } else if (wanted == "trip_elapsed") {
          infoDisplay.comfortLines[i].text.text("trip elapsed")
          infoDisplay.comfortLines[i].desc.text("hours:minutes")
        } else if (wanted == "cruise_range") {
          infoDisplay.comfortLines[i].text.text("range")
          infoDisplay.comfortLines[i].desc.text("kilometers")
        } else if (wanted == "instant_consumption") {
          infoDisplay.comfortLines[i].text.text(unitspeedConv === 3.6?"l/100km":"mpg")
          infoDisplay.comfortLines[i].desc.text("instant")
        } else if (wanted == "avg_speed") {
          infoDisplay.comfortLines[i].text.text(unitspeedConv === 3.6?"km/h":"mpg")
          infoDisplay.comfortLines[i].desc.text("average")
        }

        setTimeout(function(){
          let width = getTextWidth(infoDisplay.comfortLines[i].text.n.children[0].innerHTML, "3.55139px Nasalization")
          infoDisplay.comfortLines[i].val.css({"transform": `translate(${-width-1}px, 0px)`})
        }, 1000);
      }
    }

    $window.updateMode = (data) => {
      if(!ready){
        console.log("calling updateMode while svg not fully loaded");
        setTimeout(function(){ $window.updateMode(data) }, 100);
        return;
      }
      //error checking because we can't trust people we work with
      if(data === null
      || data === undefined
      || data.modeName === null
      || data.modeName === undefined
      || typeof data.modeName !== "string"
      || data.modeColor === null
      || data.modeColor === undefined
      || typeof data.modeColor !== "string"){
        console.error("updateMode receive wrong arguments :", data);
        driveMode.drivemode_text.text("inval. data");
        return;
      }
      if(!isColor(data.modeColor)){
        console.error("This mode color is not in html format :",data.modeColor);
        driveMode.drivemode_text.text("inval. colour");
        return;
      }

      //hex color without # works in html but not in svg BECAUSE
      var s = new Option().style;
      s.color = data.modeColor;
      data.modeColor = s.color;

      crawlModeVisible = data.modeName === "CRAWL" || data.modeName === "TRAIL"
      infoDisplay.crawl.antiRollBarsOff.css({"display": data.modeName === "CRAWL"?"inline":"none"})
      infoDisplay.crawl.antiRollBarsOn.css({"display": data.modeName === "TRAIL"?"inline":"none"})
      infoDisplay.crawl.warningText.css({"display": data.modeName === "CRAWL"?"inline":"none"})

      gForcesVisible = data.modeName != "STREET" && crawlModeVisible === false;

      if (leftScreenMode == "mode") {
        if (gForcesVisible === true) {
          infoDisplay.accelerometer.css({opacity: 1})
          infoDisplay.comfort.css({opacity: 0})
          infoDisplay.comfortEV.css({opacity: 0})
          infoDisplay.crawl.css({opacity: 0})
        } else if (crawlModeVisible === true) {
          infoDisplay.accelerometer.css({opacity: 0})
          infoDisplay.comfort.css({opacity: 0})
          infoDisplay.comfortEV.css({opacity: 0})
          infoDisplay.crawl.css({opacity: 1})
        } else {
          infoDisplay.accelerometer.css({opacity: 0});
          if (eccfSet === true) {
            infoDisplay.comfort.css({opacity: 0})
            infoDisplay.comfortEV.css({opacity: 1})
          } else {
            infoDisplay.comfort.css({opacity: 1})
            infoDisplay.comfortEV.css({opacity: 0})
          }
          infoDisplay.crawl.css({opacity: 0})
        }
      }
      updateEconomyScreenLines()

      driveMode.drivemode_text.text(data.modeName);
      driveMode.drivemode_colourable1.css({"fill": data.modeColor})
      driveMode.drivemode_colourable2.css({"fill": data.modeColor})
    }

    function fixClock(v, fill="0"){
      return (v<10)? fill+v : v;
    }

    $window.setLeftScreen = (data) => {
      if(!ready){
        setTimeout(function(){ $window.setLeftScreen(data) }, 100);
        return;
      }

      leftScreenMode = data[0]
      if (leftScreenMode == "mode") {
        if (gForcesVisible === true) {
          infoDisplay.accelerometer.css({opacity: 1})
          infoDisplay.comfort.css({opacity: 0})
          infoDisplay.crawl.css({opacity: 0})
        } else if (crawlModeVisible === true) {
          infoDisplay.accelerometer.css({opacity: 0})
          infoDisplay.comfort.css({opacity: 0})
          infoDisplay.crawl.css({opacity: 1})
        } else {
          infoDisplay.accelerometer.css({opacity: 0});
          if (eccfSet === true) {
            infoDisplay.comfort.css({opacity: 0})
            infoDisplay.comfortEV.css({opacity: 1})
          } else {
            infoDisplay.comfort.css({opacity: 1})
            infoDisplay.comfortEV.css({opacity: 0})
          }
          infoDisplay.crawl.css({opacity: 0})
        }
      } else if (leftScreenMode == "blank") {
        infoDisplay.accelerometer.css({opacity: 0});
        infoDisplay.comfort.css({opacity: 0})
        infoDisplay.crawl.css({opacity: 0})
      } else if (leftScreenMode == "gmeter") {
        infoDisplay.accelerometer.css({opacity: 1});
        infoDisplay.comfort.css({opacity: 0})
        infoDisplay.crawl.css({opacity: 0})
      }
    }

    $window.setRightScreen = (data) => {
      if(!ready){
        setTimeout(function(){ $window.setRightScreen(data) }, 100);
        return;
      }

      navContainer.style.display = data[0] == "blank"?"none":"inline"
      navDisplay.navMarker.n.style.display = data[0] == "blank"?"none":"inline"
    }

    $window.setLeftEconomyScreen = (data) => {
      if(!ready){
        setTimeout(function(){ $window.setLeftEconomyScreen(data) }, 100);
        return;
      }

      if (JSON.stringify(economyScreen) !== JSON.stringify(data[0])) {
        economyScreen = data[0]

        updateEconomyScreenLines()

        updateInfoNow = true
      }
    }

    $window.updateData = (data) => {
      if (data) {
        if(!ready){console.log("not ready");return;}
        // console.log(data);
        //hue = (hue+.5) % 360;
        //setTheme(hue);

        // Update PRNDS display
        updateGearIndicator(data);

        updateElectrics(data);
        updateGaugeFuel(data);
        updateGaugeTemp(data);

        if (leftScreenMode != "blank") {
          if (leftScreenMode == "gmeter" || gForcesVisible === true) {
            updateAccelerometer(data);
          } else if (crawlModeVisible === true) {
            updateCrawlScreen(data)
          } else {
            if (eccfSet === true) {
              updateComfortScreenEV(data);
            } else {
              updateComfortScreen(data);
            }
          }
        }

        let current_time = new Date(Date.now());
        text.time.text(fixClock(current_time.getHours()) + ":" + fixClock(current_time.getMinutes()));
        // if beamng exists past the 21st century i will be very surprised
        text.date.text(current_time.getDate() + "/" + (current_time.getMonth()+1) + "/" + (current_time.getFullYear()-2000));
      }
    }
    //ready = true;
    //$window.updateConsum({current:0, average:0, range:0});
  });