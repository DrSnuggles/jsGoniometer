/*  Goniometer/Phasemeter/VectorScope by DrSnuggles
    License :
 */

"use strict";

var Goniometer = (function () {
  //
  // Init
  //
  var my = {    // public available settings
  },
  debug = true, // display console logs?
  anaL,         // Analyzer for left channel
  anaR,         // Analyzer for right channel
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
    drawGoniometer();
    raf = requestAnimationFrame(renderLoop);
  };
  function drawGoniometerBackground() {
    // clear old
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(96, 0, 0)';
    ctx.beginPath();

    // x - axis
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);

    // y - axis
    ctx.moveTo(width/2, 0);
    ctx.lineTo(width/2, height);

    ctx.stroke();
  };
  function drawGoniometer() {
    //log("drawGoniometer");
    drawGoniometerBackground();

    var float = true;
    if (float) {
      var dataL = new Float32Array(anaL.frequencyBinCount);
      var dataR = new Float32Array(anaR.frequencyBinCount);
      anaL.getFloatTimeDomainData(dataL);
      anaR.getFloatTimeDomainData(dataR);
    } else {
      var dataL = new Uint8Array(anaL.frequencyBinCount);
      var dataR = new Uint8Array(anaR.frequencyBinCount);
      anaL.getByteTimeDomainData(dataL);
      anaR.getByteTimeDomainData(dataR);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(0, 96, 0)';
    ctx.beginPath();

    // https://www.kvraudio.com/forum/viewtopic.php?t=477945
    for (var i = 0; i < dataL.length; i++) {
      var x = dataR[i]; // Right channel is mapped to x axis
      var y = dataL[i]; // Left channel is mapped to y axis
      if (!float) {
        // for 0...255 based Uint8
        // convert to -1...+1
        x = (x - 128) / 128;
        y = (y - 128) / 128;
      }
      // Convert cartesian to polar coordinate
      // @see https://www.mathsisfun.com/polar-cartesian-coordinates.html
      var radius = Math.sqrt((x * x) + (y * y));
      var angle = Math.atan(y/x);

      // atan() returns wrong value if either value is negative.
      // Correct for this by rotating 180 or 360 degrees depending on which
      // quadrant of the x/y graph the cartesian coordinate is in.
      if ((x < 0 && y > 0) || (x < 0 && y < 0)) {
        angle += 3.14159265; // Pi radians = 180 degrees
      } else if (x > 0 && y < 0) {
        angle += 6.28318530; // 2Pi radians = 360 degrees
      }

      // atan() will return zero if either of our coordinates is zero.
      // Correct for this by manually setting the angle.
      if (x == 0) {
        angle = y > 0 ? 1.57079633 : 4.71238898; // 90 or 270 degrees
      } else if (y == 0) {
        angle = x > 0 ? 0 : 3.14159265; // 0 or 180 degrees
      }

      // Rotate coordinate by 45 degrees counter clockwise
      angle -= 0.78539816;
      // Convert polar coordinate back to cartesian coordinate.
      var xRotated = radius * Math.sin(angle);
      var yRotated = radius * Math.cos(angle);
      //log("xRotated: "+ xRotated +" yRotated"+ yRotated);
      var drawX = xRotated * width + width/2;
      var drawY = yRotated * height + height/2;
      ctx.lineTo(drawX, drawY);
//if (i===0) console.log(drawX,drawY);
      //ctx.fillRect(drawX, drawY, 1, 1);
    }

    ctx.stroke();
  };

  //
  // Public
  //
  my.start = function(source, canvas) {
    log("Goniometer.start");
    log(source);
    if (raf === undefined) {
      // split audio context into left and right channel
      // ToDo: what about mono sources, actually they are display as left only !!
      splitChannels(source);
      ctx = canvas.getContext('2d');
      //anaL.fftSize = anaR.fftSize = 2048;
      // width = canvas.width ... both are equal
      width = canvas.width = 256;//anaL.frequencyBinCount;
      height = canvas.height = 256;
      canvas.imageSmoothingEnabled = false;
      if (debug) {
        my.anaL = anaL;
        my.anaR = anaR;
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
      log("Goniometer stopped");
    } else {
      log("Goniometer already stopped");
    }
  };

  //
  // Exit
  //
  return my;
})();
