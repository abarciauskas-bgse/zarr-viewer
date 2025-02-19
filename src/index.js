import * as zarr from "zarrita";

// Make zarr available globally for debugging
window.zarr = zarr;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  // example URL: https://s3.amazonaws.com/mur-sst/zarr-v1 or https://mur-sst.s3.amazonaws.com/zarr-v1
  const zarrUrlInput = document.getElementById('zarrUrl');
  const dataPathInput = document.getElementById('dataPath');
  const loadBtn = document.getElementById('loadBtn');
  const canvas = document.getElementById('imageCanvas');
  const statusEl = document.getElementById('status');
  
  // Add click handler to load button
  loadBtn.addEventListener('click', loadZarrImage);

  // Main function to load and display a Zarr array
  async function loadZarrImage() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
      statusEl.textContent = "Loading Zarr store...";
      
      const zarrUrl = zarrUrlInput.value;
      const variable = dataPathInput.value || '';
    
      // Examples:
      // POWER dataset
      // Doesn't work since zarrita doesn't support fixedscaleoffset
      // const zarrUrl = "https://nasa-power.s3.us-west-2.amazonaws.com/merra2/spatial/power_merra2_annual_spatial_utc.zarr"
      // const variable = "TS"
      // SST dataset
      // Hasn't been proven to work since it's very large
      // const zarrUrl = "https://mur-sst.s3.amazonaws.com/zarr-v1/"
      // const variable = "analysed_sst"
      // GPM IMERG dataset
      // WORKS!!1
      // const zarrUrl = "https://nasa-eodc-public.s3.us-west-2.amazonaws.com/GPM_3IMERGDF.07/"
      // const variable = "0/precipitation"

      const store = await zarr.withConsolidated(
        new zarr.FetchStore(zarrUrl),
      );
      // for unconsolidated stores
      // const store = new zarr.FetchStore(zarrUrl);
      const group = await zarr.open.v2(store, { kind: "group" });
      const array = await zarr.open(group.resolve(variable), { kind: "array" });      

      // Get array metadata
      const shape = array.shape;
      const dtype = array.dtype;
      statusEl.textContent = `Array loaded: shape=${shape}, dtype=${dtype}`;
      
      // 3D array - assume [time, y, x] and take first time
      // debugger;
      const data = await zarr.get(array, [0, null, null]);
      
      // Normalize and display the image
      const result = normalizeArrayForDisplay(data);
      const width = result.width;
      const height = result.height;
      const imageArray = result.array;
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Create ImageData and put on canvas
      const imageData = new ImageData(imageArray, width, height);
      ctx.putImageData(imageData, 0, 0);
      
      statusEl.textContent = `Image loaded: ${width}×${height}`;
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
      console.error('Zarr loading error:', error);
    }
  }
  
  // Helper function to normalize array data for display
  function normalizeArrayForDisplay(data) {
    // Extract dimensions
    const height = data.shape[data.shape.length - 2];
    const width = data.shape[data.shape.length - 1];
    
    // Get the data array (handle different array types)
    let flatArray;
    if (data.data && data.data.length) {
      flatArray = Array.from(data.data);
    } else if (Array.isArray(data)) {
      // Handle case where data is a nested array
      flatArray = [];
      function flattenArray(arr) {
        for (let i = 0; i < arr.length; i++) {
          if (Array.isArray(arr[i])) {
            flattenArray(arr[i]);
          } else {
            flatArray.push(arr[i]);
          }
        }
      }
      flattenArray(data);
    } else {
      console.warn("Unexpected data format:", data);
      flatArray = [0]; // Fallback
    }
    
    // Find min/max for normalization (filtering out NaN values)
    const validValues = flatArray.filter(function(v) { return !isNaN(v); });
    const min = Math.min.apply(null, validValues);
    const max = Math.max.apply(null, validValues);
    const range = max - min;
    
    // Create RGBA array (4 bytes per pixel)
    const rgbaArray = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
      const value = flatArray[i];
      // Normalize value to 0-255 range
      let normalizedValue;
      if (isNaN(value)) {
        normalizedValue = 0;
      } else if (range === 0) {
        normalizedValue = 128;
      } else {
        normalizedValue = Math.floor(((value - min) / range) * 255);
      }
      
      // Set RGBA (grayscale with full alpha)
      const pixelIndex = i * 4;
      rgbaArray[pixelIndex] = normalizedValue;     // R
      rgbaArray[pixelIndex + 1] = normalizedValue; // G
      rgbaArray[pixelIndex + 2] = normalizedValue; // B
      rgbaArray[pixelIndex + 3] = 255;             // A (fully opaque)
    }
    
    return { array: rgbaArray, width: width, height: height };
  }
});