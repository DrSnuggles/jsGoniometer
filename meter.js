/*  Meter constructor by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

function meter(type) {
  //
  // Init
  //
  // supported types
  // gon := Goniometer
  // cor := Correlation meter
  // rms := ...
  this.type = type;
  this.bgLines = ['L','R','M','P','C100','C75','C50']; // Left,Right,Mono,Phase,Circle100%,Circle75%,Circle50%
  this.bgColor = [255, 255, 255, 1]; // background color std. white HTML, 4th value is used by fade to imitate CRT, but i don't like// use bgColor[3] to imitate CRT
  this.bgLineColor = [96, 0, 0, 0.5]; // color rgba for all meter lines
  this.color = [0, 96, 0, 1]; // color rgba
  this.ana;      // ATools.ana
  this.canvas = null;       // canvas for resizing
  this.ctx = null,          // 2D context for drawing, just get it once
  this.width = null;        // width of canvas = calced pixels
  this.height = null;       // height of canvas = calced pixels
  this.raf = null;          // ref to RAF, needed to cancel RAF
  this.corr = null;         // Correlation
  this.val = {'L':0,'R':0,'C':0,'LS':0,'RS':0}; // value foe example Root Mean Square of each channel if type = rms
  this.damp = 0.95;    // damping
  this.debug = false; // display console logs?

  //
  // Functions
  //
  this.log = function(out) {
    if (this.debug) console.log("Meter:", out);
  };
  this.renderLoop = function() {
    this.clearMeter();
    if (this.bgLines.length > 0) {
      this.drawBGlines();
    }
    this.drawMeter();
    this.raf = requestAnimationFrame(() => this.renderLoop());
  };
  this.clearMeter = function () {
    //log("clearMeter");
    // clear/fade out old
    if (this.bgColor.length > 0) {
      this.ctx.fillStyle = 'rgba('+this.bgColor[0]+', '+this.bgColor[1]+', '+this.bgColor[2]+', '+this.bgColor[3]+')';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height); // maybe useful for transparent mode
    }
  };
  this.drawBGlines = function() {
    //log("drawBGlines");
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba('+this.bgLineColor[0]+', '+this.bgLineColor[1]+', '+this.bgLineColor[2]+', '+this.bgLineColor[3]+')';
    this.ctx.beginPath();

    if (this.bgLines.indexOf("P") !== -1) {
      // x - axis
      this.ctx.moveTo(0, this.height/2);
      this.ctx.lineTo(this.width, this.height/2);
    }

    if (this.bgLines.indexOf("M") !== -1) {
      // y - axis
      this.ctx.moveTo(this.width/2, 0);
      this.ctx.lineTo(this.width/2, this.height);
    }

    if (this.bgLines.indexOf("L") !== -1) {
      // l - axis
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(this.width, this.height);
    }

    if (this.bgLines.indexOf("R") !== -1) {
      // r - axis
      this.ctx.moveTo(this.width, 0);
      this.ctx.lineTo(0, this.height);
    }

    // circles/ellipses
    if (this.bgLines.indexOf("C50") !== -1) {
      // 50%
      this.ctx.moveTo(this.width/2 + this.width/2 /2, this.height/2);
      this.ctx.ellipse(this.width/2, this.height/2, this.width/2 /2, this.height/2 /2, 0, 0, 2*Math.PI);
    }

    if (this.bgLines.indexOf("C75") !== -1) {
      // 75%
      this.ctx.moveTo(this.width/2 + this.width/2 /(4/3), this.height/2);
      this.ctx.ellipse(this.width/2, this.height/2, this.width/2 /(4/3), this.height/2 /(4/3), 0, 0, 2*Math.PI);
    }

    if (this.bgLines.indexOf("C100") !== -1) {
      // 100%
      this.ctx.moveTo(this.width/2 + this.width/2, this.height/2);
      this.ctx.ellipse(this.width/2, this.height/2, this.width/2, this.height/2, 0, 0, 2*Math.PI);
    }

    this.ctx.stroke(); // finally draw
  };
  this.drawMeter = function() {
    var dataL = new Float32Array(this.ana.L.frequencyBinCount);
    var dataR = new Float32Array(this.ana.R.frequencyBinCount);
    this.ana.L.getFloatTimeDomainData(dataL);
    this.ana.R.getFloatTimeDomainData(dataR);

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba('+this.color[0]+', '+this.color[1]+', '+this.color[2]+', '+this.color[3]+')';
    this.ctx.fillStyle = 'rgba('+this.color[0]+', '+this.color[1]+', '+this.color[2]+', '+this.color[3]+')';
    this.ctx.beginPath();
    var rotated;
    var barwidth = 10;
    var barheight = 10;
    var midH = this.width/2;
    var midV = this.height/2;
    var val = {
      L:0,
      R:0,
      C:0,
      LS:0,
      RS:0
    };

    switch (this.type) {
      case "gon":
        // move to start point
        rotated = this.rotate45deg(dataR[0], dataL[0]);  // Right channel is mapped to x axis
        this.ctx.moveTo(rotated.x * this.width + midH, rotated.y* this.height + this.height/2);

        // draw line
        for (var i = 1; i < dataL.length; i++) {
          rotated = this.rotate45deg(dataR[i], dataL[i]);
          this.ctx.lineTo(rotated.x * this.width + midH, rotated.y* this.height + this.height/2);
        }

        break;
      case "cor":
        // ToDo: orientation

        var corr = 0;
        // sum up corr
        for (var i = 0; i < dataL.length; i++) {
          // ToDo: just sum up L and R here
          rotated = this.rotate45deg(dataR[i], dataL[i]);
          rotated = this.rotate45deg(rotated.x, rotated.y);
          rotated = this.rotate45deg(rotated.x, rotated.y);
          corr += this.getCorr(rotated.x, rotated.y);
        }
        this.corr = (corr / dataL.length + this.corr*this.damp)/2.0;

        // now draw
        this.ctx.fillRect(this.corr * midH + midH - barwidth/2, 0, barwidth, this.height);

        break;
      case 'rms':
        // ToDo: orientation

        for (var i = 0; i < dataL.length; i++) {
          val.L += dataL[i] * dataL[i];
          val.R += dataR[i] * dataR[i];
        }
        val.L = Math.sqrt(val.L / dataL.length);
        val.R = Math.sqrt(val.R / dataL.length);
        this.val.L = Math.max(val.L, this.val.L*this.damp);
        this.val.R = Math.max(val.R, this.val.R*this.damp);

        // now draw
        this.ctx.fillRect(0, (1-this.val.L) * this.height, midH, this.height-this.val.L*this.height);
        this.ctx.fillRect(midH, (1-this.val.R) * this.height, midH, this.height-this.val.R*this.height);

        break;
      case 'db':

        break;
      case 'vu':
        val.L = this.getPeak(dataL) * (Math.E - 1);
        val.R = this.getPeak(dataR) * (Math.E - 1);

        this.val.L = Math.max(val.L, this.val.L*this.damp);
        this.val.R = Math.max(val.R, this.val.R*this.damp);

        // now draw
        this.ctx.fillRect(0, (1-this.val.L) * this.height, midH, this.height-((1-this.val.L)*this.height));
        this.ctx.fillRect(midH, (1-this.val.R) * this.height, midH, this.height-((1-this.val.R)*this.height));

        break;
      default:

    }

    this.ctx.stroke();
  };
  this.getCorr = function(x, y) {
    var radius = Math.sqrt((x * x) + (y * y));
    var angle = Math.atan2(y,x); // atan2 gives full circle
    return radius * angle;
  }
  this.rotate45deg = function(x, y) {
    var tmp = this.cartesian2polar(x, y);
    tmp.angle -= 0.78539816; // Rotate coordinate by 45 degrees
    var tmp2 = this.polar2cartesian(tmp.radius, tmp.angle);
    return {x:tmp2.x, y:tmp2.y};
  }
  this.cartesian2polar = function(x, y) {
    // Convert cartesian to polar coordinate
    var radius = Math.sqrt((x * x) + (y * y));
    var angle = Math.atan2(y,x); // atan2 gives full circle
    return {radius:radius, angle:angle};
  };
  this.polar2cartesian = function(radius, angle) {
    // Convert polar coordinate to cartesian coordinate
    var x = radius * Math.sin(angle);
    var y = radius * Math.cos(angle);
    return {x:x, y:y};
  };
  this.getPeak = function(buffer) {
		var len = buffer.length;
		var min = +Infinity;
		var max = -Infinity;

		for (var i = 0; i < len; i++) {
			var frame = buffer[i];
			if (frame < min) min = frame;
			else if (frame > max) max = frame;
		}

    return Math.max(Math.abs(min), Math.abs(min));
	}
  this.resizer = function() {
    //this.log("resizer");
    // check if our canvas was risized
    if ((this.width !== this.canvas.clientWidth) || (this.height !== this.canvas.clientHeight)) {
      this.width = this.canvas.width = this.canvas.clientWidth;
      this.height = this.canvas.height = this.canvas.clientHeight;
      this.log("canvas resized");
    }
  }
  this.start = function(source, drawcanvas) {
    this.log("Meter.start");

    this.ana = source;
    if (this.raf === null) {
      this.canvas = drawcanvas;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false; // faster
      this.resizer();
      // resizing, nicer than in loop, coz resize canvas clears it -> no nice fadeout possible
      addEventListener('resize', this.resizer);
      this.raf = requestAnimationFrame(() => this.renderLoop());
      this.log("Meter started");
    } else {
      this.log("Meter already running");
    }
  };
  this.stop = function() {
    this.log("Meter.stop");
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
      removeEventListener('resize', this.resizer);
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.log("Meter stopped");
    } else {
      this.log("Meter already stopped");
    }
  };
  this.setFFTsize = function(newSize) {
    this.ana.L.fftSize = this.ana.R.fftSize = newSize;
    this.log("Meter FFT size set to: "+ newSize);
  };

}
