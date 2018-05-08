/**
* VolumeData by Grant Skinner. Feb 6, 2011
* Visit www.gskinner.com/blog for documentation, updates and more free code.
*
* Copyright (c) 2010 Grant Skinner
* 
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
* 
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
**/

(function(window) {

/**
 * Constructs a VolumeData object with the specified data.
 * @class Provides an easy interface for reading volume data generated by the VolumeData application.
 * @param data The volume data that was output by the VolumeData application. This can either be an Image or a string.
 * @param sampleRate The sample rate that the volume data was generated at. Defaults to 50hz.
 **/
function VolumeData(data, sampleRate) {
  this.initialize(data, sampleRate);
}
var p = VolumeData.prototype;

VolumeData.HEADER_SIZE = 2;


/** @private **/
VolumeData._workingCanvas = document.createElement("canvas");

// public properties:
	/** READ-ONLY. The sample rate of the data in hertz. **/
	p.sampleRate = 0;
	/** READ-ONLY. Indicates whether the sample data is in stereo. **/
	p.stereo = true;
	/** READ-ONLY. Indicates total number of samples in the data. **/
	p.numSamples = 0;
	/** Value to multiply against the volume values. For example, for a particularly quiet track, you could set gain=2 to increase the range. **/
	p.gain = 1;
	
// private properties:
	/** @private **/
	p._data = null;
	/** @private **/
	p._headerSize = 0;
	/** @private **/
	p._color1 = -1;
	/** @private **/
	p._color2 = -1;
	
// constructor:
	/** @private **/
	p.initialize = function(data, sampleRate) {
		this.sampleRate = sampleRate ? sampleRate : 50;
		if (typeof(data) == "string") {
			this._getVolume = this._getVolumeString;
			this.data = data;
			this._headerSize = 1;
			this.stereo = data.charAt(0) != "0";
			this.numSamples = data.length-this._headerSize;
		} else if (data instanceof Image) {
			this._getVolume = this._getVolumeImage;
			var canvas = VolumeData._workingCanvas;
			canvas.width = data.width;
			canvas.height = data.height;
			var ctx = canvas.getContext("2d");
			ctx.drawImage(data, 0, 0);
			this.data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
			
			this._getColors(0);
			if (this.color1 == -1) { throw("Unable to parse color markers."); }
			this.stereo = (this.color2 != -1);
			this._headerSize = 2;
			this.numSamples = this.data.length/4-this._headerSize;
		} else {
			throw("Unrecognized data type for VolumeData. Must be Image or String.")
		}
	}
	
// public methods:
	/**
	 * Returns the sample index for the specified time.
	 * @param time The time in seconds.
	 **/
	p.getIndex = function(time) {
		return Math.max(0,Math.min(this.numSamples,time*this.sampleRate));
	}
	
	/**
	 * Returns an object with left and right properties corresponding to the volume at the specified time.
	 * If the volume data is monoaural, then both left and right properties will have the same value.
	 * @param time The time in seconds.
	 * @param o Optional. An object to append the left and right properties to. If this is undefined a new generic object will be returned.
	 **/
	p.getVolume = function(time, o) {
		if (!o) { o = {}; }
		var index = Math.round(this.getIndex(time));
		if (index < 0 || index > this.numSamples) {
			o.left = o.right = 0;
		} else {
			this._getVolume(index,o);
		}
		return o;
	}
	
	/**
	 * Returns an object with left and right properties corresponding to the average volume over the
	 * specified time range.
	 * If the volume data is monoaural, then both left and right properties will have the same value.
	 * @param start The start time in seconds.
	 * @param end The end time in seconds.
	 * @param o Optional. An object to append the left and right properties to. If this is undefined a new generic object will be returned.
	 **/
	p.getAverageVolume = function(start, end, o) {
		if (!o) { o = {}; }
		start = Math.round(this.getIndex(start));
		end = Math.round(this.getIndex(end));
		if (end < start) {
			o.left = o.right = 0;
		} else {
			var l = 0;
			var r = 0;
			for (var i=start; i<=end; i++) {
				this._getVolume(i,o);
				l += o.left;
				r += o.right;
			}
			o.left = l/(end-start+1);
			o.right = r/(end-start+1);
		}
		return o;
	}
	
	/**
	* Returns a string representation of this object.
	**/
	p.toString = function() {
		return "[VolumeData]";
	}
	
// private methods:

	// separated so it can be used more easily in subclasses:
	/** @private **/
	p._getVolume = null;

	/** @private **/
	p._getVolumeImage = function(sampleIndex,o) {
		sampleIndex += this._headerSize;
		if (this.stereo) {
			o.left = Math.min(1, this.data[sampleIndex*4+this.color1]/0xFF *this.gain);
			o.right = Math.min(1, this.data[sampleIndex*4+this.color2]/0xFF *this.gain);
		} else {
			o.left = o.right = Math.min(1, this.data[sampleIndex*4+this.color1]/0xFF *this.gain);
		}
	}

	/** @private **/
	p._getVolumeString = function(sampleIndex,o) {
		if (this.stereo) {
			o.left = Math.min(1, (this.data.charCodeAt(sampleIndex*2+this._headerSize|0)-33)/93 *this.gain);
			o.right = Math.min(1, (this.data.charCodeAt(sampleIndex*2+this._headerSize+1|0)-33)/93 *this.gain);
		} else {
			o.left = o.right = Math.min(1, (this.data.charCodeAt(sampleIndex+this._headerSize|0)-33)/93 *this.gain);
		}
	}

	/** @private **/
	p._getColors = function(index) {
		var r = this.data[index*4];
		var g = this.data[index*4+1];

		var b = this.data[index*4+2];
		this.color1 = this.color2 = -1;
		if (r > 0x40) {
			this.color1 = 0;
			if (g > 0x40) { this.color2 = 1; }
			else if (b > 0x40) { this.color2 = 2; }
		} else if (g > 0x40) {
			this.color1 = 1;
			if (b > 0x40) { this.color2 = 2; }
		} else if (b > 0x40) {
			this.color1 = 2;
		}
	}

	/** @private **/
	p._getSampleRate = function(index) {
		// doesn't seem to work well enough with JPEG compression
		var g = this.data[index*4+1];
		var b = this.data[index*4+2];
		this.sampleRate = Math.round(g/15)*16+Math.round(b/15);
	}

window.VolumeData = VolumeData;
}(window));