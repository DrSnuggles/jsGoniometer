/*  Audio tools by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

var ATools = (function () {
  //
  // Init
  //
  var my = {    // public available settings
    ana: []     // Analyser Nodes
  },
  fft = 2048,   // fft Size
  ctx = new AudioContext(), // Audio context
  source,   // Source
  splitter, // Splitter
  isLoading = false, // avoid multiple starts, still possible via DND ;)
  // new for waveform
  raf = null, // ReqAnimFrame
  sbuf,
  cctx,
  canvas,
  width,
  height,
  wave,   // this is a save of generated waveform
  startOffset = 0, // where are we pos in audio
  startTime = 0,
  duration = 0,
  // finally display console logs?
  debug = false;

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("ATools:", out);
    if (document.getElementById("stat")) document.getElementById("stat").innerText = out;
  };
  function renderLoop() {
    raf = requestAnimationFrame(renderLoop);
    // clear old
    cctx.clearRect(0, 0, width, height);
    // draw bg = previously created wave
    cctx.putImageData(wave, 0, 0, 0, 0, wave.width, wave.height);
    // draw position
    if (source.buffer) {
      var pos = ((source.context.currentTime -startTime +startOffset) / duration);
      cctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      cctx.fillRect(0, 0, pos*width, height);
    }
  };
  function drawWave(buf) {
    log("drawWave");
    // since we are here more interested in finding peaks i decided to make one single waveform
    // with max of absolute values of all channels. never seen before :)
    var channels = buf.numberOfChannels;
    var data = [];
    var res = []; // result array
    var peak;
    for (var i = 0; i < channels; i++) {
      data.push( buf.getChannelData(i) );
    }
    for (var i = 0; i < data[0].length; i++) {
      peak = 0;
      for (var j = 0; j < channels; j++) {
        peak = Math.max(peak, Math.abs(data[j][i]));
      }
      res.push( peak );
    }

    // now draw them all, quite too much... i know
    cctx.lineWidth = 1;
    cctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    cctx.clearRect(0, 0, width, height);
    cctx.beginPath();
    cctx.moveTo(0, (1-res[0])* height);
    for (var i = 1; i < res.length; i++) {
      cctx.lineTo(i/res.length*width, (1-res[i])*height);
    }
    cctx.stroke();

    // now save this for later reuse
    wave = cctx.getImageData(0, 0, width, height);
  }
  function resizer() {
    // check if our canvas was resized
    if ((width !== canvas.clientWidth) || (height !== canvas.clientHeight)) {
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
      log("canvas resized");
      drawWave( sbuf );
      return true;
    }
    return false;
  }
  function jumpTo(e) {
    var pos = Math.floor(e.offsetX / waveform.clientWidth * duration);
    try {
      my.stopAudio();
    } catch(e){
      // was stopped
    }
    // have to reinit audio
    splitAudio(sbuf, pos);
  }

  function splitAudio(buf, pos) {
    log("Loaded audio has "+ buf.numberOfChannels +" channels @"+ buf.sampleRate/1000.0 +"kHz");
    log("Destination supports up to "+ ctx.destination.maxChannelCount +" channels");

    // draw wave if waveform is found
    if (document.getElementById("waveform")) {
      canvas = waveform;
      cctx = canvas.getContext('2d');
      cctx.imageSmoothingEnabled = true;
      sbuf = buf;
      if (!resizer()) drawWave(buf); //only if we dont do that in resizer
      if (raf === null) {
        // first time init
        onresize = resizer;
        canvas.onclick = jumpTo;
        raf = requestAnimationFrame(renderLoop);
      }
    }

    // Routing: Source --> Splitter --> Analyser
    //          Source --> Destination

    // Source
    source = ctx.createBufferSource();

    // Splitter
    splitter = ctx.createChannelSplitter( buf.numberOfChannels );
    source.connect(splitter); // Input --> Splitter

    // Analyzers
    my.ana = [];  // clear old analyzers
    for (var i = 0; i < buf.numberOfChannels; i++) {
      my.ana.push( ctx.createAnalyser() );
      my.ana[i].fftSize = fft;
      my.ana[i].smoothingTimeConstant = 0.0;
      splitter.connect(my.ana[i], i, 0); // Route each single channel from Splitter --> Analyzer
    }

    source.connect(ctx.destination); // we also want to hear audio
    playAudio(buf, pos);
  };
  function playAudio(buf, pos) {
    source.buffer = buf;
    duration = source.buffer.duration;
    startTime = ctx.currentTime;
    startOffset = pos;
    source.start(pos, startOffset % duration);
    log("Audio playback started");
    isLoading = false; // as late as possible
  };

  //
  // Public
  //
  my.log = log;
  my.loadAudio = function(url) {
    log("loadAudio: "+ url);
    if (isLoading) return false; // user already started to load, maybe i will abort old load... ToDo
    isLoading = true; // as soon as possible
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      log("Audio loaded");
      my.decodeAudio(xhr.response);
    }
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        var perc = e.loaded / e.total * 100;
        log("Progress: "+ perc.toFixed(1) + "%");
      } else {
        log("Progress: "+ my.formatBytes(e.loaded));
      }
    }
    xhr.send();
  };
  my.formatBytes = function(bytes) {
    // b, kB, MB, GB
    var kilobytes = bytes/1024;
    var megabytes = kilobytes/1024;
    var gigabytes = megabytes/1024;
    if (gigabytes>1) return gigabytes.toFixed(2) +' GB';
    if (megabytes>1) return megabytes.toFixed(2) +' MB';
    if (kilobytes>1) return kilobytes.toFixed(2) +' kB';
    return bytes +' b';
  }
  my.decodeAudio = function(buf) {
    log("decodeAudio");
    my.stopAudio();
    ctx.decodeAudioData(buf, function(buf) {
      splitAudio(buf, 0); // start from beginning
    }, function(e){
      //console.error(e);
      log("Unable to decode audio");
    });
  };
  my.stopAudio = function() {
    if (!source) return; // nothing to stop
    log("stopAudio");
    // stop playback
    source.buffer = null;
    source.stop();
    startOffset += ctx.currentTime - startTime;
    // disconnect everything
    try {
      source.disconnect(splitter);
      for (var i = 0; i < my.ana.length; i++) {
        splitter.disconnect(my.ana[i], i, 0);
      }
    } catch(e) {
      // mostly because audio already ended
      log("Audio was already disconnected");
    }
  };
  my.setFFTsize = function (newSize) {
    fft = newSize;
    for (var i = 0; i < ATools.ana.length; i++) {
      ATools.ana[i].fftSize = fft;
    }
    log("FFT size set to: "+ fft);
  };


  //
  // Exit
  //
  return my;
})();
