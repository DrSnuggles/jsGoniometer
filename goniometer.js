/*  Goniometer/Phasemeter/VectorScope by DrSnuggles
    License :
 */

"use strict";

var Goniometer = (function () {
  //
  // Init
  //
  var my = {    // public available settings
    // use bgColor[3] to imitate CRT
    bgColor : [255, 255, 255, 0.05], // background color std. white HTML, , 4th value is ignored and used by fade
    bgLines : [96, 0, 0, 0.5], // color rgba for all meter lines
    scopeColor : [0, 96, 0, 1], // color rgba
  },
  debug = true, // display console logs?
  anaL,         // Analyzer for left channel
  anaR,         // Analyzer for right channel
  canvas,       // canvas for resizing
  ctx,          // 2D context for drawing, just get it once
  width,        // width of canvas = calced pixels
  height,       // height of canvas = calced pixels
  raf;          // ref to RAF, needed to cancel RAF

  //
  // Private
  //
  function log(out) {
    if (debug) console.log(out);
  };
  function splitChannels(source) {
    log("splitChannels");
    var splitter = source.context.createChannelSplitter(2);
    var left = source.context.createStereoPanner();
    var right = source.context.createStereoPanner();
    source.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    left.pan.value = -1;
    right.pan.value = 1;
    anaL = source.context.createAnalyser();
    anaR = source.context.createAnalyser();
    left.connect(anaL);
    right.connect(anaR);
  };
  function renderLoop() {
    drawGoniometerBackground();
    drawGoniometer();
    raf = requestAnimationFrame(renderLoop);
  };
  function drawGoniometerBackground() {
    // clear old
    ctx.fillStyle = 'rgba('+my.bgColor[0]+', '+my.bgColor[1]+', '+my.bgColor[2]+', '+my.bgColor[3]+')';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba('+my.bgLines[0]+', '+my.bgLines[1]+', '+my.bgLines[2]+', '+my.bgLines[3]+')';
    ctx.beginPath();

    // x - axis
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);

    // y - axis
    ctx.moveTo(width/2, 0);
    ctx.lineTo(width/2, height);

    // l - axis
    ctx.moveTo(0, 0);
    ctx.lineTo(width, height);

    // r - axis
    ctx.moveTo(width, 0);
    ctx.lineTo(0, height);

    // circles
    var maxradius = height/2;

    // circle 50%
    ctx.moveTo(width/2 + maxradius/2, height/2);
    ctx.arc(width/2, height/2, maxradius/2, 0, 2*Math.PI);

    // circle 75%
    ctx.moveTo(width/2 + maxradius/(4/3), height/2);
    ctx.arc(width/2, height/2, maxradius/(4/3), 0, 2*Math.PI);

    // circle 100%
    ctx.moveTo(width/2 + maxradius, height/2);
    ctx.arc(width/2, height/2, maxradius, 0, 2*Math.PI);

    ctx.stroke(); // finally draw

  };
  function drawGoniometer() {
    //log("drawGoniometer");
    var dataL = new Float32Array(anaL.frequencyBinCount);
    var dataR = new Float32Array(anaR.frequencyBinCount);
    anaL.getFloatTimeDomainData(dataL);
    anaR.getFloatTimeDomainData(dataR);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba('+my.scopeColor[0]+', '+my.scopeColor[1]+', '+my.scopeColor[2]+', '+my.scopeColor[3]+')';
    ctx.beginPath();

    var rotated;

    // move to start point
    rotated = rotate45deg(dataR[0], dataL[0]);  // Right channel is mapped to x axis
    ctx.moveTo(rotated.x * width + width/2, rotated.y* height + height/2);

    // draw line
    for (var i = 1; i < dataL.length; i++) {
      rotated = rotate45deg(dataR[i], dataL[i]);
      ctx.lineTo(rotated.x * width + width/2, rotated.y* height + height/2);
    }

    ctx.stroke();
  };
  function rotate45deg(x, y) {
    var tmp = cartesian2polar(x, y);
    tmp.angle -= 0.78539816; // Rotate coordinate by 45 degrees
    var tmp2 = polar2cartesian(tmp.radius, tmp.angle);
    return {x:tmp2.x, y:tmp2.y};
  }
  function cartesian2polar(x, y) {
    // Convert cartesian to polar coordinate
    var radius = Math.sqrt((x * x) + (y * y));
    var angle = Math.atan2(y,x); // atan2 gives full circle
    return {radius:radius, angle:angle};
  };
  function polar2cartesian(radius, angle) {
    // Convert polar coordinate to cartesian coordinate
    var x = radius * Math.sin(angle);
    var y = radius * Math.cos(angle);
    return {x:x, y:y};
  };
  function resizer() {
    log("resizer");
    // check if our canvas was risized
    if ((width !== canvas.clientWidth) || (height !== canvas.clientHeight)) {
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
      log("canvas resized");
    }
  }

  //
  // Public
  //
  my.start = function(source, drawcanvas) {
    log("Goniometer.start");
    // analyze source if it is tag or GainNode
    log(source);
    if (raf === undefined) {
      // split audio context into left and right channel
      // ToDo: what about mono sources, actually they are displayed as left only !!
      splitChannels(source);
      canvas = drawcanvas;
      ctx = canvas.getContext('2d');
      resizer();
      // resizing, nicer than in loop, coz resize canvas clears it -> no nice fadeout possible
      addEventListener('resize', resizer);
      canvas.imageSmoothingEnabled = false; // faster

      if (debug) {
        my.anaL = anaL;
        my.anaR = anaR;
        my.canvas = canvas;
        my.ctx = ctx;
        my.width = width;
        my.height = height;
      }

      raf = requestAnimationFrame(renderLoop);
      log("Goniometer started");
    } else {
      log("Goniometer already running");
    }
  };
  my.stop = function() {
    log("Goniometer.stop");
    if (raf !== undefined) {
      cancelAnimationFrame(raf);
      raf = undefined;
      removeEventListener('resize', resizer);
      log("Goniometer stopped");
    } else {
      log("Goniometer already stopped");
    }
  };
  my.setFFTsize = function(newSize) {
    anaL.fftSize = anaR.fftSize = newSize;
    log("Goniometer FFT size set to: "+ newSize);
  };

  //
  // Exit
  //
  return my;
})();
