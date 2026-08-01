// written by DaddelZeit
// DO NOT USE WITHOUT PERMISSION

//console.log("load gaugesScreen");
angular.module('gaugesScreen', [])


.controller('GaugesScreenController', function ($scope, $element, $window) {
  "use strict";
  var vm = this;

  var svg;

  var infoDisplay = {};
  var electrics = {lights:{} };
  var gauges = {fuel:{},temp:{}};
  var tachoBars = {}

  var ready = false;
  var lastCheckpointCount = 0;

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
    svg = $element[0].children[0].children[0];

    electrics.root = hu('#electrics', svg)

    infoDisplay.speed_kmh = hu('#speed_kmh', gauges.root)
    infoDisplay.speed_mph = hu('#speed_mph', gauges.root)
    infoDisplay.avg_speed = hu('#avg_speed', gauges.root)
    infoDisplay.speed = hu('#speed', gauges.root)
    infoDisplay.checkpoint_best = hu('#checkpoint_best', gauges.root)
    infoDisplay.battery_voltage = hu('#battery_voltage', gauges.root)
    infoDisplay.fuel_percent = hu('#fuel_percent', gauges.root)
    infoDisplay.gear = hu('#gear', gauges.root)
    infoDisplay.lap_counter = hu('#lap_counter', gauges.root)
    infoDisplay.tacho_ticks = hu('#tacho_ticks', gauges.root)
    infoDisplay.tacho_ticks_group = hu('#tacho_ticks_group', gauges.root)
    infoDisplay.tacho_ticks_text = hu('#tacho_ticks_text', gauges.root)

    ready = true;
  }

  $window.redrawTachoTicks = (lim,bigSep,smallSep) => {
    var startAngle = 123
    var maxAngle   = 78
    var centerX=57.953571, centerY=68.974941, radiusInt=56, radiusExt=62, radiusIntBig=55

    //var tickD = "";
    for(var ib = 0; ib<= (lim/bigSep) ; ib++){
      for(var is = 0; is<= (bigSep/smallSep); is++){
        var curAng = (ib*maxAngle/(lim/bigSep)+maxAngle*(1/(lim/bigSep))*(is/(bigSep/smallSep))) *Math.PI/180;
        if(curAng > (maxAngle*Math.PI/180)){break;}
        var sx2 = (centerX) + Math.cos(startAngle+curAng) * ((is===0?radiusIntBig:radiusInt)-3*curAng);
        var sy2 = (centerY) + Math.sin(startAngle+curAng) * ((is===0?radiusIntBig:radiusInt)-3*curAng);

        var sx1 = (centerX) + Math.cos(startAngle+curAng) * radiusExt;
        var sy1 = (centerY) + Math.sin(startAngle+curAng) * radiusExt;
        //tickD += "M "+(sx1*1.175)+","+(sy1)+" "+(sx2*1.175)+","+(sy2)+" ";

        var ts = hu('<line>', infoDisplay.tacho_ticks_group)
        .attr({x1: sx1*1.175, y1: sy1, x2: sx2*1.175, y2: sy2})
        .css({"fill":"none","stroke":"#000000","stroke-width":"0.664583px","stroke-linecap":"butt","stroke-linejoin":"miter","stroke-opacity":"1"})
        if (is!=0) {
          tachoBars[ib*bigSep+is*smallSep] = ts
        }
      }
    }
    //infoDisplay.tacho_ticks.attr({d: tickD});

    var txtRadius = 54;
    infoDisplay.tacho_ticks_text.empty();
    for(var ib = 0; ib<=(lim/bigSep) ; ib++){
      var curAng = (ib*maxAngle/(lim/bigSep)) *Math.PI/180;
      var sx = (centerX) + Math.cos(startAngle+curAng) * (txtRadius-3*curAng);
      var sy = (centerY + 4.50) + Math.sin(startAngle+curAng) * (txtRadius-3*curAng);
      var ts = hu('<tspan>', infoDisplay.tacho_ticks_text)
      .attr({x: sx*1.175,y: sy})
      .text((ib*bigSep*0.001))
      .css({"font-style":"normal", "font-size":"5px","font-weight":"normal","font-stretch":"normal","fill-opacity":1,"font-family":"Segment7","stroke-width":0.04861574,"text-align":"center","text-anchor":"middle"})
      .css({"fill":"#000"});
    }
  }

  // overwriting plain javascript function so we can access from within the controller
  $window.setup = (data) => {
    if(!ready){
      console.log("calling setup while svg not fully loaded");
      setTimeout(function(){ $window.setup(data) }, 100);
      return;
    }
    //console.log("setup",data);

    if (data.uiUnitLength == "metric") {
      infoDisplay.speed_mph.css({"display":"none"})
      unitspeedConv = 3.6;
    } else {
      infoDisplay.speed_kmh.css({"display":"none"})
      unitspeedConv = 2.23694;
    }

    redrawTachoTicks(data.maxRPM,1000,100);
  }

  function setElec(val, state, key){
    if( val === undefined || val === null){console.error("setElec: svg element not found", key); return;}
    if( state === undefined || state === null){console.error("setElec: state not found", key);val.n.style.display = "none"; return;}
    var cssState = (state===true || state>0.1)?"inline":"none";
    val.n.style.display = cssState;
  }

  $window.updateElectrics = (data) => {
    if(data.electrics.cruiseControlActive === undefined){data.electrics.cruiseControlActive = false}
    for(var k in electrics.lights){
      setElec(electrics.lights[k], data.electrics[k], k);
    }
  }

  function getGear(gear) {
    return (typeof gear == "number")?(gear>0?gear:gear==0?"N":"R"):gear
  }

  function update(data) {
    infoDisplay.speed.text((data.electrics.wheelspeed*unitspeedConv).toFixed(0))
    infoDisplay.fuel_percent.text((data.electrics.fuel*100).toFixed(0))
    infoDisplay.gear.text(getGear(data.electrics.gear))
    infoDisplay.battery_voltage.text((12+Math.random(-0.5,0.5)).toFixed(1))

    for (var key in tachoBars) {
      if (key < Math.ceil(data.electrics.rpm/100)*100) {
        tachoBars[key].css({"display": "inline"})
      } else {
        tachoBars[key].css({"display": "none"})
      }
    }
  }

  $window.hotLappingInfoUpdate = (data) => {
    if (data.detail) {
      if (data.detail.length != lastCheckpointCount) {
        infoDisplay.checkpoint_best.text(data.detail[data.detail.length-1].duration.replace(":", ".").substr(0,8))
        infoDisplay.lap_counter.text(data.normal[data.normal.length-1].lap)
        lastCheckpointCount = data.detail.length
      }
    } else {
      infoDisplay.checkpoint_best.text(0)
      infoDisplay.lap_counter.text(0)
    }
  }

  $window.updateData = (data) => {
    if (data) {
      if(!ready){console.log("not ready");return;}
      // console.log(data);
      update(data);
    }
  }
  //ready = true;
  //$window.updateConsum({current:0, average:0, range:0});
});