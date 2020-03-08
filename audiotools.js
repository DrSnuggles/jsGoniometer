/*  Audio tools by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

var ATools = (function (my) {
  //
  // Init
  //
  var my = {    // public available settings
    ana: [],     // Analyser Nodes
    pos: 0
  },
  fft = 2048,   // fft Size
  ctx, // Audio context
  octx, // new try with another offline context
  source,   // SourceBufferNode
  splitter, // Splitter
  isLoading = false, // avoid multiple starts, still possible via DND ;)
  // new for waveform
  raf = requestAnimationFrame(renderLoop), // ReqAnimFrame
  sbuf,       // decodec SourceBufferArray
  canvas,
  cctx,       // canvas 2D context
  width = screen.width,   // waveform
  height = screen.height/2,// waveform
  wave,   // this is a save of generated waveform
  halfRange = false, // if true only upper half (0.5..1.0) of waveform is displayed
  startOffset = 0, // where are we pos in audio
  startTime = 0,
  duration = 0,
  channels,
  sampleRate,
  impulseResponseBuffer,
  integratedLoudness,
  waveDrS,
  loudness,
  psr,
  tpeak,
  pos,
  posF,
  max_true_peak,
  numWorkers = 0,
  readyWorkers = 0,
  workerProgress = [0, 0, 0],
  waveType = 0, // DrS, Loudness, PSR
  data = [], // really needed????? does getChannelData take long????
  dataTP = [],
  dataFS = [],
  fAna = {}, // file Analyser, looks like i need something like that
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

    // info (memory+clock)
    var mem = my.formatBytes(performance.memory.usedJSHeapSize);// +' / '+ my.formatBytes(performance.memory.totalJSHeapSize) +' / '+ my.formatBytes(performance.memory.jsHeapSizeLimit);
    var now = new Date();
    now = now.toLocaleTimeString();
    info.innerHTML = now +'<br/>'+ mem;

    // not running --> exit
    if (typeof wave === "undefined") return;

    // clear old
    cctx.clearRect(0, 0, width, height);
    // draw bg = previously created wave
    cctx.putImageData(wave, 0, 0, 0, 0, wave.width, wave.height);
    // draw position
    if (source.buffer) {
      pos = source.context.currentTime - startTime + startOffset;
      my.pos = Math.floor(pos * sampleRate);
      posF = ((pos) / duration);
      cctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      cctx.fillRect(0, 0, posF*width, height);
      // audio info (samplerate pos/len)
      if (pos > duration) pos = duration;
      ainfo.innerHTML = formatTime(pos) +' / '+ formatTime(duration) +'<br/>'+ my.ana.length +'ch @'+fAna.srate/1000 +'kHz -> '+source.buffer.sampleRate/1000 +'kHz';
    }
  };
  function formatTime(s) {
    return new Date(1000 * s).toISOString().substr(11, 8) + (s % 1).toFixed(2).substr(1);
  };
  function loadConvolver() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'audio/3sec-1-mono_44100.wav', true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      ctx.decodeAudioData(xhr.response, function(buf) {
        impulseResponseBuffer = buf;
      }, function(e){
        log("Convolver problem");
      });
    }
    xhr.send();
  };
  function deepAnal(buf) {
    log("deepAnal");

    // the resampled area
    channels = buf.numberOfChannels;
    sampleRate = buf.sampleRate; // this is the already resampled rate !!!

    // save resampled buffer per channel
    data = [];
    for (let i = 0; i < channels; i++) {
      data.push( buf.getChannelData(i) );
    }
    duration = data[0].length / sampleRate;

    readyWorkers = numWorkers = 0;
    calc_IL(buf);
    calc_loudness(buf);

    // own offline context with original data not resampled
    octx = new OfflineAudioContext(channels, duration * fAna.srate, fAna.srate);
  	var source = octx.createBufferSource();
  	source.buffer = buf;
    source.connect(octx.destination);
  	source.start();
  	octx.startRendering().then(function(renderedBuffer) {
  		log('OCTX Rendering completed successfully');
      //log(renderedBuffer);
      data = [];
      dataFS = [];
      for (let i = 0; i < channels; i++) {
        data.push( renderedBuffer.getChannelData(i) );
        dataFS.push([]);
      }
      //duration = data[0].length / srate;
      //var millis = Math.ceil(duration * 1000);
      var framesize = fAna.srate / 100; // 44100 / 100 = 441
      //console.log(data[0].length, framesize, data[0].length/framesize);
      var framecount = 0;
      var framesum = new Array(channels).fill(0);

      var res = []; // result array for the drawwave peak diagram
      var peak;
      var chPeaks = new Array(channels).fill(0);
      var chMin = new Array(channels).fill(+Infinity);
      var chMax = new Array(channels).fill(-Infinity);
      //console.log(dataFS);
      for (var i = 0; i < data[0].length; i++) {
        peak = 0;
        for (var j = 0; j < channels; j++) {
          var val = Math.abs(data[j][i]);
          framesum[j] += val;
          if (val >= 1.0) chPeaks[j] += 1;
          if (val < chMin[j]) chMin[j] = val;
          if (val > chMax[j]) chMax[j] = val;
          peak = Math.max(peak, val);
        }
        res.push( peak );
        framecount++;
        if (framecount > framesize) {
          //console.log(framecount, i, framesum[0]/framesize, framesum[1]/framesize);
          for (var j = 0; j < channels; j++) {
            //console.log(j, framesum[j]/framesize);
            dataFS[j].push(framesum[j]/framesize);
            framesum[j] = 0;
          }
          framecount = 0;
        }
      }
      //console.log(i, i/framesize);
      for (var i = 0; i < channels; i++) {
        console.info("Channel "+ i +" found Min="+ chMin[i] +" = "+ absoluteValueToDBFS(chMin[i]).toFixed(2) +"dB Max="+ chMax[i] + " = "+ absoluteValueToDBFS(chMax[i]).toFixed(2) +"dB #Peaks="+ chPeaks[i]);
      }
      // make wave data smaller
      // give each pixel 2 datas
      var group = Math.floor( res.length / width );
      log("group width: "+ group);
      var res2 = [];
      for (let i = 0; i < width; i++) {
        var maxi = 0;
        for (let j = group*i; j < group*(i+1); j++) {
          if (res[j] > maxi) maxi = res[j];
        }
        res2.push(maxi);
      }
      waveDrS = res2;
      drawWave(res2);
      playAudio(sbuf, 0);
    });


    // try peak first, we will need it
    // worker are not effective since we want to wait to have all that values
    // will resample up to max but 4x is not guaranteed
    // and we have to do this for each channel

    //calc_tpeak_local(); // since this oversamples to max 192000 it takes most time
    //calc_tpeak(buf);

    // should also be a worker
    // since we are here more interested in finding peaks i decided to make one single waveform
    // with max of absolute values of all channels. never seen before :)
    // i have values here which are out of bounds / of spec
    // https://stackoverflow.com/questions/51252732/javascript-getchanneldata-some-out-of-bounds
    // not 100% sure but think this is caused by some 32bit float conversion ? also not sure what browsers are doing. clamp??
    // i will keep them and get used to values up to +6dbFS
    // https://stackoverflow.com/questions/58136614/how-to-get-channel-data-directly-from-arraybuffer-without-web-audio-api
    // OK, getChannelData respectively decodeAudio provides me with already resampled data (depends on my Win settings)
    // thats not exactely what i wanted....
    // all sample rate conversion is then not ideal since it doubles resampleing and failures
    // shows how to fetch just a range of data: https://stackoverflow.com/questions/33428990/determining-the-sample-rate-of-a-large-audio-file-in-javascript
    // https://github.com/WebAudio/web-audio-api/issues/30
    // YES YES YES.. i have filesize, channels and duration -> samplerate for WAVs only
    // for MP3, FLAC, OGG maybe i will find in TAGs


  };
  function calc_IL(buf) {
    /* INTEGRATED LOUDNESS */

  	//get an audioBuffer, in which EBU-S values are stored
  	//do not resample
  	var targetSampleRate = sampleRate;
  	var OAC_IL = new OfflineAudioContext(channels, duration * targetSampleRate, targetSampleRate);
  	var source = OAC_IL.createBufferSource();
  	source.buffer = buf;

  	var splitter = OAC_IL.createChannelSplitter(channels);
  	var merger = OAC_IL.createChannelMerger(channels);

  	//first stage shelving filter
  	var highshelf_filter = OAC_IL.createBiquadFilter();
  	highshelf_filter.type = "highshelf";
  	highshelf_filter.Q.value = 1;
  	highshelf_filter.frequency.value = 1500;
  	highshelf_filter.gain.value = 4;

  	// second stage highpass filter
  	var highpass_filter = OAC_IL.createBiquadFilter();
  	highpass_filter.frequency.value = 76;
  	highpass_filter.Q.value = 1;
  	highpass_filter.type = "highpass";

  	//SQUARING EVERY CHANNEL
  	var square_gain = OAC_IL.createGain();
  	square_gain.gain.value = 0;

  	//CONNECTING EBU GRAPH
  	source
  	.connect(highshelf_filter)
  	.connect(highpass_filter)
  	.connect(square_gain);
  	highpass_filter.connect(square_gain.gain);
  	square_gain.connect(OAC_IL.destination);

  	source.start();

  	OAC_IL.startRendering().then(function(renderedBuffer) {
  		log('IL Rendering completed successfully');
  		var signal_filtered_squared = [];
      for (let i = 0; i < channels; i++) {
        signal_filtered_squared.push( renderedBuffer.getChannelData(i) );
      }

  		var il_worker = new Worker("workers/integrated-loudness.js");
  		//compute integrated loudness
  		il_worker.postMessage({
  			buffers: signal_filtered_squared,
  			duration: duration
  		});
      numWorkers++;

  		il_worker.onmessage = function(e) {
  			var data = e.data;
  			if (data.type == "finished"){
  				log("ILW finished! Integrated loudness: " + data.integratedLoudness + " LUFS");
  				integratedLoudness = data.integratedLoudness;
          readyWorkers++;
  			}
        if (data.type == "progress"){
          workerProgress[0] = data.progress;
          logProgress();
        }

  		}
  	});

  }; // worker version
  function calc_loudness(buf) {
    	//do not resample
    	var targetSampleRate = sampleRate;
    	var OAC = new OfflineAudioContext(channels, duration * targetSampleRate, targetSampleRate);
    	var source = OAC.createBufferSource();
    	source.buffer = buf;

    	var ebu_splitter = OAC.createChannelSplitter(2);

    	//first stage shelving filter
    	var highshelf_filter_L = OAC.createBiquadFilter();
    	highshelf_filter_L.type = "highshelf";
    	highshelf_filter_L.Q.value = 1;
    	highshelf_filter_L.frequency.value = 1500;
    	highshelf_filter_L.gain.value = 4;

    	var highshelf_filter_R = OAC.createBiquadFilter();
    	highshelf_filter_R.type = "highshelf";
    	highshelf_filter_R.Q.value = 1;
    	highshelf_filter_R.frequency.value = 1500;  //deduced with IIRFilter.getFrequencyResponse
    	highshelf_filter_R.gain.value = 4;

    	// second stage highpass filter
    	var highpass_filter_L = OAC.createBiquadFilter();
    	highpass_filter_L.frequency.value = 76;
    	highpass_filter_L.Q.value = 1;
    	highpass_filter_L.type = "highpass";

    	var highpass_filter_R = OAC.createBiquadFilter();
    	highpass_filter_R.frequency.value = 76;
    	highpass_filter_R.Q.value = 1;
    	highpass_filter_R.type = "highpass";

    	//SQUARING EVERY CHANNEL
    	var ebu_square_gain_L = OAC.createGain();
    	ebu_square_gain_L.gain.value = 0;

    	var ebu_square_gain_R = OAC.createGain();
    	ebu_square_gain_R.gain.value = 0;

    	var ebu_convolver_L = OAC.createConvolver();
    	ebu_convolver_L.normalize = false;
    	var ebu_convolver_R = OAC.createConvolver();
    	ebu_convolver_R.normalize = false;

    	ebu_convolver_L.buffer = impulseResponseBuffer;
    	ebu_convolver_R.buffer = impulseResponseBuffer;

    	var ebu_mean_gain_L = OAC.createGain();
    	ebu_mean_gain_L.gain.value = 1/(OAC.sampleRate * 3);
    	var ebu_mean_gain_R = OAC.createGain();
    	ebu_mean_gain_R.gain.value = 1/(OAC.sampleRate * 3);

    	var ebu_channel_summing_gain = OAC.createGain();

    	var ebu_s_analyzer = OAC.createAnalyser();
    	ebu_s_analyzer.fftSize = 2048;

    	//CONNECTING EBU GRAPH
    	source.connect(ebu_splitter);
    	ebu_splitter.connect(highshelf_filter_L, 0, 0);
    	ebu_splitter.connect(highshelf_filter_R, 1, 0);

    	highshelf_filter_L.connect(highpass_filter_L);
    	highshelf_filter_R.connect(highpass_filter_R);

    	highpass_filter_L.connect(ebu_square_gain_L);
    	highpass_filter_L.connect(ebu_square_gain_L.gain);

    	highpass_filter_R.connect(ebu_square_gain_R);
    	highpass_filter_R.connect(ebu_square_gain_R.gain);

    	ebu_square_gain_L.connect(ebu_convolver_L).connect(ebu_mean_gain_L);
    	ebu_square_gain_R.connect(ebu_convolver_R).connect(ebu_mean_gain_R);

    	ebu_mean_gain_L.connect(ebu_channel_summing_gain);
    	ebu_mean_gain_R.connect(ebu_channel_summing_gain);

    	ebu_channel_summing_gain.connect(OAC.destination);

    	source.start();

    	OAC.startRendering().then(function(renderedBuffer) {
    		log('Loudness Rendering completed successfully');
    		var ebu_buffer = renderedBuffer.getChannelData(0);
    		var worker = new Worker("workers/loudness.js");
    		worker.postMessage({
    			ebu_buffer: ebu_buffer,
    			untouched_buffers: data,
    			width: width
    		});
        numWorkers++;
    		log('Data to analyse posted to worker');

    		worker.onmessage = function(e) {
    			var data = e.data;
    			if (data.type == "finished"){
    				log('Message received from loudness worker');
    				loudness = data.loudness;
    				psr = data.psr;
            //console.log(psr);
    				//drawLoudnessDiagram(loudness);
    				//drawPSRDiagram(psr);
            readyWorkers++;
    			}
    			if (data.type == "progress"){
    				workerProgress[1] = data.progress;
            logProgress();
    			}
    		};
    	});
  }; // worker version
  function calc_tpeak(buf) {
  	//True-peak context
  	//oversample to 192000 Hz
  	var targetSampleRate = 192000;
  	var OAC_TP = new OfflineAudioContext(channels, duration * targetSampleRate, targetSampleRate);
  	var source = OAC_TP.createBufferSource();
  	source.buffer = buf;
  	source.start();

  	var gain = OAC_TP.createGain();
  	gain.gain.value = 0.5;

  	var lp_filter = OAC_TP.createBiquadFilter()
  	lp_filter.type = "lowpass";
  	lp_filter.frequency.value = 20000;

  	source.connect(gain).connect(lp_filter).connect(OAC_TP.destination);

  	OAC_TP.startRendering().then(function(renderedBuffer) {
  		log('OAC_TP rendering completed successfully');
  		var buffers = [renderedBuffer.getChannelData(0)];
  		if (renderedBuffer.channelCount > 1){
  			buffers.push(renderedBuffer.getChannelData(1));
  		}
  		var worker = new Worker("workers/true-peak.js");
  		worker.postMessage({
  			buffers: buffers,
  			width: width
  		});
      numWorkers++;
  		log('True peak: Data to analyse posted to worker');

  		worker.onmessage = function(e) {
  			var data = e.data;
  			if (data.type == "finished"){
  				log('True peak: Worker has finished');
  				log("Maximum detected value: " + data.max + " dBTP");
  				max_true_peak = data.max;
  				tpeak = data.true_peak;
  			}
  			if (data.type == "progress"){
  				workerProgress[2] = data.progress;
          logProgress();
  			}
  		};
  	});
  }; // worker version
  function calc_tpeak_local() {
    //True-peak context
    //oversample to 192000 Hz
    //^^ thats max but 4x is not guaranteed
    var targetSampleRate = sampleRate;// 192000;
    var OAC_TP = new OfflineAudioContext(channels, duration * targetSampleRate, targetSampleRate);
    var source = OAC_TP.createBufferSource();
    source.buffer = sbuf;
    source.start();

    var gain = OAC_TP.createGain();
    gain.gain.value = 0.5;

    var lp_filter = OAC_TP.createBiquadFilter()
    lp_filter.type = "lowpass";
    lp_filter.frequency.value = 20000;

    source.connect(gain).connect(lp_filter).connect(OAC_TP.destination);

    OAC_TP.startRendering().then(function(renderedBuffer) {
      log('OAC_TP rendering completed successfully');
      var data_tp = [];
      for (let c = 0; c < channels; c++) {
        data_tp.push( renderedBuffer.getChannelData(c) );
      }

      var restoreGain = 20 * Math.log10(1/0.5); // compensate Gain = 50% with ~+6dB
      dataTP = []; // output
      // let's calculate a true peak value for each channel !!
      for (var c = 0; c < channels; c++) {
        log("Start analysing channel "+ c);
        dataTP.push( [] );
        // and for each sample
        for (var i = 0; i < data_tp[0].length; i++) {
          var value_db = absoluteValueToDBFS(Math.abs(data_tp[c][i])) + restoreGain; //restore original gain
          dataTP[c][i] = value_db;
          if (isNaN(value_db)) {
            log("Sample "+ i +" channel "+ c + " = "+ value_db + " data: "+ data[c][i] + " DBFS "+ absoluteValueToDBFS(data[c][i]));
          } else {
            if (i % (10*sampleRate) == 0)
              log("Channel "+ c +" Progress "+ (i/data_tp[0].length*100).toFixed(3) +"%");
          }
        }

      }
      log("Calc finished");
      //log(dataTP);
      //playAudio(sbuf, 0);
    });
  };
  function absoluteValueToDBFS(value){
    var ret = 20 * Math.log10(value);
    ret = Math.max(ret, -180);
  	return ret;
  }
  function drawWave(buf) {
    log("drawWave");
    //screen.availWidth * 2;
    // now draw them all, quite too much... i know
    // to have better resolution in peak are i dismiss lower half of val range
    cctx.lineWidth = 1;
    cctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    cctx.clearRect(0, 0, width, height);
    cctx.beginPath();
    cctx.moveTo(0, (1-buf[0])* height);
    for (var i = 1; i < buf.length; i++) {
      if (halfRange) {
        cctx.lineTo(i/buf.length*width, (1-(buf[i]-0.5)*2)*height); // half range
      } else {
        cctx.lineTo(i/buf.length*width, (1-buf[i])*height); // full range
      }
    }
    cctx.stroke();

    // now save this for later reuse
    waveType = 0;
    wave = cctx.getImageData(0, 0, width, height);
  };
  function drawLoudnessDiagram(vals) {
    cctx.clearRect(0, 0, width, height);
  	//calculate RMS for every pixel
    cctx.lineWidth = 1;
    cctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';

  	for (var i = 0; i < width; i++){
  		cctx.beginPath();

  		//typical crest factors are -20 to -3 dbFS
  		var lineHeight = height * ((vals[i] + 30) / 30);

  		cctx.moveTo(i, height);
  		cctx.lineTo(i, height - lineHeight);
  		cctx.stroke();
  	}

    // now save this for later reuse
    waveType = 1;
    wave = cctx.getImageData(0, 0, width, height);

  };
  function drawPSRDiagram(vals) {
    cctx.clearRect(0, 0, width, height);
  	//calculate RMS for every pixel
  	for (var i = 0; i < width; i++){
  		cctx.beginPath();
  		cctx.lineWidth = 1;
  		var psr_value = vals[i];
  		cctx.strokeStyle = getPSRColor(psr_value);

  		//typical values in pop music are 20 to 3 LU
  		var lineHeight = height * ((psr_value - 2) / 17);

  		cctx.moveTo(i, height);
  		cctx.lineTo(i, height - lineHeight);
  		cctx.stroke();
  	}

    // now save this for later reuse
    waveType = 2;
    wave = cctx.getImageData(0, 0, width, height);

  };
  function getPSRColor(psr_value) {
		var color;

		if (psr_value < 5){
			color = '#000000';  //black
		} else if (psr_value < 6){
			color = '#770000';  //dark red
		} else if (psr_value < 7){
			color = '#ff0000';  //red
		} else if (psr_value < 7.5){
			color = '#ff4500';  //orangered
		} else if (psr_value < 8){
			color = '#ffa500';  //orange
		} else if (psr_value < 8.5){
			color = '#ffc500';  //brighter orange
		} else if (psr_value < 9.5){
			color = '#ffff00';  //yellow
		} else if (psr_value < 11){
			color = '#b4ff00';  //yellow green
		} else {
			color = '#00ff00';  //lime green
		}

		return color;

	};
  function logProgress() {
    /*
    var total = 0;
    for (let i = 0; i < workerProgress.length; i++) {
      total += workerProgress[i];
    }
    total = total / workerProgress.length;
    log("Workers Progress: "+ total.toFixed(1) +"%");
    */
  };
  function getLoudness() {
  	return Math.round(10 * (loudness[Math.round(posF * loudness.length)])) / 10;
  };
  function getPSR() {
  	return Math.round(10 * psr[Math.round(posF * psr.length)]) / 10;
  };
  function getDBTP(c) {
    //if (typeof tpeak == "undefined" || posF >= 1) return -200;
    //return Math.round(10 * tpeak[Math.round(posF * tpeak.length)]) / 10; // old method via worker
    if (dataTP.length === 0) return -120;
    var x = Math.floor(dataTP[0].length/data[0].length * pos * sampleRate) - 1;
    return dataTP[c][x];
  };
  function getDBFS(c) {
    // idea is to have a db value for each 1/100 second
    var x = Math.floor(pos * 100) - 1;
    if (dataFS.length === 0 || typeof dataFS[c] == "undefined" ) return 1/1000000000; // -180db
    //console.log(dataFS[c][x], typeof dataFS[c][x]);
    return dataFS[c][x];
  };
  function jumpTo(e) { // LMB on waveform
    pos = Math.floor(e.offsetX / canvas.clientWidth * duration);
    try {
      my.stopAudio();
    } catch(e){
      // was stopped
    }
    // have to reinit audio
    splitAudio(sbuf, pos);
  };
  function changeWaveType(e) { // RMB on waveform
    e.preventDefault();
    waveType = (waveType+1) % 3;
    switch (waveType) {
      case 0:
        my.drawWave(waveDrS);
        break;
      case 1:
        my.drawLoudnessDiagram(loudness);
        break;
      case 2:
        my.drawPSRDiagram(psr);
        break;
      default:
    }
  };
  function splitAudio(buf, pos) {
    log("Loaded audio will be played back with "+ buf.numberOfChannels +" channels @"+ buf.sampleRate/1000.0 +"kHz");
    log("Destination supports up to "+ ctx.destination.maxChannelCount +" channels");

    var jumped = true;
    if (sbuf !== buf) {
      log("Buffer changed");
      sbuf = buf;
      deepAnal(buf);
      jumped = false;
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
    if (jumped) playAudio(buf, pos);
  };
  function playAudio(buf, pos) {
    source.buffer = buf;
    //duration = source.buffer.duration;
    startTime = ctx.currentTime;
    startOffset = pos;
    source.start(pos, startOffset % duration);
    log("Audio playback started");
    isLoading = false; // as late as possible
  };
  /*
  function swap16(val) {
    return ((val & 0xFF) << 8)
           | ((val >> 8) & 0xFF);
  };
  function swap32(val) {
    return ((val & 0xFF) << 24)
           | ((val & 0xFF00) << 8)
           | ((val >> 8) & 0xFF00)
           | ((val >> 24) & 0xFF);
  };
  */

  //
  // Public
  //
  my.absoluteValueToDBFS = absoluteValueToDBFS;
  my.drawLoudnessDiagram = drawLoudnessDiagram; // needed in RMB event
  my.drawPSRDiagram = drawPSRDiagram; // needed in RMB event
  my.drawWave = drawWave; // needed in RMB event
  my.getDBTP = getDBTP;
  my.getDBFS = getDBFS;
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
  };
  my.decodeAudio = function(buf) {
    log("decodeAudio");
    my.stopAudio();

    // have plain file reader buffer and will try to identify
    fAna = ATools.getSamplerate(buf);
    log("Found "+ fAna.fType +" with "+ fAna.numChannels +" Channels @ "+ (fAna.srate/1000).toFixed(1)+"kHz with "+ fAna.bitsPerSample + " bits and bitrate of "+ fAna.bitrate);

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
  my.setFFTsize = function(newSize) {
    fft = newSize;
    for (var i = 0; i < my.ana.length; i++) {
      my.ana[i].fftSize = fft;
    }
    log("FFT size set to: "+ fft);
  };
  my.init = function() {
    ctx = new AudioContext(); // even that is not late enough
    loadConvolver();

    canvas = waveform;
    cctx = canvas.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    canvas.width = width;
    canvas.height = height;
    canvas.onclick = jumpTo;
    canvas.oncontextmenu = changeWaveType;

  };

  //
  // Exit
  //
  return my;
}(ATools || {}));
