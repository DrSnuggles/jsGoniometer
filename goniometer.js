/*  Goniometer / VectorScope by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
    PIXI Version !
    tested with v5.0.0-rc3
    DONE pri: make it work with pixi
    2nd: use ticker instead of requestAnimationFrame
    2nd: load PIXIlib if wanted

 */

"use strict";

var Goniometer = (function () {
  //
  // Init
  //
  var my = {    // public available settings
    // Left,Right,Mono,Phase,Circle100%,Circle75%,Circle50%
    bgLines : ['L','R','M','P','C100','C75','C50'],
    // use bgColor[3] to imitate CRT
    bgColor : [255, 255, 255, 1], // background color std. white HTML, 4th value is used by fade to imitate CRT, but i don't like
    bgLineColor : [96, 0, 0, 0.5], // color rgba for all meter lines
    scopeColor : [0, 96, 0, 1], // color rgba
  },
  debug = true, // display console logs?
  usePIXI = true, // Bool, canvas used when false
  anaL,         // Analyzer for left channel
  anaR,         // Analyzer for right channel
  app,          // PIXI App
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

    // analyze source
    if (source.tagName === "AUDIO") {
      log("Audio tag found")
      var audioCtx = new AudioContext();
      source = audioCtx.createMediaElementSource(source); // creates source from audio tag with at least 2channels
      source.connect(audioCtx.destination); // route source to destination
      log("Audio source created and routed");
    }
    // now we should have GainNode or MediaElementAudioSourceNode
    //log(source);

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
    /*
    // was intended for 1 channel signals
    // 1 channel signals they are displayed as left only sources which is not correct
    // BUT createMediaElementSource creates 2 channels from a 1 channel signal... depends on playback device???
    switch (source.channelCount) {
      case 0:
        log("No audio channels found");
        break;
      case 1:
        log("Mono signal found");
        left.connect(anaL);
        right.connect(anaL);
        break;
      case 2:
        log("Stereo signal found");
        left.connect(anaL);
        right.connect(anaR);
        break;
      default:
        log("Multichannel with "+ source.channelCount +" signals found");
        left.connect(anaL);
        right.connect(anaR);
    }
    */
  };
  function renderLoop() {
    clearGoniometer();
    if (my.bgLines.length > 0) {
      drawBGlines();
    }
    drawGoniometer();
    if (!usePIXI) {
      raf = requestAnimationFrame(renderLoop);
    }
  };
  function clearGoniometer() {
    //log("clearGoniometer");
    // clear/fade out old
    if (usePIXI) {
      // remove old
      while(app.stage.children.length > 0) {
        var child = app.stage.getChildAt(0);
        app.stage.removeChild(child);
      }


      //var gr = new PIXI.Graphics();
      //gr.lineStyle(0, 0xFFFFFF, 1);
      //gr.beginFill('0x'+my.bgColor[0].toString(16)+my.bgColor[1].toString(16)+my.bgColor[2].toString(16));
      //gr.alpha = my.bgColor[3];
      //gr.drawRect(0, 0, width, height);
      //gr.endFill();
      //app.stage.addChild(gr);

    } else {
      if (my.bgColor.length > 0) {
        ctx.fillStyle = 'rgba('+my.bgColor[0]+', '+my.bgColor[1]+', '+my.bgColor[2]+', '+my.bgColor[3]+')';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height); // maybe useful for transparent mode
      }
    }
  };
  function drawBGlines() {
    //log("drawBGlines");
    if (usePIXI) {
      var gr = new PIXI.Graphics();
      gr.id = "bg";
      //gr.lineStyle(1, my.bgLineColor[0]*255**2 + my.bgLineColor[1]*255**1 + my.bgLineColor[2]*255**0, 1);
      gr.lineStyle(1, 0x000000, 1);
      gr.alpha = my.bgLineColor[3];
      // x - axis
      gr.moveTo(0, height/2);
      gr.lineTo(width, height/2);
      // y - axis
      gr.moveTo(width/2, 0);
      gr.lineTo(width/2, height);
      // l - axis
      gr.moveTo(0, 0);
      gr.lineTo(width, height);
      // r - axis
      gr.moveTo(width, 0);
      gr.lineTo(0, height);
      // 50%
      gr.moveTo(width/2 + width/2 /2, height/2);
      gr.drawEllipse(width/2, height/2, width/2 /2, height/2 /2);
      // 75%
      gr.moveTo(width/2 + width/2 /(4/3), height/2);
      gr.drawEllipse(width/2, height/2, width/2 /(4/3), height/2 /(4/3));
      // 100%
      gr.moveTo(width/2 + width/2, height/2);
      gr.drawEllipse(width/2, height/2, width/2, height/2);

      app.stage.addChild(gr);
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba('+my.bgLineColor[0]+', '+my.bgLineColor[1]+', '+my.bgLineColor[2]+', '+my.bgLineColor[3]+')';
      ctx.beginPath();

      if (my.bgLines.indexOf("P") !== -1) {
        // x - axis
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
      }

      if (my.bgLines.indexOf("M") !== -1) {
        // y - axis
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
      }

      if (my.bgLines.indexOf("L") !== -1) {
        // l - axis
        ctx.moveTo(0, 0);
        ctx.lineTo(width, height);
      }

      if (my.bgLines.indexOf("R") !== -1) {
        // r - axis
        ctx.moveTo(width, 0);
        ctx.lineTo(0, height);
      }

      // circles/ellipses
      if (my.bgLines.indexOf("C50") !== -1) {
        // 50%
        ctx.moveTo(width/2 + width/2 /2, height/2);
        ctx.ellipse(width/2, height/2, width/2 /2, height/2 /2, 0, 0, 2*Math.PI);
      }

      if (my.bgLines.indexOf("C75") !== -1) {
        // 75%
        ctx.moveTo(width/2 + width/2 /(4/3), height/2);
        ctx.ellipse(width/2, height/2, width/2 /(4/3), height/2 /(4/3), 0, 0, 2*Math.PI);
      }

      if (my.bgLines.indexOf("C100") !== -1) {
        // 100%
        ctx.moveTo(width/2 + width/2, height/2);
        ctx.ellipse(width/2, height/2, width/2, height/2, 0, 0, 2*Math.PI);
      }

      ctx.stroke(); // finally draw

    }
  };
  function drawGoniometer() {
    //log("drawGoniometer");
    var dataL = new Float32Array(anaL.frequencyBinCount);
    var dataR = new Float32Array(anaR.frequencyBinCount);
    anaL.getFloatTimeDomainData(dataL);
    anaR.getFloatTimeDomainData(dataR);

    var c;
    if (usePIXI) {
      c = new PIXI.Graphics();
      c.id = "scope";
      c.lineStyle(1, my.scopeColor[0]*255**2 + my.scopeColor[1]*255**1 + my.scopeColor[2]*255**0, 1);
      c.alpha = my.scopeColor[3];
    } else {
      c = ctx;
      c.lineWidth = 1;
      c.strokeStyle = 'rgba('+my.scopeColor[0]+', '+my.scopeColor[1]+', '+my.scopeColor[2]+', '+my.scopeColor[3]+')';
      c.beginPath();
    }

    var rotated;

    // move to start point
    rotated = rotate45deg(dataR[0], dataL[0]);  // Right channel is mapped to x axis
    c.moveTo(rotated.x * width + width/2, rotated.y* height + height/2);

    // draw line
    for (var i = 1; i < dataL.length; i++) {
      rotated = rotate45deg(dataR[i], dataL[i]);
      c.lineTo(rotated.x * width + width/2, rotated.y* height + height/2);
    }

    if (usePIXI) {
      app.stage.addChild(c);
    } else {
      ctx.stroke();
    }

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
    if (usePIXI) {
      app.renderer.resize(canvas.clientWidth, canvas.clientHeight);
    }
  }

  //
  // Public
  //
  my.start = function(source, drawcanvas) {
    log("Goniometer.start");

    if (raf === undefined) {
      splitChannels(source);
      canvas = drawcanvas;

      if (usePIXI) {
        // init PIXI
        app = new PIXI.Application({
          autostart: true, // Automatically starts the rendering after the construction. Note: Setting this parameter to false does NOT stop the shared ticker even if you set options.sharedTicker to true in case that it is already started. Stop it by your own.
          width: canvas.clientWidth, // The width of the renderers view.
          height: canvas.clientHeight, // The height of the renderers view.
          view: canvas, // The canvas to use as a view, optional.
          transparent: false, // If the render view is transparent.
          autoDensity: false, // Resizes renderer view in CSS pixels to allow for resolutions other than 1.
          antialias: true, // Sets antialias
          preserveDrawingBuffer: false, // Enables drawing buffer preservation, enable this if you need to call toDataUrl on the WebGL context.
          resolution: window.devicePixelRatio || 1, // The resolution / device pixel ratio of the renderer, retina would be 2.
          forceCanvas: false, // prevents selection of WebGL renderer, even if such is present, this option only is available when using pixi.js-legacy or @pixi/canvas-renderer modules, otherwise it is ignored.
          backgroundColor: 0xffffff, // The background color of the rendered area (shown if not transparent).
          clearBeforeRender: true, // This sets if the renderer will clear the canvas or not before the new render pass.
          forceFXAA: true, // Forces FXAA antialiasing to be used over native. FXAA is faster, but may not always look as great. (WebGL only).
          powerPreference: "", // Parameter passed to webgl context, set to "high-performance" for devices with dual graphics card. (WebGL only).
          sharedTicker: false, // true to use PIXI.Ticker.shared, false to create new ticker.
          sharedLoader: false, // true to use PIXI.Loaders.shared, false to create new Loader.
          resizeTo: canvas, // Element to automatically resize stage to.
        });
        raf = app.ticker.add(renderLoop);
      } else {
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // faster
        raf = requestAnimationFrame(renderLoop);
      }

      resizer();
      // resizing, nicer than in loop, coz resize canvas clears it -> no nice fadeout possible
      addEventListener('resize', resizer);

      if (debug) {
        my.anaL = anaL;
        my.anaR = anaR;
        my.canvas = canvas;
        my.app = app;
        my.ctx = ctx;
        my.width = width;
        my.height = height;
        var script = document.createElement('script');
        script.onload = function() {
          var stats = new Stats();
          document.body.appendChild(stats.dom);
          requestAnimationFrame(
            function loop() {
              stats.update();
              requestAnimationFrame(loop)
            }
          );
        };
        //script.src = '//mrdoob.github.io/stats.js/build/stats.min.js';
        script.src = '//cdn.jsdelivr.net/gh/mrdoob/stats.js/build/stats.min.js';
        document.head.appendChild(script);
      }

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
      ctx.clearRect(0, 0, width, height);
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
