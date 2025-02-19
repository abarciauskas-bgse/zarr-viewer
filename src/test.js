
const zarr = require('zarr')

zarr.openArray({
    store: "https://mur-sst.s3.amazonaws.com/zarr-v1",
    path: "analysed_sst",
    mode: "r"
}).then((array) => {
    console.log("Array loaded:", array);
});
