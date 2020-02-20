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
  this.canvas = null;       // canvas for resizing
  this.ctx = null,          // 2D context for drawing, just get it once
  this.width = null;        // width of canvas = calced pixels
  this.height = null;       // height of canvas = calced pixels
  this.raf = null;          // ref to RAF, needed to cancel RAF
  this.corr = null;         // Correlation
  this.val = [];            // values for each channel which we are interesed in e.g. Root Mean Square
  this.damp = 0.95;         // damping
  this.label = ['L','R','C','LFE','Ls','Rs','Lb','Rb']; // for channel labeling
  this.debug = false; // display console logs?

  //
  // Functions
  //
  this.log = function(out) {
    if (this.debug) console.log("Meter:", out);
  };
  this.renderLoop = function() {
    this.raf = requestAnimationFrame(() => this.renderLoop());
    this.clearMeter();
    if (this.bgLines.length > 0) {
      this.drawBGlines();
    }
    this.drawMeter();
  };
  this.clearMeter = function() {
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
    var cnt = ATools.ana.length; // channel count
    if (cnt === 0) return; // no channels --> no meter
    var data = [];
    for (var i = 0; i < cnt; i++) {
      data.push( new Float32Array(ATools.ana[0].frequencyBinCount) );
      //if (this.type === "gon") {
        ATools.ana[i].getFloatTimeDomainData(data[i]);
      //} else {
      //  ATools.ana[i].getFloatFrequencyData(data[i]);
      //}
    }

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba('+this.color[0]+', '+this.color[1]+', '+this.color[2]+', '+this.color[3]+')';
    this.ctx.fillStyle = 'rgba('+this.color[0]+', '+this.color[1]+', '+this.color[2]+', '+this.color[3]+')';
    this.ctx.beginPath();
    var rotated;
    //var barheight = 10;
    var barwidth = this.width/cnt ; // used for vu meters, corr meter has own
    var midH = this.width/2;
    var midV = this.height/2;
    var padding = 4; // corr meter
    var val = new Array(cnt).fill(0);
    if (this.val.length !== val.length) {
      // channel count changed
      this.val = val;
    }

    var gradientV = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradientV.addColorStop(1,'#000000');
    gradientV.addColorStop(0.75,'#00FF00');
    gradientV.addColorStop(0.25,'#FFFF00');
    gradientV.addColorStop(0.1,'#FF0000');

    var gradientH = this.ctx.createLinearGradient(0, 0, this.width, 0);
    //gradientH.addColorStop(1,'#FF0000');
    //gradientH.addColorStop(0.6,'#FFFF00');
    gradientH.addColorStop(0.5,'#00FF00');
    gradientH.addColorStop(0.4,'#FFFF00');
    gradientH.addColorStop(0,'#FF0000');

    switch (this.type) {
      case "gon":
        // Correlation = Phase * Magnitude
        // Magnitude = (L^2 + R^2)^1/2
        // Phase = arctan(L/R)
        // move to start point
        var x = (data[1]) ? data[1][0] : 0; // take care of single channel signals
        rotated = this.rotate45deg(x, data[0][0]);  // Right channel is mapped to x axis
        this.ctx.moveTo(rotated.x * this.width + midH, rotated.y* this.height + this.height/2);

        // draw line
        for (var i = 1; i < data[0].length; i++) {
          x = (data[1]) ? data[1][i] : 0; // take care of single channel signals
          rotated = this.rotate45deg(x, data[0][i]);
          this.ctx.lineTo(rotated.x * this.width + midH, rotated.y* this.height + this.height/2);
        }

        break;
      case "cor":
        barwidth = this.width/30; // corr meter
        this.ctx.fillStyle = gradientH;

        var corr = 0;
        var x;
        // sum up corr
        for (var i = 0; i < data[0].length; i++) {
          x = (data[1]) ? data[1][i] : data[0][i]; // take care of single channel signals, for corr use same data
          corr += this.getCorr(x, data[0][i]);
        }
        corr = corr / data[0].length;
        this.corr = (corr + this.corr*this.damp)/2.0;

        this.ctx.fillRect(this.corr * midH + midH - barwidth/2, padding, barwidth, this.height-(2*padding));

        break;
      case "pan":
        // ToDo: orientation
        barwidth = this.width/30; // corr meter

        var corr = 0;
        var x;
        // sum up corr
        for (var i = 0; i < data[0].length; i++) {
          // ToDo: just sum up L and R here
          x = (data[1]) ? data[1][i] : 0; // take care of single channel signals
          rotated = this.rotate45deg(x, data[0][i]);
          rotated = this.rotate45deg(rotated.x, rotated.y);
          rotated = this.rotate45deg(rotated.x, rotated.y);
          corr += this.getCorr(rotated.x, rotated.y);
        }
        corr = corr / data[0].length;
        this.corr = (corr + this.corr*this.damp)/2.0;
        // now draw
        this.ctx.fillStyle = gradientH;
        this.ctx.fillRect(this.corr * midH + midH - barwidth/2, padding, barwidth, this.height-(2*padding));
        //this.ctx.fillRect(0, 0, this.width, this.height);

        break;
      case 'peak':
        this.ctx.fillStyle = gradientV;
        for (var i = 0; i < cnt; i++) {
          val[i] = this.getPeak(data[i]) * (Math.E - 1);
          this.val[i] = Math.max(val[i], this.val[i]*this.damp);
          this.ctx.fillRect(barwidth*i+padding, (1-this.val[i]) * this.height, barwidth-2*padding, this.height-((1-this.val[i])*this.height));
        }
        break;
      case 'avg':
        this.ctx.fillStyle = gradientV;
        for (var i = 0; i < cnt; i++) {
          val[i] = this.getAvg(data[i]);// * (Math.E - 1);
          this.val[i] = Math.max(val[i], this.val[i]*this.damp);
          this.ctx.fillRect(barwidth*i+padding, (1-this.val[i]) * this.height, barwidth-2*padding, this.height-((1-this.val[i])*this.height));
        }
        break;
      case 'rms':
        this.ctx.fillStyle = gradientV;
        for (var i = 0; i < cnt; i++) {
          for (var j = 0; j < data[0].length; j++) {
            val[i] += data[i][j] * data[i][j];
          }
          val[i] = Math.sqrt(val[i] / data[0].length);
          this.val[i] = Math.max(val[i], this.val[i]*this.damp);
          this.ctx.fillRect(barwidth*i+padding, (1-this.val[i]) * this.height, barwidth-2*padding, this.height-((1-this.val[i])*this.height));
        }
        break;
      default:
    }
    this.ctx.stroke();

    // draw overlay
    // i do here inside because i want to reuse the padding and other setting
    this.ctx.beginPath();
    this.ctx.fillStyle = 'rgba('+this.color[0]+', '+this.color[1]+', '+this.color[2]+', '+this.color[3]+')';
    if (this.type === "peak" || this.type === "avg" || this.type === "rms") {
      var fontsize = Math.floor((barwidth - barwidth/3)/2);
      this.ctx.font = fontsize +"px Arial";
      for (var i = 0; i < cnt; i++) {
        this.ctx.fillText(this.label[i], i*barwidth+barwidth/3, this.height);
      }
    }
    this.ctx.stroke();

  };
  this.getCorr = function(x, y) {
    var tmp = this.cartesian2polar(x, y);
    tmp.angle -= 0.78539816; // Rotate coordinate by 45 degrees
    var radius = -1; // rotate again this time 180 degrees, is it this which break _left ?
    var angle = Math.atan2(x,y); // atan2 gives full circle
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
  this.getPeak = function(buf) {
		var min = +Infinity;
		var max = -Infinity;

		for (var i = 0; i < buf.length; i++) {
			if (buf[i] < min) min = buf[i];
			else if (buf[i] > max) max = buf[i];
		}
    return Math.max(Math.abs(min), Math.abs(min));
	}
  this.getAvg = function(buf) {
		var val = 0;

		for (var i = 0; i < buf.length; i++) {
      val += Math.abs(buf[i]);
		}

    return val / buf.length;
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
  this.start = function(drawcanvas) {
    this.log("Meter.start");

    if (this.raf === null) {
      this.canvas = drawcanvas;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false; // faster
      this.resizer();
      // resizing, nicer than in loop, coz resize canvas clears it -> no nice fadeout possible
      addEventListener('resize', () => this.resizer());
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
      removeEventListener('resize', () => this.resizer());
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.log("Meter stopped");
    } else {
      this.log("Meter already stopped");
    }
  };

}
